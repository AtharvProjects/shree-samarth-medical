const express = require('express');
const cors = require('cors');
const db = require('./db');
const { initWhatsApp } = require('./whatsapp');
const { encrypt, decrypt, encryptionTrace, generateHMAC, verifyHMAC } = require('./encryption');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for PDF base64

// Initialize WhatsApp
initWhatsApp(app);

// ============ SETTINGS ============
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const update = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const txn = db.transaction((data) => {
    for (const [key, value] of Object.entries(data)) {
      update.run(key, String(value));
    }
  });
  txn(req.body);
  res.json({ success: true });
});


// ============ MEDICINES ============
app.get('/api/medicines', (req, res) => {
  const { search, active_only } = req.query;
  let query = `SELECT m.*, 
    COALESCE(SUM(b.quantity), 0) as total_stock,
    MIN(b.expiry_date) as nearest_expiry
    FROM medicines m
    LEFT JOIN batches b ON b.medicine_id = m.id`;
  const params = [];
  const conditions = [];
  
  if (active_only !== 'false') {
    conditions.push('m.is_active = 1');
  }
  if (search) {
    conditions.push('(m.brand_name LIKE ? OR m.generic_name LIKE ? OR m.company_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' GROUP BY m.id ORDER BY m.brand_name';
  
  res.json(db.prepare(query).all(...params));
});

app.get('/api/medicines/:id', (req, res) => {
  const med = db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id);
  if (!med) return res.status(404).json({ error: 'Medicine not found' });
  const batches = db.prepare('SELECT * FROM batches WHERE medicine_id = ? ORDER BY expiry_date').all(req.params.id);
  res.json({ ...med, batches });
});

app.get('/api/medicines-categories', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT drug_group FROM medicines WHERE drug_group IS NOT NULL AND drug_group != \'\' ORDER BY drug_group').all();
  res.json(rows.map(r => r.drug_group));
});

