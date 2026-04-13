import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Phone, CheckCircle2, XCircle, RefreshCw, LogOut, QrCode } from 'lucide-react';

export default function WhatsAppSetup() {
    const [status, setStatus] = useState('LOADING');
    const [qr, setQr] = useState(null);
    const [loading, setLoading] = useState(false);

    const checkStatus = async () => {
        try {
            const data = await api.getWhatsAppStatus();
            setStatus(data.status);
            setQr(data.qr);
        } catch (err) {
            console.error('Failed to get WhatsApp status', err);
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        if (!window.confirm('Are you sure you want to disconnect WhatsApp?')) return;
        setLoading(true);
        try {
            await api.logoutWhatsApp();
            // Status will be updated by the interval automatically
            setTimeout(checkStatus, 1000);
        } catch (err) {
            alert('Logout failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-card">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
                <div className="flex items-center gap-2 text-primary font-semibold" style={{ color: 'var(--accent-mint)' }}>
                    <Phone size={18} fill="var(--accent-mint)" fillOpacity={0.2} />
                    <h3>WhatsApp Direct Send</h3>
                </div>
                {status === 'READY' ? (
                    <span className="badge badge-green">
                        <CheckCircle2 size={12} fill="currentColor" fillOpacity={0.2} style={{ marginRight: 4 }} /> Connected
                    </span>
                ) : (
                    <span className="badge badge-yellow">
                        <RefreshCw size={12} className="animate-spin" style={{ marginRight: 4 }} /> {status.replace('_', ' ')}
                    </span>
                )}
            </div>

            {status === 'READY' ? (
                <div className="space-y-4">
                    <p className="text-sm text-muted">
                        Your WhatsApp account is linked. Invoices will be sent directly to customers without opening WhatsApp Web.
                    </p>
                    <button 
                        onClick={handleLogout}
                        disabled={loading}
                        className="btn btn-danger w-full"
                    >
                        <LogOut size={16} fill="currentColor" fillOpacity={0.2} />
                        {loading ? 'Disconnecting...' : 'Disconnect WhatsApp'}
                    </button>
                </div>
            ) : status === 'QR_READY' && qr ? (
                <div className="text-center space-y-4">
                    <p className="text-sm font-medium">Scan this QR code with your WhatsApp</p>
                    <div className="bg-white p-4 rounded-xl inline-block border shadow-sm">
                        <img src={qr} alt="WhatsApp QR Code" className="w-48 h-48" />
                    </div>
                    <ol className="text-left text-xs text-muted space-y-1 max-w-[200px] mx-auto list-decimal pl-4">
                        <li>Open WhatsApp on your phone</li>
                        <li>Tap Menu or Settings</li>
                        <li>Select Linked Devices</li>
                        <li>Point your phone to this screen</li>
                    </ol>
                    <button 
                        onClick={checkStatus}
                        className="btn btn-secondary btn-sm mx-auto mt-2"
                    >
                        <RefreshCw size={12} fill="currentColor" fillOpacity={0.2} /> Refresh QR
                    </button>
                </div>
            ) : (
                <div className="py-8 text-center space-y-3">
                    <RefreshCw size={32} className="mx-auto text-muted animate-spin" />
                    <p className="text-sm text-muted">
                        {status === 'INITIALIZING' ? 'Initializing WhatsApp engine...' : 
                         status === 'DISCONNECTED' ? 'Re-starting session...' : 
                         'Connecting to WhatsApp...'}
                    </p>
                    <p className="text-xs text-muted">This may take up to 30 seconds</p>
                </div>
            )}
        </div>
    );
}
