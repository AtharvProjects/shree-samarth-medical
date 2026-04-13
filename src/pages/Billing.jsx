import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../services/api';
import { useToast } from '../App';
import { Search, Plus, Trash2, Printer, FileText, Send, X, UserPlus, Stethoscope, RefreshCw } from 'lucide-react';
import { generateInvoicePDF, sendInvoiceViaWhatsApp } from '../services/pdf';
import { calculateLineTotal, calculateGstFromTotal } from '../utils/billing';
import Fuse from 'fuse.js';

export default function Billing() {
    const [medicines, setMedicines] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [items, setItems] = useState([]);
    const [medSearch, setMedSearch] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [discount, setDiscount] = useState(0);
    const [custSearch, setCustSearch] = useState('');
    const [docSearch, setDocSearch] = useState('');
    const [showCustDropdown, setShowCustDropdown] = useState(false);
    const [showDocDropdown, setShowDocDropdown] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
    const [billSaved, setBillSaved] = useState(false);
    const [reviewTimer, setReviewTimer] = useState(0);
    const [isGstEnabled, setIsGstEnabled] = useState(true);
    const timerRef = useRef(null);
    const newBillBtnRef = useRef(null);

  const [showNewCust, setShowNewCust] = useState(false);
  const [showNewDoc, setShowNewDoc] = useState(false);
    const [lastInvoice, setLastInvoice] = useState(null);
    const [settings, setSettings] = useState({});
    const [showH1Modal, setShowH1Modal] = useState(false);
    const [h1Details, setH1Details] = useState({ patient_name: '', patient_address: '', doctor_name: '', doctor_address: '', doctor_reg_no: '', prescription_no: '' });
    const searchRef = useRef();
  const showToast = useToast();

  useEffect(() => {
    api.getMedicines().then(setMedicines);
    api.getCustomers().then(setCustomers);
    api.getDoctors().then(setDoctors);
    api.getSettings().then(setSettings).catch(err => console.error('Failed to load settings', err));
  }, []);

  // Timer logic for auto-focus and countdown
  useEffect(() => {
    if (billSaved && newBillBtnRef.current) {
        newBillBtnRef.current.focus();
    }
  }, [billSaved]);

  const medFuse = useMemo(() => new Fuse(medicines, {
    keys: ['brand_name', 'generic_name', 'company_name'],
    threshold: 0.3,
    distance: 100
  }), [medicines]);

  const custFuse = useMemo(() => new Fuse(customers, {
    keys: ['name', 'phone'],
    threshold: 0.3
  }), [customers]);

  useEffect(() => {
    if (!medSearch.trim()) { setSuggestions([]); return; }
    const results = medFuse.search(medSearch);
    const filtered = results.map(r => r.item).slice(0, 10);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  }, [medSearch, medFuse]);

  const filteredCustomers = useMemo(() => {
    if (!custSearch.trim()) return customers;
    return custFuse.search(custSearch).map(r => r.item);
  }, [custSearch, customers, custFuse]);

  const filteredDoctors = docSearch ? doctors.filter(d => d.name.toLowerCase().includes(docSearch.toLowerCase())) : doctors;

    const getEffectivePrice = (item) => {
      const tps = item.tablets_per_strip || 10;
      const isTabletLike = ['Tablet','Capsule','Strip'].includes(item.unit_category);
      return isTabletLike ? (item.unit_price / tps) : item.unit_price;
    };

    const subtotal = items.reduce((sum, item) => sum + calculateLineTotal(item.quantity, getEffectivePrice(item), item.discount_percent), 0);
    const gstAmount = isGstEnabled 
      ? items.reduce((sum, item) => {
          const lineTotal = calculateLineTotal(item.quantity, getEffectivePrice(item), item.discount_percent);
          return sum + calculateGstFromTotal(lineTotal, item.gst_percent);
        }, 0)
      : 0;
    const totalAmount = Math.max(0, Math.round((subtotal + gstAmount - discount) * 100) / 100);

  const addMedicine = async (med) => {
    try {
      // Fetch full medicine details to get batches
      const fullMed = await api.getMedicine(med.id);
      const batches = (fullMed.batches || []).filter(b => b.quantity > 0);

      if (batches.length === 0) {
        showToast(`Out of stock: ${med.brand_name}`, 'error');
        return;
      }

      // FIFO: Auto-select batch with nearest expiry
      const batch = batches[0];
      const tabletsPerStrip = fullMed.tablets_per_strip || med.tablets_per_strip || 10;

      setItems(prev => {
        // Check if this batch is already in the list
        const existingIdx = prev.findIndex(i => i.id === med.id && i.batch_id === batch.id);
        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          if (existing.quantity >= existing.max_qty) {
            showToast('Max stock limit reached for this batch', 'warning');
            return prev;
          }
          const newItems = [...prev];
          newItems[existingIdx] = { ...existing, quantity: existing.quantity + 1 };
          return newItems;
        }

        // Add new item
        return [...prev, {
          id: med.id,
          brand_name: med.brand_name,
          company_name: med.company_name,
          batch_id: batch.id,
          batch_number: batch.batch_number,
          expiry_date: batch.expiry_date,
          quantity: 1,
          unit_price: batch.mrp,
          mrp: batch.mrp,
          max_qty: batch.quantity,
          discount_percent: 0,
          gst_percent: med.gst_percent || 12,
          is_h1: med.is_h1,
          tablets_per_strip: tabletsPerStrip,
          unit_category: fullMed.unit_category || med.unit_category || 'Tablet',
        }];
      });

      if (med.is_h1) {
        setH1Details(prev => ({
          ...prev,
          patient_name: selectedCustomer?.name || prev.patient_name || '',
          patient_address: selectedCustomer?.address || prev.patient_address || '',
          doctor_name: selectedDoctor?.name || prev.doctor_name || '',
          doctor_address: selectedDoctor?.address || prev.doctor_address || '',
        }));
        setShowH1Modal(true);
      }

      setMedSearch('');
      setSuggestions([]);
      if (searchRef.current) searchRef.current.focus();

    } catch (err) {
      console.error(err);
      showToast('Failed to load batch info', 'error');
    }
  };

  const updateItem = (index, field, value) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const resetBilling = () => {
    setItems([]);
    setCustSearch('');
    setSelectedCustomer(null);
    setDocSearch('');
    setSelectedDoctor(null);
    setPaymentMode('Cash');
    setDiscount(0);
    setBillSaved(false);
    setLastInvoice(null);
    setReviewTimer(0);
    setH1Details({ patient_name: '', patient_address: '', doctor_name: '', doctor_address: '', doctor_reg_no: '', prescription_no: '' });
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(() => {
      if (searchRef.current) searchRef.current.focus();
    }, 100);
  };

  const handleSave = async () => {
    if (items.length === 0 || billSaved) return;
    if (items.some(i => !i.quantity || i.quantity <= 0)) {
      showToast('All items must have a valid quantity greater than 0', 'error');
      return;
    }
    if (items.some(i => i.quantity > i.max_qty)) {
      showToast('Some items exceed available stock limits. Please fix quantities before saving.', 'error');
      return;
    }
    setSaving(true);
    try {
      const invoiceData = {
        customer_id: selectedCustomer?.id || null,
        doctor_id: selectedDoctor?.id || null,
        payment_mode: paymentMode,
        is_gst_enabled: isGstEnabled,
        discount_amount: discount,
        items: items.map(item => {
          const tps = item.tablets_per_strip || 10;
          const isTabletLike = ['Tablet','Capsule','Strip'].includes(item.unit_category);
          const effectivePrice = isTabletLike ? (item.unit_price / tps) : item.unit_price;
          return {
            medicine_id: item.id,
            batch_id: item.batch_id,
            quantity: item.quantity,
            unit_price: effectivePrice,  // Always per-unit (per-tablet) price
            discount_percent: item.discount_percent,
            gst_percent: item.gst_percent,
            tablets_per_strip: tps,
          };
        }),
        h1_details: items.some(i => i.is_h1) ? h1Details : null
      };

      if (items.some(i => i.is_h1)) {
        const d = h1Details;
        if (!d.patient_name || !d.doctor_name || !d.doctor_reg_no || !d.prescription_no) {
          setShowH1Modal(true);
          throw new Error('Please fill all mandatory H1 drug details');
        }
      }

      const savedInvoice = await api.createInvoice(invoiceData);
      setLastInvoice(savedInvoice);
      setBillSaved(true);
      showToast('Invoice saved successfully');
      
      // Dispatch event to refresh header stats
      window.dispatchEvent(new Event('invoice-saved'));
      
      // Start 20s review timer
      setReviewTimer(20);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setReviewTimer(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to save invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if a modal is open
      if (showNewCust || showNewDoc) return;

      if (e.key === 'Enter') {
        const activeElement = document.activeElement;
        
        if (billSaved) {
          // If bill is saved, Enter resets for new bill
          e.preventDefault();
          resetBilling();
        } else if (items.length > 0 && !saving) {
          // If in medicine search and there is text, let the input's own onKeyDown handle adding medicine
          if (activeElement === searchRef.current && medSearch.trim()) {
            return;
          }
          
          // Trigger save on Enter
          e.preventDefault();
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [billSaved, items, saving, medSearch, showNewCust, showNewDoc]);

  const handlePrint = () => {
    if (!lastInvoice) return;
    try {
      generateInvoicePDF(lastInvoice, settings || {}, 'print');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate print preview', 'error');
    }
  };

  const handlePDF = () => {
    if (!lastInvoice) return;
    try {
      generateInvoicePDF(lastInvoice, settings || {}, 'download');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate PDF', 'error');
    }
  };

  const handleWhatsApp = async () => {
    if (!lastInvoice) return;
    const phone = lastInvoice.customer_phone || selectedCustomer?.phone || '';
    if (!phone) {
      showToast('No customer phone number available', 'warning');
      return;
    }

    setSendingWhatsApp(true);
    try {
      await sendInvoiceViaWhatsApp(lastInvoice, settings);
      showToast('Invoice sent via WhatsApp successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to send WhatsApp message. Ensure WhatsApp is connected in Settings.', 'error');
    } finally {
      setSendingWhatsApp(false);
    }
  };


    return (
      <div className="billing-layout">
        <div className="billing-left-col" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'visible' }}>
            {billSaved && (
              <div className="glass-card mb-4" style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'slideDown 0.3s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <RefreshCw size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#166534', fontSize: 16 }}>Bill Generated Successfully!</div>
                    <div style={{ fontSize: 13, color: '#166534', opacity: 0.8 }}>Invoice #{lastInvoice?.invoice_number} | Available for {reviewTimer}s</div>
                  </div>
                </div>
                <button className="btn btn-success" onClick={resetBilling} style={{ height: 36, padding: '0 16px' }}>
                  New Bill (Enter)
                </button>
              </div>
            )}
            <div className="glass-card mb-4" style={{ position: 'relative', zIndex: 100, flexShrink: 0 }}>
              <div className="search-box" style={{ maxWidth: '100%' }}>
                <Search />
                <input 
                  ref={searchRef} 
                  className="form-input" 
                  placeholder={billSaved ? "Bill Saved - Press Enter for New Bill" : "Type medicine name to add..."} 
                  value={medSearch} 
                  onChange={e => setMedSearch(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === 'Enter' && suggestions.length > 0) {
                      addMedicine(suggestions[0]);
                    }
                  }}
                  onFocus={() => !billSaved && medSearch && setShowSuggestions(true)} 
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} 
                  disabled={billSaved}
                  autoFocus 
                />
              {showSuggestions && (
                <div className="autocomplete-dropdown">
                  {suggestions.map(m => (
                    <div key={m.id} className="autocomplete-item" onMouseDown={() => addMedicine(m)}>
                      <div style={{ fontWeight: 500 }}>{m.brand_name}</div>
                      <div className="item-subtitle">
                        {m.company_name} | Stock: {m.total_stock} | GST: {m.gst_percent}%
                        {['Tablet','Capsule','Strip'].includes(m.unit_category) && m.tablets_per_strip > 1 && (
                          <span style={{ marginLeft: 6, color: 'var(--accent-primary)', fontWeight: 600 }}>1×{m.tablets_per_strip} strip</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 10 }}>
          <div className="glass-card">
            {items.length === 0 ? <div className="empty-state"><p>Search and add medicines above</p></div> : (
              <table className="data-table">
                <thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th style={{ width: 80 }}>Strip Info</th><th style={{ width: 80 }}>Qty (Tabs)</th><th>Rate/Strip</th><th>Per Tab</th><th style={{ width: 70 }}>Disc%</th><th>GST%</th><th className="text-right">Total</th><th></th></tr></thead>
                <tbody>
                  {items.map((item, idx) => {
                    const tps = item.tablets_per_strip || 10;
                    const isTabletLike = ['Tablet','Capsule','Strip'].includes(item.unit_category);
                    const perTabPrice = isTabletLike ? (item.unit_price / tps) : item.unit_price;
                    const strips = isTabletLike ? Math.floor(item.quantity / tps) : 0;
                    const extraTabs = isTabletLike ? (item.quantity % tps) : 0;
                    const stripLabel = isTabletLike
                      ? (strips > 0 && extraTabs > 0
                          ? `${strips} strip${strips > 1 ? 's' : ''} + ${extraTabs} tab${extraTabs > 1 ? 's' : ''}`
                          : strips > 0
                          ? `${strips} strip${strips > 1 ? 's' : ''}`
                          : `${extraTabs} tab${extraTabs !== 1 ? 's' : ''}`)
                      : '';
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500, fontSize: 12.5 }}>{item.brand_name}<br/><span className="text-muted" style={{ fontSize: 11 }}>{item.company_name}</span></td>
                        <td style={{ fontSize: 12 }}>{item.batch_number}</td>
                        <td style={{ fontSize: 12 }}>{item.expiry_date}</td>
                        <td style={{ fontSize: 11 }}>
                          {isTabletLike ? (
                            <span className="badge badge-blue" style={{ fontSize: 10 }}>1×{tps}</span>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td>
                          <input
                            type="number"
                            className={`form-input ${item.quantity > item.max_qty || item.quantity <= 0 ? 'input-error' : ''}`}
                            style={{ width: 65, padding: '4px 6px', textAlign: 'center' }}
                            value={item.quantity}
                            onChange={e => {
                              const val = e.target.value;
                              updateItem(idx, 'quantity', val === '' ? '' : parseInt(val));
                            }}
                            min={1}
                            max={item.max_qty}
                            disabled={billSaved}
                            title={isTabletLike ? `Enter number of tablets (1 strip = ${tps} tabs)` : 'Quantity'}
                          />
                          {isTabletLike && item.quantity > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--accent-primary)', marginTop: 2, whiteSpace: 'nowrap' }}>{stripLabel}</div>
                          )}
                          {item.quantity > item.max_qty && (
                            <div style={{ fontSize: 10, color: 'var(--accent-rose)', marginTop: 4, whiteSpace: 'normal', lineHeight: 1.2, width: 80 }}>
                              Max {item.max_qty} in stock
                            </div>
                          )}
                          {item.quantity <= 0 && (
                            <div style={{ fontSize: 10, color: 'var(--accent-rose)', marginTop: 4, whiteSpace: 'normal', lineHeight: 1.2, width: 80 }}>
                              Min 1 required
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 13 }}>₹{item.unit_price.toFixed(2)}{isTabletLike && <span className="text-muted" style={{ fontSize: 10 }}>/strip</span>}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {isTabletLike ? `₹${perTabPrice.toFixed(2)}` : '—'}
                        </td>
                        <td><input type="number" className="form-input" style={{ width: 60, padding: '4px 6px', textAlign: 'center' }} value={item.discount_percent} onChange={e => updateItem(idx, 'discount_percent', Number(e.target.value) || 0)} min={0} max={100} disabled={billSaved} /></td>
                        <td>{item.gst_percent}%</td>
                        <td className="text-right" style={{ fontWeight: 600 }}>₹{(item.quantity * perTabPrice * (1 - item.discount_percent / 100)).toFixed(2)}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => removeItem(idx)} style={{ padding: '3px 6px' }} disabled={billSaved}><Trash2 size={13}/></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          </div>
        </div>
          <div className="billing-summary" style={{ gap: 16 }}>
              <div className="glass-card" style={{ position: 'relative', zIndex: 20 }}>
                <div className="flex justify-between items-center mb-4"><span className="card-title" style={{ margin: 0 }}>Customer</span><button className="btn btn-secondary btn-sm" onClick={() => setShowNewCust(true)} disabled={billSaved}><UserPlus size={13} fill="currentColor" fillOpacity={0.2}/></button></div>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" placeholder="Search customer..." value={selectedCustomer ? selectedCustomer.name : custSearch} onChange={e => { setCustSearch(e.target.value); setSelectedCustomer(null); setShowCustDropdown(true); }} onFocus={() => !billSaved && setShowCustDropdown(true)} onBlur={() => setTimeout(() => setShowCustDropdown(false), 200)} disabled={billSaved} />
                  {selectedCustomer && !billSaved && <button style={{ position: 'absolute', right: 8, top: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => { setSelectedCustomer(null); setCustSearch(''); }}><X size={16}/></button>}
                  {showCustDropdown && !selectedCustomer && !billSaved && (
                    <div className="autocomplete-dropdown">
                      {filteredCustomers.slice(0, 8).map(c => <div key={c.id} className="autocomplete-item" onMouseDown={() => { setSelectedCustomer(c); setCustSearch(''); setShowCustDropdown(false); }}>{c.name} {c.phone && <span className="text-muted"> - {c.phone}</span>}{c.credit_balance > 0 && <span className="badge badge-red" style={{ marginLeft: 6 }}>₹{c.credit_balance}</span>}</div>)}
                    </div>
                  )}
                </div>
              </div>
              <div className="glass-card" style={{ position: 'relative', zIndex: 15 }}>
                <div className="flex justify-between items-center mb-4"><span className="card-title" style={{ margin: 0 }}>Doctor</span><button className="btn btn-secondary btn-sm" onClick={() => setShowNewDoc(true)} disabled={billSaved}><Stethoscope size={13} fill="currentColor" fillOpacity={0.2}/></button></div>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" placeholder="Search doctor..." value={selectedDoctor ? selectedDoctor.name : docSearch} onChange={e => { setDocSearch(e.target.value); setSelectedDoctor(null); setShowDocDropdown(true); }} onFocus={() => !billSaved && setShowDocDropdown(true)} onBlur={() => setTimeout(() => setShowDocDropdown(false), 200)} disabled={billSaved} />
                  {selectedDoctor && !billSaved && <button style={{ position: 'absolute', right: 8, top: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => { setSelectedDoctor(null); setDocSearch(''); }}><X size={16}/></button>}
                  {showDocDropdown && !selectedDoctor && !billSaved && (
                    <div className="autocomplete-dropdown">
                      {filteredDoctors.slice(0, 8).map(d => <div key={d.id} className="autocomplete-item" onMouseDown={() => { setSelectedDoctor(d); setDocSearch(''); setShowDocDropdown(false); }}>Dr. {d.name} <span className="text-muted">{d.hospital && ` - ${d.hospital}`}</span></div>)}
                    </div>
                  )}
                </div>
              </div>
            <div className="glass-card">
              <div className="card-title">Payment Mode</div>
              <div className="flex gap-2">{['Cash', 'UPI', 'Udhaari'].map(mode => <button key={mode} className={`btn ${paymentMode === mode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => !billSaved && setPaymentMode(mode)} disabled={billSaved} style={{ flex: 1 }}>{mode}</button>)}</div>
            </div>

            <div className="glass-card" style={{ flex: 1 }}>
              <div className="flex justify-between items-center mb-2">
                <div className="card-title" style={{ margin: 0 }}>Bill Summary</div>
                <button 
                  className={`btn btn-sm ${isGstEnabled ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => !billSaved && setIsGstEnabled(!isGstEnabled)}
                  disabled={billSaved}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  {isGstEnabled ? 'GST Enabled' : 'GST Disabled'}
                </button>
              </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
                <div className="flex justify-between"><span className="text-secondary">Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-secondary">GST</span><span>₹{gstAmount.toFixed(2)}</span></div>
                <div className="flex justify-between items-center"><span className="text-secondary">Discount</span><input type="number" className="form-input" style={{ width: 80, padding: '3px 8px', textAlign: 'right' }} value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)} min={0} disabled={billSaved} /></div>

              <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 8, marginTop: 4 }}><div className="flex justify-between" style={{ fontSize: 18, fontWeight: 700 }}><span>Total</span><span>₹{totalAmount.toFixed(2)}</span></div></div>
            </div>
        </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {billSaved ? (
              <button 
                ref={newBillBtnRef}
                className="btn btn-primary" 
                onClick={resetBilling} 
                style={{ flex: 1, height: 45, fontSize: 16, fontWeight: 600, border: '2px solid #22c55e', boxShadow: '0 0 15px rgba(34, 197, 94, 0.2)' }}
              >
                {reviewTimer > 0 ? `New Bill (${reviewTimer}s)` : 'New Bill (Enter)'}
              </button>
            ) : (
              <button 
                className="btn btn-success" 
                onClick={handleSave} 
                disabled={saving || items.length === 0} 
                style={{ flex: 1, height: 45, fontSize: 16, fontWeight: 600 }}
              >
                {saving ? 'Saving...' : 'Save Bill (Enter)'}
              </button>
            )}
          </div>

        {lastInvoice && (
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={handlePrint} style={{ flex: 1 }}><Printer size={14} fill="currentColor" fillOpacity={0.2}/> Print</button>
            <button className="btn btn-secondary btn-sm" onClick={handlePDF} style={{ flex: 1 }}><FileText size={14} fill="currentColor" fillOpacity={0.2}/> PDF</button>
            <button className="btn btn-success btn-sm" onClick={handleWhatsApp} style={{ flex: 1 }} disabled={sendingWhatsApp}>
              {sendingWhatsApp ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} fill="currentColor" fillOpacity={0.2} />}
              WhatsApp
            </button>

          </div>
        )}
      </div>
      {showNewCust && <QuickCustomerModal onClose={() => setShowNewCust(false)} onSave={(c) => { setCustomers(prev => [...prev, c]); setSelectedCustomer(c); setShowNewCust(false); showToast('Customer added'); }} />}
      {showNewDoc && <QuickDoctorModal onClose={() => setShowNewDoc(false)} onSave={(d) => { setDoctors(prev => [...prev, d]); setSelectedDoctor(d); setShowNewDoc(false); showToast('Doctor added'); }} />}
      {showH1Modal && <H1DetailsModal details={h1Details} setDetails={setH1Details} onClose={() => setShowH1Modal(false)} />}
    </div>
  );
}

function H1DetailsModal({ details, setDetails, onClose }) {
  const set = (k, v) => setDetails(prev => ({ ...prev, [k]: v }));
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Schedule H1 Drug Details</h2>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="modal-body">
          <p className="text-muted mb-4" style={{ fontSize: 13 }}>These details are mandatory under Indian Drugs & Cosmetics Rules for Schedule H1 medicines.</p>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Patient Name *</label>
              <input className="form-input" value={details.patient_name} onChange={e => set('patient_name', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Patient Address *</label>
            <input className="form-input" value={details.patient_address} onChange={e => set('patient_address', e.target.value)} />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Doctor Name *</label>
              <input className="form-input" value={details.doctor_name} onChange={e => set('doctor_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Doctor Reg. No *</label>
              <input className="form-input" value={details.doctor_reg_no} onChange={e => set('doctor_reg_no', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Doctor Address *</label>
            <input className="form-input" value={details.doctor_address} onChange={e => set('doctor_address', e.target.value)} />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prescription No / ID *</label>
              <input className="form-input" value={details.prescription_no} onChange={e => set('prescription_no', e.target.value)} />
            </div>
          </div>

          <div className="alert alert-yellow" style={{ marginTop: 15, fontSize: 12 }}>
            <strong>Note:</strong> Records must be maintained for 3 years for government inspection.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary w-full" onClick={onClose}>Confirm Details</button>
        </div>
      </div>
    </div>
  );
}

function QuickCustomerModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const showToast = useToast();
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return showToast('Name required', 'error');
    setSaving(true);
    try { const c = await api.createCustomer(form); onSave(c); } catch (err) { showToast(err.message, 'error'); }
    setSaving(false);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>New Customer</h2><button className="modal-close" onClick={onClose}><X size={18}/></button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">

          
            <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add'}</button></div>
        </form>
      </div>
    </div>
  );
}

function QuickDoctorModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', hospital: '', phone: '', specialization: '' });
  const [saving, setSaving] = useState(false);
  const showToast = useToast();
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return showToast('Name required', 'error');
    setSaving(true);
    try { const d = await api.createDoctor(form); onSave(d); } catch (err) { showToast(err.message, 'error'); }
    setSaving(false);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>New Doctor</h2><button className="modal-close" onClick={onClose}><X size={18}/></button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus /></div>
            <div className="form-group"><label className="form-label">Hospital</label><input className="form-input" value={form.hospital} onChange={e => setForm(p => ({ ...p, hospital: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Specialization</label><input className="form-input" value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add'}</button></div>
        </form>
      </div>
    </div>
  );
}
