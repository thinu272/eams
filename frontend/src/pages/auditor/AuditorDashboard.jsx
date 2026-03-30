import React from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';

const AuditorDashboard = () => (
  <DashboardLayout>
    <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">Auditor Dashboard</h1><p className="text-gray-500 text-sm">Read-only access to event data and logs</p></div>
    <div className="grid grid-cols-2 gap-4">
      <Link to="/auditor/logs" className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition-colors">
        <span className="text-3xl">📋</span>
        <h3 className="font-semibold mt-2">Entry Logs</h3>
        <p className="text-sm text-gray-500">View all check-in and access events</p>
      </Link>
      <Link to="/auditor/reports" className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition-colors">
        <span className="text-3xl">📊</span>
        <h3 className="font-semibold mt-2">Reports</h3>
        <p className="text-sm text-gray-500">View attendance and zone reports</p>
      </Link>
    </div>
  </DashboardLayout>
);

export default AuditorDashboard;