app.post('/api/medicines', (req, res) => {
  const { brand_name, generic_name, company_name, drug_group, unit_category, hsn_code, gst_percent, schedule, is_h1, tablets_per_strip } = req.body;
  if (!brand_name) return res.status(400).json({ error: 'Brand name is required' });
  try {
    const result = db.prepare(
      `INSERT INTO medicines (brand_name, generic_name, company_name, drug_group, unit_category, hsn_code, gst_percent, schedule, is_h1, tablets_per_strip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(brand_name, generic_name || '', company_name || '', drug_group || '', unit_category || 'Tablet', hsn_code || '', gst_percent || 12, schedule || '', is_h1 ? 1 : 0, tablets_per_strip || 10);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/medicines/:id', (req, res) => {
  const { brand_name, generic_name, company_name, drug_group, unit_category, hsn_code, gst_percent, schedule, is_active, is_h1, tablets_per_strip } = req.body;
  try {
    db.prepare(
      `UPDATE medicines SET brand_name=?, generic_name=?, company_name=?, drug_group=?, unit_category=?, hsn_code=?, gst_percent=?, schedule=?, is_active=?, is_h1=?, tablets_per_strip=?, updated_at=datetime('now','localtime') WHERE id=?`
    ).run(brand_name, generic_name || '', company_name || '', drug_group || '', unit_category || 'Tablet', hsn_code || '', gst_percent || 12, schedule || '', is_active !== undefined ? is_active : 1, is_h1 ? 1 : 0, tablets_per_strip || 10, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/medicines/:id', (req, res) => {
  try {
    const txn = db.transaction(() => {
      // 1. Check if medicine is used in invoice_items
      const usedInInvoices = db.prepare('SELECT COUNT(*) as count FROM invoice_items WHERE medicine_id = ?').get(req.params.id);
      if (usedInInvoices.count > 0) {
        throw new Error(`Cannot delete: Medicine used in ${usedInInvoices.count} invoices. Archive it instead.`);
      }
      
      // 2. Check if medicine is used in purchase_items
      const usedInPurchases = db.prepare('SELECT COUNT(*) as count FROM purchase_items WHERE medicine_id = ?').get(req.params.id);
      if (usedInPurchases.count > 0) {
        throw new Error(`Cannot delete: Medicine used in ${usedInPurchases.count} purchase entries.`);
      }

      // 3. Check if any batches of this medicine are used
      // Even if medicine_id is not directly in items (redundant but possible), batch_id definitely is.
      const batches = db.prepare('SELECT id FROM batches WHERE medicine_id = ?').all(req.params.id);
      for (const batch of batches) {
        const batchUsedInInv = db.prepare('SELECT COUNT(*) as count FROM invoice_items WHERE batch_id = ?').get(batch.id);
        if (batchUsedInInv.count > 0) {
          throw new Error(`Cannot delete: One or more batches of this medicine are used in invoices.`);
        }
        const batchUsedInPur = db.prepare('SELECT COUNT(*) as count FROM purchase_items WHERE batch_id = ?').get(batch.id);
        if (batchUsedInPur.count > 0) {
          throw new Error(`Cannot delete: One or more batches of this medicine are used in purchase entries.`);
        }
      }

      // If we got here, it's safe to delete
      db.prepare('DELETE FROM batches WHERE medicine_id = ?').run(req.params.id);
      db.prepare('DELETE FROM medicines WHERE id = ?').run(req.params.id);
    });

    txn();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete medicine error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ============ BATCHES ============
app.get('/api/batches', (req, res) => {
  const { medicine_id, low_stock, expiring } = req.query;
  let query = `SELECT b.*, m.brand_name, m.company_name, m.unit_category 
    FROM batches b JOIN medicines m ON b.medicine_id = m.id WHERE 1=1`;
  const params = [];
  if (medicine_id) { query += ' AND b.medicine_id = ?'; params.push(medicine_id); }
  if (low_stock) { query += ' AND b.quantity > 0 AND b.quantity <= ?'; params.push(parseInt(low_stock)); }
  if (expiring) { query += ` AND b.expiry_date <= date('now', '+' || ? || ' days') AND b.quantity > 0`; params.push(parseInt(expiring)); }
  query += ' ORDER BY b.expiry_date';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/batches', (req, res) => {
  const { medicine_id, batch_number, mfg_date, expiry_date, purchase_rate, selling_rate, mrp, quantity, supplier_id } = req.body;
  if (!medicine_id || !batch_number || !expiry_date) return res.status(400).json({ error: 'medicine_id, batch_number, expiry_date required' });

  // ── Business Rule Validation ──────────────────────────────────────────────
  const pr  = parseFloat(purchase_rate)  || 0;
  const sr  = parseFloat(selling_rate)   || 0;
  const mrpV = parseFloat(mrp)           || 0;
  const qty = parseInt(quantity)         || 0;
  const today = new Date().toISOString().slice(0, 10);

  if (pr > 0 && sr > 0 && sr < pr)
    return res.status(400).json({ error: `Selling Rate (₹${sr}) cannot be less than Purchase Rate (₹${pr})` });
  if (mrpV > 0 && sr > mrpV)
    return res.status(400).json({ error: `Selling Rate (₹${sr}) cannot exceed MRP (₹${mrpV})` });
  if (mrpV > 0 && pr > mrpV)
    return res.status(400).json({ error: `Purchase Rate (₹${pr}) cannot exceed MRP (₹${mrpV})` });
  if (expiry_date <= today)
    return res.status(400).json({ error: 'Expiry date must be a future date' });
  if (mfg_date && mfg_date >= expiry_date)
    return res.status(400).json({ error: 'MFG date must be before Expiry date' });
  if (qty < 0)
    return res.status(400).json({ error: 'Quantity cannot be negative' });
  // ─────────────────────────────────────────────────────────────────────────

  const result = db.prepare(
    `INSERT INTO batches (medicine_id, batch_number, mfg_date, expiry_date, purchase_rate, selling_rate, mrp, quantity, supplier_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(medicine_id, batch_number, mfg_date || '', expiry_date, pr, sr, mrpV, qty, supplier_id || null);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/batches/:id', (req, res) => {
  const { batch_number, mfg_date, expiry_date, purchase_rate, selling_rate, mrp, quantity } = req.body;

  // ── Business Rule Validation ──────────────────────────────────────────────
  const pr   = parseFloat(purchase_rate) || 0;
  const sr   = parseFloat(selling_rate)  || 0;
  const mrpV = parseFloat(mrp)           || 0;
  const today = new Date().toISOString().slice(0, 10);

  if (pr > 0 && sr > 0 && sr < pr)
    return res.status(400).json({ error: `Selling Rate (₹${sr}) cannot be less than Purchase Rate (₹${pr})` });
  if (mrpV > 0 && sr > mrpV)
    return res.status(400).json({ error: `Selling Rate (₹${sr}) cannot exceed MRP (₹${mrpV})` });
  if (mrpV > 0 && pr > mrpV)
    return res.status(400).json({ error: `Purchase Rate (₹${pr}) cannot exceed MRP (₹${mrpV})` });
  if (expiry_date && expiry_date <= today)
    return res.status(400).json({ error: 'Expiry date must be a future date' });
  if (mfg_date && expiry_date && mfg_date >= expiry_date)
    return res.status(400).json({ error: 'MFG date must be before Expiry date' });
  // ─────────────────────────────────────────────────────────────────────────

  db.prepare(
    `UPDATE batches SET batch_number=?, mfg_date=?, expiry_date=?, purchase_rate=?, selling_rate=?, mrp=?, quantity=? WHERE id=?`
  ).run(batch_number, mfg_date, expiry_date, pr, sr, mrpV, parseInt(quantity) || 0, req.params.id);
  res.json({ success: true });
});


app.delete('/api/batches/:id', (req, res) => {
  try {
    const usedInInvoices = db.prepare('SELECT COUNT(*) as count FROM invoice_items WHERE batch_id = ?').get(req.params.id);
    if (usedInInvoices.count > 0) {
      return res.status(400).json({ error: `Cannot delete: Batch used in ${usedInInvoices.count} invoices. Delete the invoices first.` });
    }
    const usedInPurchases = db.prepare('SELECT COUNT(*) as count FROM purchase_items WHERE batch_id = ?').get(req.params.id);
    if (usedInPurchases.count > 0) {
      return res.status(400).json({ error: `Cannot delete: Batch used in ${usedInPurchases.count} purchase entries.` });
    }
    db.prepare('DELETE FROM batches WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ CUSTOMERS ============
// Helper: decrypt a customer row's sensitive fields before sending to frontend
  function decryptCustomer(c) {
    if (!c) return c;
    return {
      ...c,
      phone:   decrypt(c.phone),
      address: decrypt(c.address),
    };
  }

  // Customers are stored with encrypted phone/address.
  // When invoices join customers, customer_phone may be encrypted and must be decrypted
  // before sending to the UI (needed for WhatsApp sending).
  function decryptInvoiceCustomerFields(inv) {
    if (!inv) return inv;
    const next = { ...inv };
    if (typeof next.customer_phone === 'string') {
      next.customer_phone = decrypt(next.customer_phone);
    }
    return next;
  }

app.get('/api/customers', (req, res) => {
  const { search } = req.query;
  // Fetch all, decrypt, then filter (phone is encrypted so SQL LIKE won't work on it)
  let query = 'SELECT * FROM customers ORDER BY name';
  let rows = db.prepare(query).all().map(decryptCustomer);
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(r =>
      r.name.toLowerCase().includes(s) ||
      r.phone.toLowerCase().includes(s)
    );
  }
  res.json(rows);
});

app.get('/api/customers/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const invoices = db.prepare('SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50').all(req.params.id);
  res.json({ ...decryptCustomer(c), invoices });
});

app.post('/api/customers', (req, res) => {
  const { name, phone, address, credit_balance, last_payment_mode } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const encPhone   = encrypt(phone || '');
    const encAddress = encrypt(address || '');
    const result = db.prepare('INSERT INTO customers (name, phone, address, credit_balance, last_payment_mode) VALUES (?, ?, ?, ?, ?)').run(name, encPhone, encAddress, credit_balance || 0, last_payment_mode || 'Cash');
    res.json({ id: result.lastInsertRowid, name, phone: phone || '', address: address || '', credit_balance: credit_balance || 0, last_payment_mode: last_payment_mode || 'Cash' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customers/:id', (req, res) => {
  const { name, phone, address, credit_balance, last_payment_mode } = req.body;
  try {
    const encPhone   = encrypt(phone || '');
    const encAddress = encrypt(address || '');
    db.prepare(`UPDATE customers SET name=?, phone=?, address=?, credit_balance=?, last_payment_mode=?, updated_at=datetime('now','localtime') WHERE id=?`).run(name, encPhone, encAddress, credit_balance || 0, last_payment_mode || 'Cash', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', (req, res) => {
  try {
    const hasInvoices = db.prepare('SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?').get(req.params.id);
    if (hasInvoices.count > 0) {
      throw new Error(`Cannot delete: Customer has ${hasInvoices.count} invoices. Delete the invoices first or archive this customer.`);
    }
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============ DOCTORS ============
app.get('/api/doctors', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM doctors';
  const params = [];
  if (search) { query += ' WHERE name LIKE ? OR hospital LIKE ?'; params.push(`%${search}%`, `%${search}%`); }
  query += ' ORDER BY name';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/doctors', (req, res) => {
  const { name, hospital, phone, address, specialization } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = db.prepare('INSERT INTO doctors (name, hospital, phone, address, specialization) VALUES (?, ?, ?, ?, ?)').run(name, hospital || '', phone || '', address || '', specialization || '');
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/doctors/:id', (req, res) => {
  const { name, hospital, phone, address, specialization } = req.body;
  try {
    db.prepare('UPDATE doctors SET name=?, hospital=?, phone=?, address=?, specialization=? WHERE id=?').run(name, hospital || '', phone || '', address || '', specialization || '', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/doctors/:id', (req, res) => {
  try {
    const hasInvoices = db.prepare('SELECT COUNT(*) as count FROM invoices WHERE doctor_id = ?').get(req.params.id);
    if (hasInvoices.count > 0) {
      throw new Error(`Cannot delete: Doctor associated with ${hasInvoices.count} invoices. You can archive this doctor instead.`);
    }
    db.prepare('DELETE FROM doctors WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============ SUPPLIERS ============
app.get('/api/suppliers', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM suppliers';
  const params = [];
  if (search) { query += ' WHERE name LIKE ? OR phone LIKE ?'; params.push(`%${search}%`, `%${search}%`); }
  query += ' ORDER BY name';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/suppliers', (req, res) => {
  const { name, phone, email, address, gst_number, dl_number } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = db.prepare('INSERT INTO suppliers (name, phone, email, address, gst_number, dl_number) VALUES (?, ?, ?, ?, ?, ?)').run(name, phone || '', email || '', address || '', gst_number || '', dl_number || '');
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/suppliers/:id', (req, res) => {
  const { name, phone, email, address, gst_number, dl_number } = req.body;
  try {
    db.prepare('UPDATE suppliers SET name=?, phone=?, email=?, address=?, gst_number=?, dl_number=? WHERE id=?').run(name, phone || '', email || '', address || '', gst_number || '', dl_number || '', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/suppliers/:id', (req, res) => {
  try {
    const txn = db.transaction(() => {
      const hasPurchases = db.prepare('SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?').get(req.params.id);
      if (hasPurchases.count > 0) {
        throw new Error(`Cannot delete: Supplier has ${hasPurchases.count} purchase entries.`);
      }
      
      const hasBatches = db.prepare('SELECT COUNT(*) as count FROM batches WHERE supplier_id = ?').get(req.params.id);
      if (hasBatches.count > 0) {
        throw new Error(`Cannot delete: Supplier is linked to existing batches.`);
      }

      db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    });
    txn();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============ INVOICES / BILLING ============
app.get('/api/invoices', (req, res) => {
  const { date, from, to, customer_id, limit: lim } = req.query;
  let query = `SELECT i.*, c.name as customer_name, d.name as doctor_name 
    FROM invoices i 
    LEFT JOIN customers c ON i.customer_id = c.id 
    LEFT JOIN doctors d ON i.doctor_id = d.id WHERE 1=1`;
  const params = [];
  if (date) { query += ` AND date(i.created_at) = ?`; params.push(date); }
  if (from) { query += ` AND date(i.created_at) >= ?`; params.push(from); }
  if (to) { query += ` AND date(i.created_at) <= ?`; params.push(to); }
  if (customer_id) { query += ` AND i.customer_id = ?`; params.push(customer_id); }
  query += ' ORDER BY i.created_at DESC';
  if (lim) { query += ' LIMIT ?'; params.push(parseInt(lim)); }
  res.json(db.prepare(query).all(...params));
});

  app.get('/api/invoices/:id', (req, res) => {
      const invRaw = db.prepare(`SELECT i.*, c.name as customer_name, c.phone as customer_phone, d.name as doctor_name, d.hospital as doctor_hospital
        FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN doctors d ON i.doctor_id = d.id WHERE i.id = ?`).get(req.params.id);
      if (!invRaw) return res.status(404).json({ error: 'Not found' });
      const items = db.prepare(`SELECT ii.*, m.brand_name, m.company_name, m.unit_category, COALESCE(ii.tablets_per_strip, m.tablets_per_strip, 10) as tablets_per_strip, b.batch_number, b.expiry_date, b.mfg_date
        FROM invoice_items ii JOIN medicines m ON ii.medicine_id = m.id JOIN batches b ON ii.batch_id = b.id WHERE ii.invoice_id = ?`).all(req.params.id);
      const h1_details = db.prepare(`SELECT * FROM invoice_h1_details WHERE invoice_id = ?`).get(req.params.id);
      const inv = decryptInvoiceCustomerFields(invRaw);
      res.json({ ...inv, items, h1_details });
    });

// Generate next invoice number
function getNextInvoiceNumber() {
  const today = new Date();
  const prefix = `INV${String(today.getFullYear()).slice(2)}${String(today.getMonth()+1).padStart(2,'0')}`;
  const last = db.prepare(`SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1`).get(`${prefix}%`);
  if (!last) return `${prefix}0001`;
  const num = parseInt(last.invoice_number.slice(prefix.length)) + 1;
  return `${prefix}${String(num).padStart(4, '0')}`;
}

  app.post('/api/invoices', (req, res) => {
    const { customer_id, doctor_id, items, payment_mode, discount_amount, notes, amount_paid, is_gst_enabled, h1_details } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'No items' });
  
    const txn = db.transaction(() => {
      const invoice_number = getNextInvoiceNumber();
      let subtotal = 0;
      let gst_total = 0;
  
      // 1. Validate stock and calculate authoritative totals
      const processedItems = items.map(item => {
        const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(item.batch_id);
        if (!batch) throw new Error(`Batch ${item.batch_id} not found`);
        if (batch.quantity < item.quantity) {
          throw new Error(`Insufficient stock for batch ${item.batch_number}. Available: ${batch.quantity}, Requested: ${item.quantity}`);
        }

        const price = item.unit_price || batch.selling_rate;
        const disc = item.discount_percent || 0;
        const lineTotal = item.quantity * price * (1 - disc / 100);
        
        // Use 0 if GST is explicitly disabled for the invoice
        const gstPct = (is_gst_enabled !== false) ? (item.gst_percent !== undefined ? item.gst_percent : 12) : 0;
        const lineGst = (lineTotal * gstPct) / 100;
        
        subtotal += lineTotal;
        gst_total += lineGst;

        return { ...item, price, mrp: batch.mrp, gstPct, lineGst, lineTotal };
      });
  
      const total_amount = Math.round((subtotal + gst_total - (discount_amount || 0)) * 100) / 100;
      const paid = amount_paid !== undefined ? amount_paid : (payment_mode === 'Udhaari' ? 0 : total_amount);
      const credit = Math.max(0, total_amount - paid);
  
      const invResult = db.prepare(
        `INSERT INTO invoices (invoice_number, customer_id, doctor_id, subtotal, discount_amount, gst_amount, total_amount, payment_mode, amount_paid, credit_amount, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(invoice_number, customer_id || null, doctor_id || null, subtotal, discount_amount || 0, gst_total, total_amount, payment_mode || 'Cash', paid, credit, notes || '');
  
      const invoiceId = invResult.lastInsertRowid;
  
      // 2. Insert items and reduce stock
      const insertItem = db.prepare(
        `INSERT INTO invoice_items (invoice_id, medicine_id, batch_id, quantity, unit_price, mrp, discount_percent, gst_percent, gst_amount, total, tablets_per_strip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const reduceStock = db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?');
  
      for (const item of processedItems) {
        insertItem.run(invoiceId, item.medicine_id, item.batch_id, item.quantity, item.price, item.mrp, item.discount_percent, item.gstPct, item.lineGst, item.lineTotal, item.tablets_per_strip || 10);
        reduceStock.run(item.quantity, item.batch_id);
      }


    // Update customer credit and last payment mode
    if (customer_id) {
      if (credit > 0) {
        db.prepare('UPDATE customers SET credit_balance = credit_balance + ?, last_payment_mode = ? WHERE id = ?').run(credit, payment_mode || 'Cash', customer_id);
      } else {
        db.prepare('UPDATE customers SET last_payment_mode = ? WHERE id = ?').run(payment_mode || 'Cash', customer_id);
      }
    }

    if (h1_details && Object.keys(h1_details).length > 0) {
      db.prepare(
        `INSERT INTO invoice_h1_details (invoice_id, patient_name, patient_address, doctor_name, doctor_address, doctor_reg_no, prescription_no)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        invoiceId,
        h1_details.patient_name || '',
        h1_details.patient_address || '',
        h1_details.doctor_name || '',
        h1_details.doctor_address || '',
        h1_details.doctor_reg_no || '',
        h1_details.prescription_no || ''
      );
    }

      // Return the full invoice object
      const invRaw = db.prepare(`SELECT i.*, c.name as customer_name, c.phone as customer_phone, d.name as doctor_name, d.hospital as doctor_hospital
        FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN doctors d ON i.doctor_id = d.id WHERE i.id = ?`).get(invoiceId);
      const invItems = db.prepare(`SELECT ii.*, m.brand_name, m.company_name, m.unit_category, COALESCE(ii.tablets_per_strip, m.tablets_per_strip, 10) as tablets_per_strip, b.batch_number, b.expiry_date, b.mfg_date
        FROM invoice_items ii JOIN medicines m ON ii.medicine_id = m.id JOIN batches b ON ii.batch_id = b.id WHERE ii.invoice_id = ?`).all(invoiceId);
      const savedH1Details = db.prepare(`SELECT * FROM invoice_h1_details WHERE invoice_id = ?`).get(invoiceId);

      const inv = decryptInvoiceCustomerFields(invRaw);
      return { ...inv, items: invItems, h1_details: savedH1Details };
  });

  try {
    const result = txn();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/invoices/:id', (req, res) => {
  const txn = db.transaction(() => {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!inv) throw new Error('Invoice not found');

    // Restore stock
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
    const restoreStock = db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?');
    
    for (const item of items) {
      restoreStock.run(item.quantity, item.batch_id);
    }

    // Revert customer credit
    if (inv.customer_id && inv.credit_amount > 0) {
      db.prepare('UPDATE customers SET credit_balance = credit_balance - ? WHERE id = ?').run(inv.credit_amount, inv.customer_id);
    }

    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    
    return { success: true };
  });

  try {
    const result = txn();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ PURCHASES ============
app.get('/api/purchases', (req, res) => {
  const rows = db.prepare(`SELECT p.*, s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id ORDER BY p.created_at DESC`).all();
  res.json(rows);
});

app.get('/api/purchases/:id', (req, res) => {
  const p = db.prepare(`SELECT p.*, s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare(`SELECT pi.*, m.brand_name, m.unit_category, m.tablets_per_strip, b.batch_number, b.expiry_date, b.mfg_date 
    FROM purchase_items pi JOIN medicines m ON pi.medicine_id = m.id JOIN batches b ON pi.batch_id = b.id WHERE pi.purchase_id = ?`).all(req.params.id);
  res.json({ ...p, items });
});

app.post('/api/purchases', (req, res) => {
  const { supplier_id, invoice_number, items, notes, purchase_date, amount_paid, payment_mode, payment_notes } = req.body;
  if (!supplier_id || !items || !items.length) return res.status(400).json({ error: 'supplier_id and items required' });

  const txn = db.transaction(() => {
    let total = 0;
    const purchaseResult = db.prepare(
      `INSERT INTO purchases (supplier_id, invoice_number, total_amount, amount_paid, notes, purchase_date) VALUES (?, ?, 0, ?, ?, ?)`
    ).run(supplier_id, invoice_number || '', amount_paid || 0, notes || '', purchase_date || new Date().toISOString().slice(0, 10));
    const purchaseId = purchaseResult.lastInsertRowid;

    for (const item of items) {
      // Create batch
      const batchResult = db.prepare(
        `INSERT INTO batches (medicine_id, batch_number, mfg_date, expiry_date, purchase_rate, selling_rate, mrp, quantity, supplier_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(item.medicine_id, item.batch_number, item.mfg_date || '', item.expiry_date, item.purchase_rate, item.selling_rate || 0, item.mrp || 0, item.quantity, supplier_id);

      const batchId = batchResult.lastInsertRowid;
      const lineTotal = item.quantity * item.purchase_rate;
      total += lineTotal;

      db.prepare(
        `INSERT INTO purchase_items (purchase_id, medicine_id, batch_id, quantity, purchase_rate, selling_rate, mrp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(purchaseId, item.medicine_id, batchId, item.quantity, item.purchase_rate, item.selling_rate || 0, item.mrp || 0);
    }

    db.prepare('UPDATE purchases SET total_amount = ? WHERE id = ?').run(total, purchaseId);

    // If payment was made at the time of purchase, log it in supplier_payments
    if (amount_paid && amount_paid > 0) {
      db.prepare(
        `INSERT INTO supplier_payments (supplier_id, amount, payment_mode, payment_date, notes)
         VALUES (?, ?, ?, ?, ?)`
      ).run(supplier_id, amount_paid, payment_mode || 'Cash', purchase_date || new Date().toISOString().slice(0, 10), payment_notes || 'Paid at time of purchase');
    }

    return { id: purchaseId, total_amount: total };
  });

  try {
    const result = txn();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/purchases/:id', (req, res) => {
  const purchaseId = req.params.id;
  const { supplier_id, invoice_number, items, notes, purchase_date, amount_paid } = req.body;
  if (!supplier_id || !items || !items.length) return res.status(400).json({ error: 'supplier_id and items required' });

  const txn = db.transaction(() => {
    // 1. Fetch current purchase items
    const existingItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchaseId);
    
    // Create maps for quick lookup
    const existingMap = new Map(existingItems.map(i => [i.batch_id, i]));
    const newMap = new Map(items.filter(i => i.batch_id).map(i => [i.batch_id, i]));
    
    // 2. Process removals: Items in existingMap but not in new payload
    for (const [batchId, oldItem] of existingMap) {
      if (!newMap.has(batchId)) {
        const batch = db.prepare('SELECT quantity, batch_number FROM batches WHERE id = ?').get(batchId);
        if (batch) {
          if (batch.quantity < oldItem.quantity) {
             throw new Error(`Cannot remove item (Batch: ${batch.batch_number}) because some quantity has already been sold.`);
          }
          db.prepare('DELETE FROM purchase_items WHERE purchase_id = ? AND batch_id = ?').run(purchaseId, batchId);
          db.prepare('DELETE FROM batches WHERE id = ?').run(batchId);
        }
      }
    }

    let total = 0;

    // 3. Process new and updated items
    for (const item of items) {
      if (!item.batch_id) {
        // Brand new item added to existing purchase
        const batchResult = db.prepare(
          `INSERT INTO batches (medicine_id, batch_number, mfg_date, expiry_date, purchase_rate, selling_rate, mrp, quantity, supplier_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(item.medicine_id, item.batch_number, item.mfg_date || '', item.expiry_date, item.purchase_rate, item.selling_rate || 0, item.mrp || 0, item.quantity, supplier_id);

        const batchId = batchResult.lastInsertRowid;
        db.prepare(
          `INSERT INTO purchase_items (purchase_id, medicine_id, batch_id, quantity, purchase_rate, selling_rate, mrp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(purchaseId, item.medicine_id, batchId, item.quantity, item.purchase_rate, item.selling_rate || 0, item.mrp || 0);

        total += (item.quantity * item.purchase_rate);
      } else {
        // Updating an existing item
        const oldItem = existingMap.get(item.batch_id);
        const batch = db.prepare('SELECT quantity, batch_number FROM batches WHERE id = ?').get(item.batch_id);
        
        if (oldItem && batch) {
          const soldQuantity = oldItem.quantity - batch.quantity; 
          
          if (item.quantity < soldQuantity && soldQuantity > 0) {
            throw new Error(`Cannot reduce quantity of ${batch.batch_number} below ${soldQuantity} (quantity already sold).`);
          }

          const newBatchQty = batch.quantity - oldItem.quantity + item.quantity;

          db.prepare(
            `UPDATE batches SET batch_number=?, mfg_date=?, expiry_date=?, purchase_rate=?, selling_rate=?, mrp=?, quantity=? WHERE id=?`
          ).run(item.batch_number, item.mfg_date || '', item.expiry_date, item.purchase_rate, item.selling_rate || 0, item.mrp || 0, newBatchQty, item.batch_id);

          db.prepare(
            `UPDATE purchase_items SET quantity=?, purchase_rate=?, selling_rate=?, mrp=? WHERE purchase_id=? AND batch_id=?`
          ).run(item.quantity, item.purchase_rate, item.selling_rate || 0, item.mrp || 0, purchaseId, item.batch_id);

          total += (item.quantity * item.purchase_rate);
        }
      }
    }

    // 4. Update the Purchase record
    const purchaseInfo = db.prepare('SELECT total_amount, amount_paid FROM purchases WHERE id=?').get(purchaseId);
    
    db.prepare(
      `UPDATE purchases SET supplier_id = ?, invoice_number = ?, notes = ?, purchase_date = ?, total_amount = ?, amount_paid = ? WHERE id = ?`
    ).run(supplier_id, invoice_number || '', notes || '', purchase_date || new Date().toISOString().slice(0, 10), total, amount_paid !== undefined ? amount_paid : purchaseInfo.amount_paid, purchaseId);

    return { id: purchaseId, total_amount: total };
  });

  try {
    const result = txn();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/purchases/:id', (req, res) => {
  const txn = db.transaction(() => {
    // Check if any items from this purchase have been sold
    // We do this by checking if current batch quantity < purchase quantity
    // This assumes batch numbers are unique per purchase or handled correctly
    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(req.params.id);
    if (items.length === 0) {
      db.prepare('DELETE FROM purchases WHERE id = ?').run(req.params.id);
      return { success: true };
    }

    const checkBatch = db.prepare('SELECT quantity FROM batches WHERE id = ?');
    const updateBatch = db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?');
    const deleteBatch = db.prepare('DELETE FROM batches WHERE id = ?');

    for (const item of items) {
      const batch = checkBatch.get(item.batch_id);
      if (!batch) continue; // Batch already deleted?
      
      // If we sold any, current quantity will be less than purchased quantity
      // Logic: If I bought 10, and sold 2, I have 8. 
      // If I try to delete purchase, I need to remove 10. 8 - 10 = -2.
      // So if quantity < item.quantity, we cannot delete.
      if (batch.quantity < item.quantity) {
        throw new Error(`Cannot delete purchase: Batch ${item.batch_id} has been sold partially. Current: ${batch.quantity}, Purchased: ${item.quantity}`);
      }
      
      // Reduce stock
      updateBatch.run(item.quantity, item.batch_id);
      
      // If stock becomes 0, check if we should delete the batch?
      // For now, let's keep it simple: if 0, maybe delete it if it was created by this purchase?
      // Since we don't track "created_by_purchase_id" on batches directly (only via items), let's just leave it with 0 quantity or delete if 0.
      const newBatch = checkBatch.get(item.batch_id);
      if (newBatch && newBatch.quantity === 0) {
        // Optional: delete batch if empty to keep clean
        // But need to ensure it's not used in other purchases (unlikely for batch)
        deleteBatch.run(item.batch_id);
      }
    }

    db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(req.params.id);
    db.prepare('DELETE FROM purchases WHERE id = ?').run(req.params.id);
    return { success: true };
  });

  try {
    const result = txn();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============ DASHBOARD / REPORTS ============
app.get('/api/dashboard', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const todaySales = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM invoices WHERE date(created_at) = ?`).get(today);
  const todayCash = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE date(created_at) = ? AND payment_mode = 'Cash'`).get(today);
  const todayUPI = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE date(created_at) = ? AND payment_mode = 'UPI'`).get(today);
  const todayCredit = db.prepare(`SELECT COALESCE(SUM(credit_amount), 0) as total FROM invoices WHERE date(created_at) = ? AND credit_amount > 0`).get(today);
  
  const monthlySales = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE date(created_at) >= ?`).get(monthStart);
  const monthlyPurchases = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE date(created_at) >= ?`).get(monthStart);

  const lowStockThreshold = db.prepare("SELECT value FROM settings WHERE key = 'low_stock_threshold'").get();
  const threshold = lowStockThreshold ? parseInt(lowStockThreshold.value) : 10;
  
  const lowStock = db.prepare(`SELECT m.brand_name, m.company_name, COALESCE(SUM(b.quantity), 0) as total_stock 
    FROM medicines m LEFT JOIN batches b ON b.medicine_id = m.id WHERE m.is_active = 1 
    GROUP BY m.id HAVING total_stock <= ? AND total_stock >= 0 ORDER BY total_stock LIMIT 10`).all(threshold);

  const expiryAlertDays = db.prepare("SELECT value FROM settings WHERE key = 'expiry_alert_days'").get();
  const days = expiryAlertDays ? parseInt(expiryAlertDays.value) : 90;
  
  const expiring = db.prepare(`SELECT b.*, m.brand_name, m.company_name FROM batches b 
    JOIN medicines m ON b.medicine_id = m.id 
    WHERE b.expiry_date <= date('now', '+' || ? || ' days') AND b.quantity > 0 
    ORDER BY b.expiry_date LIMIT 10`).all(days);

  const recentInvoices = db.prepare(`SELECT i.*, c.name as customer_name FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id ORDER BY i.created_at DESC LIMIT 10`).all();

  const totalOutstanding = db.prepare(`SELECT COALESCE(SUM(credit_balance), 0) as total FROM customers WHERE credit_balance > 0`).get();

  // Fast moving - top 10 medicines by quantity sold this month
  const fastMoving = db.prepare(`SELECT m.brand_name, m.company_name, SUM(ii.quantity) as total_sold
    FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id JOIN medicines m ON ii.medicine_id = m.id
    WHERE date(i.created_at) >= ? GROUP BY ii.medicine_id ORDER BY total_sold DESC LIMIT 10`).all(monthStart);

  res.json({
    today: { total: todaySales.total, count: todaySales.count, cash: todayCash.total, upi: todayUPI.total, credit: todayCredit.total },
    monthly: { sales: monthlySales.total, purchases: monthlyPurchases.total, profit: monthlySales.total - monthlyPurchases.total },
    lowStock,
    expiring,
    recentInvoices,
    totalOutstanding: totalOutstanding.total,
    fastMoving
  });
});

// Reports
app.get('/api/reports/sales', (req, res) => {
  const { from, to, group_by } = req.query;
  let dateGroup = "date(created_at)";
  if (group_by === 'month') dateGroup = "strftime('%Y-%m', created_at)";
  
  let query = `SELECT ${dateGroup} as period, SUM(total_amount) as total, COUNT(*) as count,
    SUM(gst_amount) as gst,
    SUM(CASE WHEN payment_mode='Cash' THEN total_amount ELSE 0 END) as cash,
    SUM(CASE WHEN payment_mode='UPI' THEN total_amount ELSE 0 END) as upi,
    SUM(credit_amount) as credit
    FROM invoices WHERE 1=1`;
  const params = [];
  if (from) { query += ' AND date(created_at) >= ?'; params.push(from); }
  if (to) { query += ' AND date(created_at) <= ?'; params.push(to); }
  query += ` GROUP BY ${dateGroup} ORDER BY period DESC`;
  res.json(db.prepare(query).all(...params));
});

app.get('/api/reports/profit', (req, res) => {
  const { from, to } = req.query;
  let salesQuery = `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE 1=1`;
  let purchaseQuery = `SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE 1=1`;
  const params1 = [], params2 = [];
  if (from) { salesQuery += ' AND date(created_at) >= ?'; purchaseQuery += ' AND date(created_at) >= ?'; params1.push(from); params2.push(from); }
  if (to) { salesQuery += ' AND date(created_at) <= ?'; purchaseQuery += ' AND date(created_at) <= ?'; params1.push(to); params2.push(to); }
  const sales = db.prepare(salesQuery).get(...params1);
  const purchases = db.prepare(purchaseQuery).get(...params2);
  res.json({ sales: sales.total, purchases: purchases.total, profit: sales.total - purchases.total });
});

app.get('/api/reports/outstanding', (req, res) => {
  const rows = db.prepare(`SELECT c.*, 
    (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id AND credit_amount > 0) as credit_invoices
    FROM customers c WHERE c.credit_balance > 0 ORDER BY c.credit_balance DESC`).all();
  res.json(rows);
});

// --- Get Supplier Purchase Payment Report ---
app.get('/api/reports/supplier-payments', (req, res) => {
  try {
    const { from, to } = req.query;
    
    let query = `
      SELECT 
        s.id as SupplierId,
        s.name as SupplierName,
        SUM(p.total_amount) as TotalPurchaseAmount,
        SUM(COALESCE(p.amount_paid, 0)) as AmountPaid,
        SUM(p.total_amount) - SUM(COALESCE(p.amount_paid, 0)) as RemainingAmount,
        CASE 
          WHEN SUM(p.total_amount) = 0 THEN 'Paid'
          WHEN SUM(COALESCE(p.amount_paid, 0)) >= SUM(p.total_amount) THEN 'Paid'
          WHEN SUM(COALESCE(p.amount_paid, 0)) > 0 THEN 'Partial'
          ELSE 'Unpaid'
        END as PaymentStatus,
        MAX(p.purchase_date) as LastPaymentDate
      FROM suppliers s
      JOIN purchases p ON s.id = p.supplier_id
    `;
    
    let params = [];
    if (from && to) {
      query += ` WHERE date(p.purchase_date) BETWEEN date(?) AND date(?) `;
      params.push(from, to);
    }
    
    query += ` GROUP BY s.id ORDER BY RemainingAmount DESC`;
    
    const reportData = db.prepare(query).all(...params);
    res.json(reportData);
  } catch (err) {
    console.error("Error fetching supplier payments report: ", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Get Schedule H1 Register Report ---
app.get('/api/reports/h1-register', (req, res) => {
  try {
    const { from, to, medicine_search, doctor_search, patient_search } = req.query;
    
    let query = `
      SELECT 
        i.id as invoice_id,
        i.created_at as supply_date,
        h.patient_name,
        h.patient_address,
        h.doctor_name,
        h.doctor_address,
        h.doctor_reg_no,
        h.prescription_no,
        m.brand_name as medicine_name,
        ii.quantity as quantity_supplied,
        m.company_name as manufacturer_name,
        b.batch_number,
        b.expiry_date
      FROM invoice_h1_details h
      JOIN invoices i ON h.invoice_id = i.id
      JOIN invoice_items ii ON i.id = ii.invoice_id
      JOIN medicines m ON ii.medicine_id = m.id
      JOIN batches b ON ii.batch_id = b.id
      WHERE m.is_h1 = 1
    `;
    
    let params = [];
    if (from) {
      query += ` AND date(i.created_at) >= ?`;
      params.push(from);
    }
    if (to) {
      query += ` AND date(i.created_at) <= ?`;
      params.push(to);
    }
    if (medicine_search) {
      query += ` AND m.brand_name LIKE ?`;
      params.push(`%${medicine_search}%`);
    }
    if (doctor_search) {
      query += ` AND h.doctor_name LIKE ?`;
      params.push(`%${doctor_search}%`);
    }
    if (patient_search) {
      query += ` AND h.patient_name LIKE ?`;
      params.push(`%${patient_search}%`);
    }
    
    query += ` ORDER BY i.created_at DESC, i.id DESC`;
    
    const reportData = db.prepare(query).all(...params);
    res.json(reportData);
  } catch (err) {
    console.error("Error fetching H1 register: ", err);
    res.status(500).json({ error: err.message });
  }
});

// Pay Supplier
app.post('/api/suppliers/:id/pay', (req, res) => {
  const { amount, payment_mode, payment_date, notes } = req.body;
  const supplierId = req.params.id;
  
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  
  const txn = db.transaction(() => {
    db.prepare(`INSERT INTO supplier_payments (supplier_id, amount, payment_mode, payment_date, notes) VALUES (?, ?, ?, ?, ?)`).run(supplierId, amount, payment_mode || 'Cash', payment_date || new Date().toISOString().slice(0, 10), notes || '');
    
    const unpaidPurchases = db.prepare(`SELECT id, total_amount, amount_paid FROM purchases WHERE supplier_id = ? AND total_amount > COALESCE(amount_paid, 0) ORDER BY purchase_date ASC`).all(supplierId);
    
    let remainingToApply = amount;
    for (const p of unpaidPurchases) {
      if (remainingToApply <= 0) break;
      const amountNeeded = p.total_amount - (p.amount_paid || 0);
      const applyAmount = Math.min(amountNeeded, remainingToApply);
      
      db.prepare(`UPDATE purchases SET amount_paid = COALESCE(amount_paid, 0) + ? WHERE id = ?`).run(applyAmount, p.id);
      remainingToApply -= applyAmount;
    }
    return { success: true };
  });
  
  try {
    res.json(txn());
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Supplier Payment History
app.get('/api/suppliers/:id/payments', (req, res) => {
  const rows = db.prepare(`SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY date(payment_date) DESC, id DESC`).all(req.params.id);
  res.json(rows);
});

// Pay off credit
app.post('/api/customers/:id/pay-credit', (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  const customer = db.prepare('SELECT credit_balance FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (amount > customer.credit_balance) return res.status(400).json({ error: 'Amount exceeds outstanding balance' });
  db.prepare('UPDATE customers SET credit_balance = credit_balance - ? WHERE id = ?').run(amount, req.params.id);
  res.json({ success: true, new_balance: customer.credit_balance - amount });
});

// Daily sales chart data for last 7 days
app.get('/api/reports/daily-chart', (req, res) => {
  const rows = db.prepare(`
    WITH RECURSIVE dates(d) AS (
      SELECT date('now', '-6 days')
      UNION ALL
      SELECT date(d, '+1 day') FROM dates WHERE d < date('now')
    )
    SELECT dates.d as date, COALESCE(SUM(i.total_amount), 0) as total, COUNT(i.id) as count
    FROM dates LEFT JOIN invoices i ON date(i.created_at) = dates.d
    GROUP BY dates.d ORDER BY dates.d
  `).all();
  res.json(rows);
});

// Non-Moving Medicines
app.get('/api/reports/non-moving', (req, res) => {
  const { days = 60, category, supplier_id } = req.query;
  const thresholdDays = parseInt(days, 10);
  
  let query = `
    SELECT 
      b.id as batch_id,
      b.batch_number, 
      b.quantity as stock, 
      b.expiry_date, 
      b.mrp,
      b.selling_rate,
      b.purchase_rate,
      m.brand_name as medicine_name, 
      m.drug_group as category,
      s.name as supplier_name,
      MIN(p.purchase_date) as purchase_date,
      MAX(i.created_at) as last_sold_date
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    LEFT JOIN purchase_items pi ON pi.batch_id = b.id
    LEFT JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN invoice_items ii ON ii.batch_id = b.id
    LEFT JOIN invoices i ON ii.invoice_id = i.id
    WHERE b.quantity > 0 
  `;
  
  const params = [];
  
  if (category) {
    query += ` AND m.drug_group = ?`;
    params.push(category);
  }
  
  if (supplier_id) {
    query += ` AND b.supplier_id = ?`;
    params.push(supplier_id);
  }
  
  query += ` GROUP BY b.id HAVING (last_sold_date IS NULL AND date(b.created_at) <= date('now', '-' || ? || ' days')) OR (last_sold_date IS NOT NULL AND date(last_sold_date) <= date('now', '-' || ? || ' days'))`;
  
  params.push(thresholdDays, thresholdDays);
  
  query += ` ORDER BY last_sold_date ASC NULLS FIRST`;

  res.json(db.prepare(query).all(...params));
});

// Write off stock for non-moving medicines
app.post('/api/batches/:id/write-off', (req, res) => {
  db.prepare('UPDATE batches SET quantity = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Update batch discount (selling_rate)
app.put('/api/batches/:id/discount', (req, res) => {
  const { selling_rate } = req.body;
  if (!selling_rate) return res.status(400).json({ error: 'selling_rate is required' });
  db.prepare('UPDATE batches SET selling_rate = ? WHERE id = ?').run(selling_rate, req.params.id);
  res.json({ success: true });
});

// ============ ENCRYPTION DEMO (ISE Activity — Data Encryption Course) ============
// This endpoint demonstrates live AES-256-CBC encryption as implemented in this app.
// It shows plaintext vs ciphertext, IV, key details, HMAC and decryption verification.
app.post('/api/encryption-demo', (req, res) => {
  const { plaintext } = req.body;
  if (!plaintext) return res.status(400).json({ error: 'plaintext is required' });
  const trace = encryptionTrace(plaintext);
  res.json(trace);
});

// Show raw DB value vs decrypted value for a customer (for demo / presentation)
app.get('/api/encryption-demo/customer/:id', (req, res) => {
  const raw = db.prepare('SELECT id, name, phone, address FROM customers WHERE id = ?').get(req.params.id);
  if (!raw) return res.status(404).json({ error: 'Customer not found' });
  const decrypted = decryptCustomer(raw);
  const phoneHmac = generateHMAC(raw.phone);
  res.json({
    demonstration: 'AES-256-CBC Encryption in Action',
    customer_id: raw.id,
    name: raw.name,
    phone: {
      raw_in_database:  raw.phone,
      decrypted_value:  decrypted.phone,
      hmac_signature:   phoneHmac,
      is_encrypted:     raw.phone.includes(':'),
    },
    address: {
      raw_in_database:  raw.address,
      decrypted_value:  decrypted.address,
      is_encrypted:     raw.address.includes(':'),
    },
    security_proof: {
      what_attacker_sees:   raw.phone,
      what_application_shows: decrypted.phone,
      algorithm: 'AES-256-CBC',
      key_length: '256-bit',
    }
  });
});

// Error Handler Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Shree Samarth Medical API running on port ${PORT}`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. Assuming server is already running.`);
  } else {
    console.error('Server error:', e);
  }
});
