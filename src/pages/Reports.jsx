import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { FileText, Download, Calendar, Search, ShieldAlert, Package, AlertTriangle, IndianRupee, Users, RefreshCw } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('gst');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState({ type: '', items: null });
  const [loading, setLoading] = useState(false);
  const [shopName, setShopName] = useState('Shree Samarth Medical');

  useEffect(() => {
    fetchReportData();
    api.getSettings().then(s => {
      if (s.shop_name) setShopName(s.shop_name);
    }).catch(() => {});
  }, [activeTab, dateRange]);

  const fetchReportData = async () => {
    const currentTab = activeTab;
    setLoading(true);
    setReportData({ type: currentTab, items: null }); 
    try {
      let endpoint = '';
      if (currentTab === 'gst') endpoint = `/reports/gst?from=${dateRange.from}&to=${dateRange.to}`;
      else if (currentTab === 'h1') endpoint = `/reports/h1?from=${dateRange.from}&to=${dateRange.to}`;
      else if (currentTab === 'expiry') endpoint = `/reports/expiry?days=90`;
      else if (currentTab === 'low-stock') endpoint = `/reports/low-stock?threshold=10`;
      else if (currentTab === 'sales') endpoint = `/reports/sales-summary?from=${dateRange.from}&to=${dateRange.to}`;
      else if (currentTab === 'credit') endpoint = `/reports/customer-credit`;
      else if (currentTab === 'purchases') endpoint = `/reports/purchases-summary?from=${dateRange.from}&to=${dateRange.to}`;
      else if (currentTab === 'profitability') endpoint = `/reports/profitability?from=${dateRange.from}&to=${dateRange.to}`;

      const res = await api.get(endpoint);
      setReportData({ type: currentTab, items: res });
    } catch (err) {
      console.error('Failed to fetch report data:', err);
      setReportData({ type: currentTab, items: null });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (items, filename) => {
    if (!items || !items.length) return;
    const headers = Object.keys(items[0]).join(',');
    const rows = items.map(row => 
      Object.values(row).map(val => `"${val}"`).join(',')
    ).join('\n');
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const exportToPDF = (items, title, headers) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(shopName, 14, 20);
    doc.setFontSize(12);
    doc.text(title, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);
    
    const tableData = items.map(row => headers.map(h => {
        const val = row[h.key];
        return typeof val === 'number' ? val.toFixed(2) : val;
    }));

    doc.autoTable({
      startY: 45,
      head: [headers.map(h => h.label)],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`${title.toLowerCase().replace(/ /g, '_')}.pdf`);
  };

  const tabs = [
    { id: 'gst', label: 'GST Summary', icon: <IndianRupee size={15}/> },
    { id: 'sales', label: 'Sales Summary', icon: <FileText size={15}/> },
    { id: 'h1', label: 'H1 Register', icon: <ShieldAlert size={15}/> },
    { id: 'expiry', label: 'Expiry Report', icon: <AlertTriangle size={15}/> },
    { id: 'low-stock', label: 'Low Stock', icon: <Package size={15}/> },
    { id: 'credit', label: 'Customer Credit', icon: <Users size={15}/> },
    { id: 'purchases', label: 'Purchases', icon: <Package size={15}/> },
    { id: 'profitability', label: 'Profitability', icon: <IndianRupee size={15}/> },
  ];

  return (
    <div className="w-full">
      <div className="toolbar flex justify-between items-center mb-4">
        <h2 className="section-title flex items-center gap-2">
          <FileText size={24} className="text-primary" />
          Business Reports
        </h2>
        
        {['gst', 'h1', 'sales', 'purchases', 'profitability'].includes(activeTab) && (
            <div className="flex items-center gap-4 bg-white/50 p-2 rounded-xl border border-white/50 shadow-sm">
                <Calendar size={16} className="text-muted ml-2" />
                <input 
                    type="date" 
                    className="form-input text-sm py-1 border-none bg-transparent focus:ring-0" 
                    value={dateRange.from}
                    onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                />
                <span className="text-muted text-xs font-bold">TO</span>
                <input 
                    type="date" 
                    className="form-input text-sm py-1 border-none bg-transparent focus:ring-0" 
                    value={dateRange.to}
                    onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                />
            </div>
        )}
      </div>

      {/* Apple-style Segmented Tabs */}
      <div className="flex justify-center mb-4">
        <div className="bg-black/5 p-1 rounded-2xl flex gap-1 overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 whitespace-nowrap ${
                        activeTab === tab.id 
                        ? 'bg-white text-primary shadow-sm' 
                        : 'text-muted hover:text-secondary'
                    }`}
                >
                    {tab.icon}
                    {tab.label}
                </button>
            ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted glass-card">
            <RefreshCw size={32} className="animate-spin mx-auto mb-4 text-primary opacity-50" />
            <p className="font-medium">Preparing your report...</p>
        </div>
      ) : (!reportData.items || reportData.type !== activeTab) ? (
        <div className="text-center py-20 text-muted glass-card border-dashed border-2">
            <p>No data found for the selected criteria.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'gst' && reportData.items.sales && (
            <>
              <ReportSection 
                title="Sales GST Summary" 
                data={reportData.items.sales} 
                headers={[
                    { key: 'month', label: 'Month' },
                    { key: 'taxable_value', label: 'Taxable (₹)' },
                    { key: 'total_gst', label: 'GST (₹)' },
                    { key: 'total_sales', label: 'Total Sales (₹)' }
                ]}
                onExportCSV={() => exportToCSV(reportData.items.sales, 'gst_summary')}
                onExportPDF={() => exportToPDF(reportData.items.sales, 'Sales GST Summary', [
                    { key: 'month', label: 'Month' },
                    { key: 'taxable_value', label: 'Taxable' },
                    { key: 'total_gst', label: 'GST' },
                    { key: 'total_sales', label: 'Total' }
                ])}
              />
              <ReportSection 
                title="GST Breakup" 
                data={reportData.items.breakup} 
                headers={[
                    { key: 'gst_percent', label: 'GST %' },
                    { key: 'taxable_value', label: 'Taxable (₹)' },
                    { key: 'gst_amount', label: 'Total GST (₹)' }
                ]}
                onExportCSV={() => exportToCSV(reportData.items.breakup, 'gst_breakup')}
                onExportPDF={() => exportToPDF(reportData.items.breakup, 'GST Breakup', [
                    { key: 'gst_percent', label: 'Rate (%)' },
                    { key: 'taxable_value', label: 'Taxable' },
                    { key: 'gst_amount', label: 'GST Amount' }
                ])}
              />
            </>
          )}

          {activeTab === 'sales' && Array.isArray(reportData.items) && (
            <ReportSection 
                title="Detailed Sales Summary" 
                data={reportData.items} 
                headers={[
                    { key: 'created_at', label: 'Date' },
                    { key: 'invoice_number', label: 'Invoice' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'total_amount', label: 'Total' },
                    { key: 'payment_mode', label: 'Mode' }
                ]}
                onExportCSV={() => exportToCSV(reportData.items, 'sales_summary')}
                onExportPDF={() => exportToPDF(reportData.items, 'Sales Summary Report', [
                    { key: 'created_at', label: 'Date' },
                    { key: 'invoice_number', label: 'Inv #' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'total_amount', label: 'Amount' },
                    { key: 'payment_mode', label: 'Mode' }
                ])}
            />
          )}

          {activeTab === 'h1' && Array.isArray(reportData.items) && (
            <ReportSection 
                title="Schedule H1 Drug Register" 
                data={reportData.items} 
                headers={[
                    { key: 'created_at', label: 'Date' },
                    { key: 'invoice_number', label: 'Invoice' },
                    { key: 'patient_name', label: 'Patient' },
                    { key: 'doctor_name', label: 'Doctor' },
                    { key: 'brand_name', label: 'Medicine' },
                    { key: 'quantity', label: 'Qty' }
                ]}
                onExportCSV={() => exportToCSV(reportData.items, 'h1_register')}
                onExportPDF={() => exportToPDF(reportData.items, 'Schedule H1 Drug Register', [
                    { key: 'created_at', label: 'Date' },
                    { key: 'patient_name', label: 'Patient' },
                    { key: 'doctor_name', label: 'Doctor' },
                    { key: 'brand_name', label: 'Medicine' },
                    { key: 'quantity', label: 'Qty' }
                ])}
            />
          )}

          {activeTab === 'expiry' && Array.isArray(reportData.items) && (
            <ReportSection 
                title="Medicine Expiry Report (90 Days)" 
                data={reportData.items} 
                headers={[
                    { key: 'brand_name', label: 'Medicine' },
                    { key: 'batch_number', label: 'Batch' },
                    { key: 'expiry_date', label: 'Expiry Date' },
                    { key: 'quantity', label: 'Stock Left' }
                ]}
                onExportCSV={() => exportToCSV(reportData.items, 'expiry_report')}
                onExportPDF={() => exportToPDF(reportData.items, 'Medicine Expiry Report', [
                    { key: 'brand_name', label: 'Medicine' },
                    { key: 'batch_number', label: 'Batch' },
                    { key: 'expiry_date', label: 'Expiry' },
                    { key: 'quantity', label: 'Qty' }
                ])}
            />
          )}

          {activeTab === 'low-stock' && Array.isArray(reportData.items) && (
            <ReportSection 
                title="Low Stock Inventory Report" 
                data={reportData.items} 
                headers={[
                    { key: 'brand_name', label: 'Medicine' },
                    { key: 'company_name', label: 'Company' },
                    { key: 'total_stock', label: 'Stock' }
                ]}
                onExportCSV={() => exportToCSV(reportData.items, 'low_stock_report')}
                onExportPDF={() => exportToPDF(reportData.items, 'Low Stock Report', [
                    { key: 'brand_name', label: 'Medicine' },
                    { key: 'total_stock', label: 'Stock' }
                ])}
            />
          )}

          {activeTab === 'credit' && Array.isArray(reportData.items) && (
            <ReportSection 
                title="Customer Credit (Pending) Report" 
                data={reportData.items} 
                headers={[
                    { key: 'name', label: 'Customer' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'current_balance', label: 'Balance (₹)' }
                ]}
                onExportCSV={() => exportToCSV(reportData.items, 'credit_report')}
                onExportPDF={() => exportToPDF(reportData.items, 'Customer Credit Report', [
                    { key: 'name', label: 'Customer' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'current_balance', label: 'Balance' }
                ])}
            />
          )}

          {activeTab === 'purchases' && Array.isArray(reportData.items) && (
            <ReportSection 
                title="Supplier Purchase Summary" 
                data={reportData.items} 
                headers={[
                    { key: 'supplier_name', label: 'Supplier' },
                    { key: 'total_bills', label: 'Bills' },
                    { key: 'total_amount', label: 'Total Purchase (₹)' },
                    { key: 'amount_paid', label: 'Paid (₹)' },
                    { key: 'outstanding', label: 'Pending (₹)' }
                ]}
                onExportCSV={() => exportToCSV(reportData.items, 'purchase_summary')}
                onExportPDF={() => exportToPDF(reportData.items, 'Supplier Purchase Summary', [
                    { key: 'supplier_name', label: 'Supplier' },
                    { key: 'total_bills', label: 'Bills' },
                    { key: 'total_amount', label: 'Total' },
                    { key: 'amount_paid', label: 'Paid' },
                    { key: 'outstanding', label: 'Pending' }
                ])}
            />
          )}

          {activeTab === 'profitability' && Array.isArray(reportData.items) && (
            <ReportSection 
                title="Daily Profitability Report" 
                data={reportData.items} 
                headers={[
                    { key: 'sale_date', label: 'Date' },
                    { key: 'bills', label: 'Bills' },
                    { key: 'sales_value', label: 'Sales (₹)' },
                    { key: 'purchase_cost', label: 'Purchase Cost (₹)' },
                    { key: 'gross_profit', label: 'Gross Profit (₹)' }
                ]}
                onExportCSV={() => exportToCSV(reportData.items, 'profitability_report')}
                onExportPDF={() => exportToPDF(reportData.items, 'Daily Profitability Report', [
                    { key: 'sale_date', label: 'Date' },
                    { key: 'bills', label: 'Bills' },
                    { key: 'sales_value', label: 'Sales' },
                    { key: 'purchase_cost', label: 'Cost' },
                    { key: 'gross_profit', label: 'Profit' }
                ])}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ReportSection({ title, data, headers, onExportCSV, onExportPDF }) {
    return (
        <div className="glass-card shadow-sm border border-white/40">
            <div className="flex justify-between items-center mb-5 border-b border-black/5 pb-3">
                <h3 className="font-bold text-secondary">{title}</h3>
                <div className="flex gap-2">
                    <button onClick={onExportPDF} className="btn btn-primary text-[10px] py-1.5 px-3 uppercase tracking-wider font-bold">
                        <Download size={12} /> PDF
                    </button>
                    <button onClick={onExportCSV} className="btn btn-secondary text-[10px] py-1.5 px-3 uppercase tracking-wider font-bold">
                        <FileText size={12} /> CSV
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="data-table no-border">
                    <thead>
                        <tr>
                            {headers.map(h => <th key={h.key} className="text-[11px] text-muted uppercase tracking-wider">{h.label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.isArray(data) && data.map((row, i) => (
                            <tr key={i} className="hover:bg-black/[0.02] transition-colors">
                                {headers.map(h => (
                                    <td key={h.key} className={`text-sm ${String(h.key).includes('total') || String(h.key).includes('balance') ? 'font-bold text-primary' : ''}`}>
                                        {h.key === 'created_at' ? new Date(row[h.key]).toLocaleDateString() : 
                                         typeof row[h.key] === 'number' ? row[h.key].toFixed(2) : row[h.key]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
