const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Prevent process crashes from Puppeteer context errors
process.on('unhandledRejection', (reason) => {
    if (reason && reason.message && reason.message.includes('Execution context was destroyed')) {
        console.warn('Caught WhatsApp Context Error: Page navigated during execution. This is usually handled by the library.');
        return;
    }
    console.error('Unhandled Rejection:', reason);
});

let client;
let qrCodeData = null;
let connectionStatus = 'DISCONNECTED'; 

const getExecutablePath = () => {
    const paths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
};

const clearAuth = () => {
    const authPath = './.wwebjs_auth';
    if (fs.existsSync(authPath)) {
        try {
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log('WhatsApp Auth folder cleared');
        } catch (e) {
            console.error('Failed to clear WhatsApp Auth folder:', e);
        }
    }
};

const startClient = () => {
    console.log('Initializing WhatsApp Client...');
    connectionStatus = 'INITIALIZING';
    qrCodeData = null;

    const executablePath = getExecutablePath();
    
    // Modern user agent to prevent "Update Chrome" prompts
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
            headless: 'new',
            executablePath: executablePath || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-features=IsolateSandboxedIframes',
                '--disable-site-isolation-trials',
                `--user-agent=${userAgent}`
            ]
        }
    });

    client.on('qr', async (qr) => {
        console.log('WhatsApp QR Received');
        connectionStatus = 'QR_READY';
        try {
            qrCodeData = await qrcode.toDataURL(qr);
        } catch (err) {
            console.error('QR Conversion Error', err);
        }
    });

    client.on('ready', () => {
        console.log('WhatsApp Client is ready!');
        connectionStatus = 'READY';
        qrCodeData = null;
    });

    client.on('authenticated', () => {
        console.log('WhatsApp Authenticated');
        connectionStatus = 'AUTHENTICATED';
    });

    client.on('auth_failure', (msg) => {
        console.error('WhatsApp Auth Failure', msg);
        connectionStatus = 'DISCONNECTED';
    });

    client.on('disconnected', async (reason) => {
        console.log('WhatsApp Disconnected', reason);
        connectionStatus = 'DISCONNECTED';
        try {
            await client.destroy();
        } catch (e) {}
    });

    client.initialize().catch(err => {
        console.error('WhatsApp Initialization Error', err);
        connectionStatus = 'DISCONNECTED';
    });
};

const initWhatsApp = (app) => {
    startClient();

    // API Endpoints
    app.get('/api/whatsapp/status', (req, res) => {
        res.json({ status: connectionStatus, qr: qrCodeData });
    });

      const normalizeToE164Digits = (raw) => {
          const digits = String(raw || '').replace(/\D/g, '');
          if (!digits) return '';

          // India default: if 10 digits, assume +91.
          if (digits.length === 10) return `91${digits}`;

          // If user included leading 0 (common in India), e.g. 09876..., normalize to 91XXXXXXXXXX
          if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;

          // Otherwise assume already includes country code.
          return digits;
      };

        app.post('/api/whatsapp/send-pdf', async (req, res) => {
            const { phone, pdfBase64, filename, message } = req.body;

            if (connectionStatus !== 'READY') {
                return res.status(400).json({ error: 'WhatsApp not connected' });
            }

            const e164Digits = normalizeToE164Digits(phone);
            if (!e164Digits) {
                return res.status(400).json({ error: 'Invalid phone number' });
            }

            // Parse media early so if it fails we don't touch Puppeteer.
            const base64Content = String(pdfBase64 || '').split(',')[1] || pdfBase64;
            if (!base64Content) {
                return res.status(400).json({ error: 'Missing pdfBase64' });
            }

            try {
                // Ensure the underlying puppeteer page is alive; whatsapp-web.js can report READY
                // but still have a detached frame after sleep/network changes.
                const state = await client.getState();
                if (state !== 'CONNECTED') {
                    connectionStatus = 'DISCONNECTED';
                    return res.status(400).json({
                        error: 'WhatsApp session is not connected. Please reconnect from Settings.',
                        details: { state }
                    });
                }

                // For "new" contacts resolve correct WhatsApp JID instead of relying on cache.
                const numberId = await client.getNumberId(e164Digits);
                if (!numberId || !numberId._serialized) {
                    return res.status(400).json({
                        error: 'This phone number is not registered on WhatsApp.',
                        details: { input: phone, normalized: e164Digits }
                    });
                }

                const chatId = numberId._serialized; // e.g. 9198xxxxxxx@c.us

                const media = new MessageMedia('application/pdf', base64Content, filename || 'Invoice.pdf');
                await client.sendMessage(chatId, media, { caption: message || '' });

                res.json({ success: true, to: chatId, normalized: e164Digits });
            } catch (err) {
                console.error('WhatsApp Send Error', err);

                const msg = (err && err.message) ? err.message : String(err);

                // If Puppeteer/WA context is broken, force a reconnect path.
                const isDetached = msg.includes('detached Frame') || msg.includes('Execution context was destroyed');
                if (isDetached) {
                    connectionStatus = 'DISCONNECTED';
                }

                res.status(isDetached ? 400 : 500).json({
                    error: msg,
                    hint: isDetached
                        ? 'WhatsApp web session became unstable. Open Settings > WhatsApp Direct Send and reconnect (Logout then scan QR again).'
                        : (msg.includes('invalid') || msg.includes('wid')
                            ? 'Check phone number format and WhatsApp connectivity.'
                            : undefined)
                });
            }
        });

    app.post('/api/whatsapp/logout', async (req, res) => {
        try {
            console.log('WhatsApp Logout Requested');
            
            if (client) {
                try {
                    await client.logout();
                } catch (e) {
                    console.log('Client logout failed');
                }
                try {
                    await client.destroy();
                } catch (e) {
                    console.log('Client destroy failed');
                }
            }

            connectionStatus = 'DISCONNECTED';
            qrCodeData = null;
            
            setTimeout(() => {
                clearAuth();
                startClient();
            }, 3000);

            res.json({ success: true });
        } catch (err) {
            console.error('Logout process error:', err);
            connectionStatus = 'DISCONNECTED';
            qrCodeData = null;
            setTimeout(() => {
                clearAuth();
                startClient();
            }, 3000);
            res.json({ success: true });
        }
    });
};

module.exports = { initWhatsApp };
