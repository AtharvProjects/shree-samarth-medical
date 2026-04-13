import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const pageLabels = {
  dashboard: 'Dashboard',
  billing: 'New Bill',
  bills: 'Bills List',
  inventory: 'Inventory',
  purchases: 'Purchases',
  customers: 'Customers',
  doctors: 'Doctors',
  suppliers: 'Suppliers',
  reports: 'Reports',
  nonmoving: 'Non-Moving Medicines',
  settings: 'Settings',
};

export default function Header({ activePage }) {
  const [todaySales, setTodaySales] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);

  useEffect(() => {
    const fetchStats = () => {
      api.getDashboard().then(d => {
        setTodaySales(d.today.total);
        setInvoiceCount(d.today.count);
      }).catch(() => {});
    };

    fetchStats();
    
    window.addEventListener('invoice-saved', fetchStats);
    return () => window.removeEventListener('invoice-saved', fetchStats);
  }, [activePage]);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <header className="header">
      <div className="header-left">
        <h2 className="header-title">{pageLabels[activePage] || 'Dashboard'}</h2>
        <span className="header-date">{today}</span>
      </div>
      <div className="header-right">
        <div className="header-stat">
          <span className="label">Today's Sales</span>
          <span className="value">₹{todaySales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="header-stat">
          <span className="label">Bills</span>
          <span className="value">{invoiceCount}</span>
        </div>
      </div>
    </header>
  );
}
