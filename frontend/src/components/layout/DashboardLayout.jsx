import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const DashboardLayout = ({ children }) => (
  <div className="flex min-h-screen bg-slate-50">
    <Sidebar />
    <main className="flex-1 overflow-auto">
      <Topbar />
      <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
    </main>
  </div>
);

export default DashboardLayout;
