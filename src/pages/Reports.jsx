import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Legend 
} from 'recharts';
import { 
  Download, Calendar, TrendingUp, AlertTriangle, IndianRupee, 
  CreditCard, Banknote, Users, Package, FileText, PieChart as PieIcon, ArrowUpRight,
  ChevronRight, LayoutDashboard, History, Filter, Phone, X, Search, RefreshCw
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10)
  });

  const [data, setData] = useState({
    sales: [],
    profit: null,
    expiry: [],
    outstanding: [],
    supplier_payments: [],
    h1_register: []
  });
  const [payFilters, setPayFilters] = useState({ search: '', status: 'All' });
  const [h1Filters, setH1Filters] = useState({ medicine: '', doctor: '', patient: '' });
  const [loading, setLoading] = useState(false);
  const [paySupplier, setPaySupplier] = useState(null);
  const [historySupplier, setHistorySupplier] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sales') {
        const res = await api.get('/reports/sales', { from: dateRange.from, to: dateRange.to });
        setData(prev => ({ ...prev, sales: res.sort((a, b) => new Date(a.period) - new Date(b.period)) }));
      } else if (activeTab === 'profit') {
        const res = await api.get('/reports/profit', { from: dateRange.from, to: dateRange.to });
        setData(prev => ({ ...prev, profit: res }));
      } else if (activeTab === 'expiry') {
        const res = await api.get('/batches', { expiring: 180 });
        setData(prev => ({ ...prev, expiry: res }));
      } else if (activeTab === 'outstanding') {
        const res = await api.get('/reports/outstanding');
        setData(prev => ({ ...prev, outstanding: res }));
      } else if (activeTab === 'supplier_payments') {
        const res = await api.get('/reports/supplier-payments', { from: dateRange.from, to: dateRange.to });
        setData(prev => ({ ...prev, supplier_payments: res }));
      } else if (activeTab === 'h1_register') {
        const res = await api.getH1RegisterReport({ 
          from: dateRange.from, 
          to: dateRange.to,
          medicine_search: h1Filters.medicine,
          doctor_search: h1Filters.doctor,
          patient_search: h1Filters.patient
        });
        setData(prev => ({ ...prev, h1_register: res }));
      }
    } catch (err) {
      console.error("Failed to fetch report data:", err);
    } finally {
      setLoading(false);
    }
  };

  const salesSummary = useMemo(() => {
    if (!data.sales.length) return { total: 0, cash: 0, upi: 0, credit: 0, gst: 0, count: 0 };
    return data.sales.reduce((acc, curr) => ({
      total: acc.total + curr.total,
      cash: acc.cash + curr.cash,
      upi: acc.upi + curr.upi,
      credit: acc.credit + curr.credit,
      gst: acc.gst + curr.gst,
      count: acc.count + curr.count
    }), { total: 0, cash: 0, upi: 0, credit: 0, gst: 0, count: 0 });
  }, [data.sales]);

    const exportPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const primaryColor = [30, 58, 95];
    const accentColor = [167, 199, 231];
    const textColor = [50, 50, 50];

    // --- Header ---
    doc.setFillColor(...accentColor);
    doc.rect(margin, margin, pageWidth - (margin * 2), 20, 'F');
    
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Shree Samarth Medical', pageWidth / 2, 24, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(`${activeTab.toUpperCase()} REPORT | PERIOD: ${dateRange.from} TO ${dateRange.to}`, pageWidth / 2, 30, { align: 'center' });

    let y = 45;

    // --- Summary Stats Section ---
    if (activeTab === 'sales') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Performance Summary', margin, y);
      y += 6;
      
      const stats = [
        { label: 'Total Revenue', value: fmt(salesSummary.total) },
        { label: 'GST Collected', value: fmt(salesSummary.gst) },
        { label: 'Cash Collection', value: fmt(salesSummary.cash) },
        { label: 'UPI Collection', value: fmt(salesSummary.upi) },
        { label: 'Credit Issued', value: fmt(salesSummary.credit) },
        { label: 'Total Bills', value: `${salesSummary.count} Invoices` }
      ];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      stats.forEach((stat, i) => {
        const xPos = margin + (i % 2 === 0 ? 0 : 80);
        doc.text(`${stat.label}: ${stat.value}`, xPos, y);
        if (i % 2 !== 0) y += 5;
      });
      y += 10;
    }

    const tableOptions = {
      startY: y,
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: textColor },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: margin, right: margin }
    };

    if (activeTab === 'sales') {
      autoTable(doc, {
        ...tableOptions,
        head: [['Date', 'Bills', 'GST', 'Cash', 'UPI', 'Credit', 'Total Revenue']],
        body: data.sales.map(r => [
          r.period, 
          r.count, 
          (r.gst || 0).toFixed(2), 
          (r.cash || 0).toFixed(2), 
          (r.upi || 0).toFixed(2), 
          (r.credit || 0).toFixed(2), 
          (r.total || 0).toFixed(2)
        ]),
      });
    } else if (activeTab === 'expiry') {
      autoTable(doc, {
        ...tableOptions,
        head: [['Medicine Name', 'Company', 'Batch', 'Expiry Date', 'Qty Left']],
        body: data.expiry.map(r => [
          r.brand_name || '-', 
          r.company_name || '-', 
          r.batch_number || '-', 
          r.expiry_date || '-', 
          r.quantity || 0
        ]),
      });
    } else if (activeTab === 'outstanding') {
      autoTable(doc, {
        ...tableOptions,
        head: [['Customer Name', 'Phone Number', 'Invoices', 'Pending Balance']],
        body: data.outstanding.map(r => [
          r.name || '-', 
          r.phone || '-', 
          r.credit_invoices || 0, 
          (r.credit_balance || 0).toFixed(2)
        ]),
      });
    } else if (activeTab === 'supplier_payments') {
      autoTable(doc, {
        ...tableOptions,
        head: [['Supplier', 'Total Purchase', 'Amount Paid', 'Remaining', 'Status', 'Last Date']],
        body: data.supplier_payments.map(r => [
          r.SupplierName || '-',
          (r.TotalPurchaseAmount || 0).toFixed(2),
          (r.AmountPaid || 0).toFixed(2),
          (r.RemainingAmount || 0).toFixed(2),
          r.PaymentStatus || '-',
          r.LastPaymentDate ? r.LastPaymentDate.slice(0, 10) : '-'
        ]),
      });
    } else if (activeTab === 'h1_register') {
      autoTable(doc, {
        ...tableOptions,
        head: [['S.No', 'Date', 'Patient Name & Address', 'Doctor Name, Address & Reg No', 'Medicine & Qty', 'Mfg, Batch, Expiry', 'Pharmacist', 'Prescription #']],
        body: data.h1_register.map((r, i) => [
          i + 1,
          r.supply_date ? r.supply_date.slice(0, 10) : '-',
          `${r.patient_name}\n${r.patient_address}`,
          `${r.doctor_name}\n${r.doctor_address}\nReg: ${r.doctor_reg_no}`,
          `${r.medicine_name}\nQty: ${r.quantity_supplied}`,
          `${r.manufacturer_name}\nB: ${r.batch_number}\nE: ${r.expiry_date}`,
          'Samarth Medical',
          r.prescription_no || '-'
        ]),
        columnStyles: {
          2: { cellWidth: 35 },
          3: { cellWidth: 40 },
          5: { cellWidth: 30 }
        }
      });
    }

    // --- Footer ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, doc.internal.pageSize.getHeight() - 10);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }


    if (window.require) {
      try {
        const fs = window.require('fs');
        const path = window.require('path');
        const os = window.require('os');
        const { shell } = window.require('electron');
        
        const homeDir = os.homedir();
        const downloadsPath = path.join(homeDir, 'Downloads');
        const fileName = `Samarth_Medical_${activeTab}_Report.pdf`;
        const filePath = path.join(downloadsPath, fileName);
        
        const pdfOutput = doc.output('arraybuffer');
        fs.writeFileSync(filePath, Buffer.from(pdfOutput));
        
        shell.showItemInFolder(filePath);
      } catch (e) {
        console.error('Electron save error', e);
        doc.save(`Samarth_Medical_${activeTab}_Report.pdf`);
      }
    } else {
      doc.save(`Samarth_Medical_${activeTab}_Report.pdf`);
    }
  };

  const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="toolbar" style={{ marginBottom: 32 }}>
        <div className="toolbar-left">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-blue)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              <LayoutDashboard size={14} />
              Analytics Engine
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0' }}>Business Intelligence</h1>
          </div>
        </div>
        
        <div className="toolbar-right">
          {(activeTab === 'sales' || activeTab === 'profit' || activeTab === 'supplier_payments' || activeTab === 'h1_register') && (
            <div className="glass-card" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Filter size={16} color="var(--text-muted)" />
              <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="form-input" style={{ width: 130, padding: '4px 8px', background: 'transparent', border: 'none' }} />
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="form-input" style={{ width: 130, padding: '4px 8px', background: 'transparent', border: 'none' }} />
            </div>
          )}
          <button onClick={exportPDF} className="btn btn-primary" style={{ padding: '10px 20px', borderRadius: 12 }}>
            <Download size={18} />
            Export Report
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs" style={{ background: 'rgba(0,0,0,0.05)', padding: 4, borderRadius: 16, marginBottom: 32 }}>
        {[
          { id: 'sales', label: 'Revenue', icon: TrendingUp },
          { id: 'profit', label: 'Profitability', icon: PieIcon },
          { id: 'expiry', label: 'Stock Alerts', icon: AlertTriangle },
          { id: 'outstanding', label: 'Market Credits', icon: Users },
          { id: 'supplier_payments', label: 'Supplier Payments', icon: Banknote },
          { id: 'h1_register', label: 'H1 Register', icon: FileText }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', fontSize: 13 }}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: '100px 0' }}>
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Processing data intelligence...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* --- REVENUE VIEW --- */}
          {activeTab === 'sales' && (
            <>
                <div className="report-summary-grid">
                  <div className="glass-card stat-card stat-blue">
                    <span className="label">Gross Revenue</span>
                    <span className="value">{fmt(salesSummary.total)}</span>
                    <span className="trend trend-up">Incl. GST {fmt(salesSummary.gst)}</span>
                  </div>
                  <div className="glass-card stat-card stat-green">
                    <span className="label">Cash Collected</span>
                    <span className="value">{fmt(salesSummary.cash)}</span>
                  </div>
                  <div className="glass-card stat-card stat-purple">
                    <span className="label">Digital (UPI)</span>
                    <span className="value">{fmt(salesSummary.upi)}</span>
                  </div>
                  <div className="glass-card stat-card stat-rose">
                    <span className="label">Credit Issued</span>
                    <span className="value">{fmt(salesSummary.credit)}</span>
                  </div>
                </div>


              <div className="reports-grid">
                <div className="glass-card" style={{ padding: 24 }}>
                  <div className="section-title flex items-center gap-2">
                    <History size={18} /> Sales Trend
                  </div>
                  <div style={{ height: 300, marginTop: 20 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.sales}>
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#A7C7E7" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#A7C7E7" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(v) => '₹' + (v/1000).toFixed(0) + 'k'} />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-md)'}} />
                        <Area type="monotone" dataKey="total" stroke="#A7C7E7" strokeWidth={3} fill="url(#colorSales)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: 24 }}>
                  <div className="section-title flex items-center gap-2">
                    <PieIcon size={18} /> Payment Methods
                  </div>
                  <div style={{ height: 220, marginTop: 20 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Cash', value: salesSummary.cash },
                            { name: 'UPI', value: salesSummary.upi },
                            { name: 'Credit', value: salesSummary.credit }
                          ]}
                          cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value"
                        >
                          <Cell fill="var(--accent-mint)" />
                          <Cell fill="var(--accent-blue)" />
                          <Cell fill="var(--accent-peach)" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span className="flex items-center gap-2"><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-mint)' }}></div> Cash</span>
                      <span style={{ fontWeight: 700 }}>{fmt(salesSummary.cash)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span className="flex items-center gap-2"><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-blue)' }}></div> Digital</span>
                      <span style={{ fontWeight: 700 }}>{fmt(salesSummary.upi)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span className="flex items-center gap-2"><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-peach)' }}></div> Credit</span>
                      <span style={{ fontWeight: 700 }}>{fmt(salesSummary.credit)}</span>
                    </div>
                  </div>
                </div>
              </div>

                <div className="glass-card">
                  <div className="section-title" style={{ padding: '10px 20px 0' }}>Daily Sales Breakdown</div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: 24 }}>Date</th>
                        <th>Bills</th>
                        <th className="text-right">GST Collected</th>
                        <th className="text-right">Cash</th>
                        <th className="text-right">UPI</th>
                        <th className="text-right">Credit</th>
                        <th className="text-right" style={{ paddingRight: 24 }}>Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sales.slice().reverse().map((row, i) => (
                        <tr key={i}>
                          <td style={{ paddingLeft: 24, fontWeight: 600 }}>{row.period}</td>
                          <td><span className="badge badge-blue">{row.count} Invoices</span></td>
                          <td className="text-right">{fmt(row.gst)}</td>
                          <td className="text-right">{fmt(row.cash)}</td>
                          <td className="text-right">{fmt(row.upi)}</td>
                          <td className="text-right">{fmt(row.credit)}</td>
                          <td className="text-right" style={{ paddingRight: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

            </>
          )}

          {/* --- PROFIT VIEW --- */}
          {activeTab === 'profit' && data.profit && (
            <>
              <div className="report-summary-grid">
                <div className="glass-card huge-card indigo">
                  <div>
                    <span className="label">Gross Sales</span>
                    <div className="value">{fmt(data.profit.sales)}</div>
                  </div>
                  <span className="subtext">Total revenue generated</span>
                </div>
                <div className="glass-card huge-card rose">
                  <div>
                    <span className="label">Total Purchases</span>
                    <div className="value">{fmt(data.profit.purchases)}</div>
                  </div>
                  <span className="subtext">Stock procurement value</span>
                </div>
                <div className={`glass-card huge-card ${data.profit.profit >= 0 ? 'emerald' : 'rose'}`}>
                  <div>
                    <span className="label">Gross Profit</span>
                    <div className="value">{fmt(data.profit.profit)}</div>
                  </div>
                  <span className="subtext">Estimated net earnings</span>
                </div>
              </div>

              <div className="glass-card" style={{ padding: 32 }}>
                <div className="section-title">Revenue vs Procurement Analysis</div>
                <div style={{ height: 350, marginTop: 24 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Revenue', amount: data.profit.sales, fill: 'var(--accent-blue)' },
                      { name: 'Purchases', amount: data.profit.purchases, fill: 'var(--accent-peach)' },
                      { name: 'Net Profit', amount: Math.max(0, data.profit.profit), fill: 'var(--accent-mint)' }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontWeight: 600}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} />
                      <Tooltip />
                      <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={80} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* --- EXPIRY VIEW --- */}
          {activeTab === 'expiry' && (
            <>
              <div className="risk-banner">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2>{data.expiry.length} Items at Risk</h2>
                    <p>Medicines expiring within the next 180 days. Take immediate action.</p>
                  </div>
                  <AlertTriangle size={64} style={{ opacity: 0.4 }} />
                </div>
              </div>

              <div className="glass-card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 24 }}>Medicine</th>
                      <th>Batch</th>
                      <th>Expiry Date</th>
                      <th className="text-center">Available Stock</th>
                      <th className="text-right" style={{ paddingRight: 24 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expiry.map((item, i) => {
                      const daysLeft = Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                      const isExpired = daysLeft < 0;
                      return (
                        <tr key={i}>
                          <td style={{ paddingLeft: 24 }}>
                            <div style={{ fontWeight: 700 }}>{item.brand_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.company_name}</div>
                          </td>
                          <td><code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4 }}>{item.batch_number}</code></td>
                          <td style={{ fontWeight: 600 }}>{item.expiry_date}</td>
                          <td className="text-center" style={{ fontWeight: 800, fontSize: 18 }}>{item.quantity}</td>
                          <td className="text-right" style={{ paddingRight: 24 }}>
                            <span className={`badge ${isExpired ? 'badge-red' : 'badge-yellow'}`}>
                              {isExpired ? 'EXPIRED' : `${daysLeft} days left`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* --- OUTSTANDING VIEW --- */}
          {activeTab === 'outstanding' && (
            <>
              <div className="glass-card huge-card indigo" style={{ minHeight: 140 }}>
                <div>
                  <span className="label">Total Market Outstanding (Udhaari)</span>
                  <div className="value" style={{ fontSize: 48 }}>{fmt(data.outstanding.reduce((s, i) => s + i.credit_balance, 0))}</div>
                </div>
                <span className="subtext">Collection pending from {data.outstanding.length} customers</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {data.outstanding.map((cust, i) => (
                  <div key={i} className="glass-card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {cust.name.charAt(0)}
                      </div>
                      <div className="text-right">
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-rose)' }}>{fmt(cust.credit_balance)}</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{cust.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                      <Phone size={12} /> {cust.phone || 'No phone'}
                    </div>
                    <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', borderRadius: 10 }}>
                      View Ledger <ChevronRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* --- SUPPLIER PAYMENTS VIEW --- */}
          {activeTab === 'supplier_payments' && (
            <>
              <div className="report-summary-grid">
                <div className="glass-card huge-card indigo" style={{ minHeight: 140 }}>
                  <div>
                    <span className="label">Total Supplier Payables</span>
                    <div className="value" style={{ fontSize: 48 }}>{fmt(data.supplier_payments.reduce((s, i) => s + i.RemainingAmount, 0))}</div>
                  </div>
                  <span className="subtext">Collection pending to {data.supplier_payments.filter(s => s.RemainingAmount > 0).length} suppliers</span>
                </div>
              </div>

              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div className="section-title" style={{ margin: 0 }}>Supplier Purchase & Payment Report</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <input type="text" placeholder="Search Supplier..." className="form-input" value={payFilters.search} onChange={e => setPayFilters({...payFilters, search: e.target.value})} style={{ width: 200 }} />
                    <select className="form-select" value={payFilters.status} onChange={e => setPayFilters({...payFilters, status: e.target.value})}>
                      <option value="All">All Statuses</option>
                      <option value="Paid">Paid</option>
                      <option value="Partial">Partial</option>
                      <option value="Unpaid">Unpaid</option>
                    </select>
                  </div>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 24 }}>Supplier Name</th>
                      <th className="text-right">Total Purchase</th>
                      <th className="text-right">Amount Paid</th>
                      <th className="text-right">Remaining Amount</th>
                      <th className="text-center">Payment Status</th>
                      <th className="text-right">Last Activity Date</th>
                      <th className="text-center" style={{ paddingRight: 24 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.supplier_payments.filter(row => row.SupplierName.toLowerCase().includes(payFilters.search.toLowerCase()) && (payFilters.status === 'All' || row.PaymentStatus === payFilters.status)).map((row, i) => (
                      <tr key={i}>
                        <td style={{ paddingLeft: 24, fontWeight: 700 }}>
                          <button style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }} onClick={() => setHistorySupplier(row)}>
                            {row.SupplierName}
                          </button>
                        </td>
                        <td className="text-right" style={{ fontWeight: 600 }}>{fmt(row.TotalPurchaseAmount)}</td>
                        <td className="text-right" style={{ color: 'var(--accent-mint)' }}>{fmt(row.AmountPaid)}</td>
                        <td className="text-right" style={{ color: 'var(--accent-rose)', fontWeight: 800 }}>{fmt(row.RemainingAmount)}</td>
                        <td className="text-center">
                          <span className={`badge ${row.PaymentStatus === 'Paid' ? 'badge-green' : row.PaymentStatus === 'Partial' ? 'badge-yellow' : 'badge-red'}`}>
                            {row.PaymentStatus}
                          </span>
                        </td>
                        <td className="text-right" style={{ color: 'var(--text-muted)' }}>{row.LastPaymentDate ? row.LastPaymentDate.slice(0, 10) : '-'}</td>
                        <td className="text-center" style={{ paddingRight: 24 }}>
                           {row.RemainingAmount > 0 ? (
                             <button className="btn btn-primary btn-sm" onClick={() => setPaySupplier(row)}>Pay</button>
                           ) : (
                             <span className="text-muted" style={{ fontSize: 11 }}>Settled</span>
                           )}
                        </td>
                      </tr>
                    ))}
                    {data.supplier_payments.length === 0 && <tr><td colSpan="7" className="text-center py-8">No payment records found</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* --- H1 REGISTER VIEW --- */}
          {activeTab === 'h1_register' && (
            <>
              <div className="alert alert-yellow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderRadius: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Schedule H1 Drug Register</h3>
                  <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Mandatory record maintenance as per Gazette Notification GSR 588(E). Records must be preserved for 3 years.</p>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.1)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Rule 65 & 97</div>
              </div>

              <div className="glass-card">
                <div style={{ display: 'flex', gap: 12, padding: 20, borderBottom: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap' }}>
                  <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
                    <Search size={14} />
                    <input className="form-input" placeholder="Medicine name..." value={h1Filters.medicine} onChange={e => setH1Filters({...h1Filters, medicine: e.target.value})} />
                  </div>
                  <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
                    <Search size={14} />
                    <input className="form-input" placeholder="Doctor name..." value={h1Filters.doctor} onChange={e => setH1Filters({...h1Filters, doctor: e.target.value})} />
                  </div>
                  <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
                    <Search size={14} />
                    <input className="form-input" placeholder="Patient name..." value={h1Filters.patient} onChange={e => setH1Filters({...h1Filters, patient: e.target.value})} />
                  </div>
                  <button className="btn btn-secondary" onClick={fetchData}><RefreshCw size={14} /> Refresh</button>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 24 }}>S.No</th>
                      <th>Date</th>
                      <th>Patient Name & Address</th>
                      <th>Doctor Details</th>
                      <th>Medicine & Qty</th>
                      <th>Mfg, Batch, Exp</th>
                      <th>Pharmacist</th>
                      <th style={{ paddingRight: 24 }}>Presc. No</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.h1_register.map((r, i) => (
                      <tr key={i}>
                        <td style={{ paddingLeft: 24, color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                        <td style={{ fontWeight: 600, fontSize: 12 }}>{r.supply_date?.slice(0, 10)}</td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{r.patient_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 150 }} className="truncate">{r.patient_address}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>Dr. {r.doctor_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Reg: {r.doctor_reg_no}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 150 }} className="truncate">{r.doctor_address}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--accent-rose)', fontSize: 13 }}>{r.medicine_name}</div>
                          <div style={{ fontSize: 11, fontWeight: 700 }}>Qty: {r.quantity_supplied}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: 11 }}>{r.manufacturer_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.batch_number} (E: {r.expiry_date})</div>
                        </td>
                        <td style={{ fontSize: 11 }}>Samarth Medical</td>
                        <td style={{ paddingRight: 24, fontWeight: 600, fontSize: 12 }}>{r.prescription_no}</td>
                      </tr>
                    ))}
                    {data.h1_register.length === 0 && (
                      <tr><td colSpan="7" className="text-center py-12 text-muted">No H1 drug sales found for this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
      
      {paySupplier && (
        <SupplierPaymentModal 
          supplier={paySupplier} 
          onClose={() => setPaySupplier(null)} 
          onSuccess={() => { setPaySupplier(null); fetchData(); }} 
        />
      )}
      {historySupplier && (
        <SupplierHistoryModal 
          supplier={historySupplier} 
          onClose={() => setHistorySupplier(null)} 
        />
      )}
    </div>
  );
}

function SupplierPaymentModal({ supplier, onClose, onSuccess }) {
  const [form, setForm] = useState({ amount: '', payment_mode: 'Cash', payment_date: new Date().toISOString().slice(0, 10), notes: '' });
  const [saving, setSaving] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || form.amount <= 0) return alert('Invalid amount');
    if (form.amount > supplier.RemainingAmount) return alert('Amount exceeds remaining balance by ₹' + (form.amount - supplier.RemainingAmount).toFixed(2));
    setSaving(true);
    try {
      await api.post(`/suppliers/${supplier.SupplierId}/pay`, form);
      onSuccess();
    } catch (err) {
      alert(err.message || 'Payment failed');
    }
    setSaving(false);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>Record Supplier Payment</h2><button className="modal-close" onClick={onClose}><X size={18}/></button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group"><label className="form-label">Supplier</label><input className="form-input" value={supplier.SupplierName} readOnly style={{ background: 'var(--surface)' }} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Total Purchase</label><input className="form-input" value={'₹' + supplier.TotalPurchaseAmount.toFixed(2)} readOnly style={{ background: 'var(--surface)' }} /></div>
              <div className="form-group"><label className="form-label">Already Paid</label><input className="form-input" value={'₹' + supplier.AmountPaid.toFixed(2)} readOnly style={{ background: 'var(--surface)' }} /></div>
            </div>
            <div className="form-group"><label className="form-label" style={{ color: 'var(--accent-rose)' }}>Remaining Amount</label><input className="form-input" value={'₹' + supplier.RemainingAmount.toFixed(2)} readOnly style={{ fontWeight: 800, color: 'var(--accent-rose)', background: 'var(--surface)' }} /></div>
            
            <div className="form-row mt-4">
              <div className="form-group"><label className="form-label">Payment Amount *</label><input type="number" step="0.01" max={supplier.RemainingAmount} className="form-input" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} autoFocus required /></div>
              <div className="form-group"><label className="form-label">Mode</label><select className="form-select" value={form.payment_mode} onChange={e => setForm({...form, payment_mode: e.target.value})}><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option></select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={form.payment_date} onChange={e => setForm({...form, payment_date: e.target.value})} required /></div>
              <div className="form-group"><label className="form-label">Notes (Optional)</label><input className="form-input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Ref #" /></div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Processing...' : 'Submit Payment'}</button></div>
        </form>
      </div>
    </div>
  );
}

function SupplierHistoryModal({ supplier, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.get(`/suppliers/${supplier.SupplierId}/payments`).then(res => {
      setHistory(res); setLoading(false);
    }).catch(err => {
      console.error(err); setLoading(false);
    });
  }, [supplier.SupplierId]);
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ padding: '16px 24px' }}>
          <div>
            <h2 style={{ margin: 0 }}>Payment History</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>{supplier.SupplierName}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', padding: 0 }}>
           {loading ? <div className="text-center py-8">Loading history...</div> : history.length === 0 ? <div className="text-center py-8 text-muted">No payments recorded yet.</div> : (
             <table className="data-table">
               <thead><tr><th style={{ paddingLeft: 24 }}>Date</th><th>Amount</th><th>Mode</th><th>Notes</th></tr></thead>
               <tbody>
                 {history.map(h => (
                   <tr key={h.id}>
                     <td style={{ paddingLeft: 24, fontWeight: 600 }}>{h.payment_date.slice(0, 10)}</td>
                     <td style={{ fontWeight: 800, color: 'var(--accent-mint)' }}>₹{h.amount.toFixed(2)}</td>
                     <td><span className="badge badge-blue">{h.payment_mode}</span></td>
                     <td>{h.notes || '-'}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           )}
        </div>
        <div className="modal-footer" style={{ padding: '16px 24px', background: 'var(--surface)' }}><button className="btn btn-secondary" style={{ width: '100%' }} onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
