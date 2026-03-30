import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllEventsAdmin } from '../../api/events';
import { getUsers } from '../../api/users';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Stat from '../../components/ui/Stat';
import Card, { CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';

const statusColor = { draft: 'gray', published: 'green', ongoing: 'blue', completed: 'gray', cancelled: 'red' };

const AdminDashboard = () => {
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllEventsAdmin({ limit: 10 }), getUsers({ limit: 50 })])
      .then(([er, ur]) => { setEvents(er.data.data.events); setUsers(ur.data.data.users); })
      .finally(() => setLoading(false));
  }, []);

  const roleCounts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">System-wide overview</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Total Events" value={events.length} color="blue"/>
        <Stat label="Published Events" value={events.filter(e => e.status === 'published').length} color="green"/>
        <Stat label="Organisers" value={roleCounts.main_organiser || 0} color="purple"/>
        <Stat label="Total Users" value={users.length} color="orange"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Recent Events" action={<Link to="/admin/events" className="text-sm text-blue-600 hover:underline">View all</Link>}/>
          <div className="space-y-3">
            {events.slice(0, 6).map(event => (
              <div key={event._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{event.name}</p>
                  <p className="text-xs text-gray-500">{event.venue?.city} — {event.startDate ? format(new Date(event.startDate), 'MMM d, yyyy') : ''}</p>
                </div>
                <Badge color={statusColor[event.status] || 'gray'}>{event.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Users by Role" action={<Link to="/admin/users" className="text-sm text-blue-600 hover:underline">Manage users</Link>}/>
          <div className="space-y-3">
            {[['main_organiser','Main Organiser','purple'],['sub_organiser','Sub Organiser','blue'],['staff','Staff','orange'],['volunteer','Volunteer','green'],['auditor','Auditor','gray']].map(([role, label, color]) => (
              <div key={role} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{label}</span>
                <Badge color={color}>{roleCounts[role] || 0}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Link to="/admin/users" className="w-full block text-center text-sm bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">+ Create User</Link>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
