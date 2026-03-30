import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyEvents } from '../../api/events';
import { getAttendees } from '../../api/attendees';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Stat from '../../components/ui/Stat';

const SubOrgDashboard = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, confirmed: 0, total: 0 });

  useEffect(() => {
    getMyEvents().then(r => {
      const evs = r.data.data.events;
      setEvents(evs);
      if (evs.length > 0) {
        getAttendees({ eventId: evs[0]._id, limit: 1 }).then(ar => {
          const total = ar.data.data.total;
          setCounts(c => ({ ...c, total }));
        });
      }
    });
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sub-Organiser Dashboard</h1>
        <p className="text-gray-500 text-sm">Welcome, {user?.name}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Stat label="My Events" value={events.length} color="blue"/>
        <Stat label="Attendees" value={counts.total} color="green"/>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { to: '/suborg/attendees', icon: '👤', label: 'Manage Attendees', color: 'blue' },
          { to: '/suborg/upload', icon: '📤', label: 'Bulk Upload', color: 'green' },
          { to: '/suborg/verify', icon: '✅', label: 'Verify Photos', color: 'purple' },
        ].map(item => (
          <Link key={item.to} to={item.to} className={`flex flex-col items-center p-6 bg-${item.color}-50 rounded-xl hover:bg-${item.color}-100 transition-colors`}>
            <span className="text-3xl mb-2">{item.icon}</span>
            <span className={`text-sm font-semibold text-${item.color}-900 text-center`}>{item.label}</span>
          </Link>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default SubOrgDashboard;
