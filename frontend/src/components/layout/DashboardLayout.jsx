import React from 'react';
import Sidebar from './Sidebar';

const DashboardLayout = ({ children }) => (
  <div className="flex min-h-screen bg-gray-50">
    <Sidebar />
    <main className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto p-6">{children}</div>
    </main>
  </div>
);

export default DashboardLayout;
