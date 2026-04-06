import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllEventsAdmin, getMyEvents, createEvent, publishEvent } from '../../api/events';
import api from '../../api/client';
import { getUsers } from '../../api/users';
import { assignOrganiser } from '../../api/events';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const deleteEvent = (id) => api.delete(`/events/${id}`);
const statusColor = { draft: 'gray', published: 'green', ongoing: 'blue', completed: 'gray', cancelled: 'red' };

const AdminEvents = () => {
  const { user, isAdmin: authIsAdmin } = useAuth();
  const isAdmin = !!authIsAdmin;
  const [events, setEvents] = useState([]);
  const [organisers, setOrganisers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    'venue.name': '',
    'venue.city': '',
    'venue.country': 'Sri Lanka',
    startDate: '',
    endDate: '',
    description: '',
    mainOrganiser: '',
    coverImageFile: null,
  });

  const load = async () => {
    try {
      const response = isAdmin ? await getAllEventsAdmin({ limit: 50 }) : await getMyEvents();
      setEvents(response?.data?.data?.events || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (isAdmin) {
      getUsers({ role: 'main_organiser' }).then((r) => setOrganisers(r.data?.data?.users || []));
    }
  }, [isAdmin]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    try {
      await deleteEvent(id);
      toast.success('Event deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        startDate: form.startDate,
        endDate: form.endDate,
        venue: { name: form['venue.name'], city: form['venue.city'], country: form['venue.country'] },
      };

      if (isAdmin && form.mainOrganiser) payload.mainOrganiser = form.mainOrganiser;
      if (!isAdmin) payload.mainOrganiser = user?._id;

      if (form.coverImageFile) {
        const formDataToSend = new FormData();
        Object.keys(payload).forEach((key) => {
          if (payload[key] !== null && payload[key] !== undefined) {
            if (typeof payload[key] === 'object' && !Array.isArray(payload[key])) {
              formDataToSend.append(key, JSON.stringify(payload[key]));
            } else {
              formDataToSend.append(key, payload[key]);
            }
          }
        });
        formDataToSend.append('coverImage', form.coverImageFile);
        await createEvent(formDataToSend);
      } else {
        await createEvent(payload);
      }

      toast.success('Event created');
      setShowCreate(false);
      setForm({
        name: '',
        'venue.name': '',
        'venue.city': '',
        'venue.country': 'Sri Lanka',
        startDate: '',
        endDate: '',
        description: '',
        mainOrganiser: '',
        coverImageFile: null,
      });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const handleQuickAssign = async (eventId, organiserId) => {
    try {
      await assignOrganiser(eventId, organiserId);
      toast.success('Organiser assigned');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assignment failed');
    }
  };

  const handlePublish = async (id) => {
    if (!window.confirm('Publish this event? It will be visible to the public.')) return;
    await publishEvent(id);
    toast.success('Event published');
    load();
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isAdmin ? 'Events' : 'My Events'}</h1>
          <p className="text-gray-500 text-sm">{isAdmin ? 'Manage all events' : 'Manage the events assigned to you'}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Event</Button>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Event</Th>
            <Th>Date</Th>
            <Th>Venue</Th>
            {isAdmin && <Th>Organiser</Th>}
            <Th>Status</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <Tr key={event._id}>
              <Td><p className="font-medium text-gray-900">{event.name}</p></Td>
              <Td>{event.startDate ? format(new Date(event.startDate), 'MMM d, yyyy') : '—'}</Td>
              <Td>{event.venue?.name}, {event.venue?.city}</Td>
              {isAdmin && (
                <Td>
                  {event.mainOrganiser ? (
                    <span className="text-sm font-medium text-blue-600">{event.mainOrganiser.name}</span>
                  ) : (
                    <select
                      onChange={(e) => handleQuickAssign(event._id, e.target.value)}
                      className="text-xs border border-gray-300 rounded px-1 py-0.5"
                      defaultValue=""
                    >
                      <option value="" disabled>Assign...</option>
                      {organisers.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
                    </select>
                  )}
                </Td>
              )}
              <Td><Badge color={statusColor[event.status]}>{event.status}</Badge></Td>
              <Td>
                <div className="flex gap-2">
                  <Link to={isAdmin ? `/admin/events/${event._id}` : `/organiser/events/${event._id}`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                  {isAdmin && event.status === 'draft' && <button onClick={() => handlePublish(event._id)} className="text-xs text-green-600 hover:underline">Publish</button>}
                  {isAdmin && <button onClick={() => handleDelete(event._id)} className="text-xs text-red-600 hover:underline">Delete</button>}
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Event">
        <form onSubmit={handleCreate} className="space-y-4">
          {[['name', 'Event Name', 'text', true], ['description', 'Description', 'text', false], ['venue.name', 'Venue Name', 'text', true], ['venue.city', 'City', 'text', true], ['venue.country', 'Country', 'text', false], ['startDate', 'Start Date', 'datetime-local', true], ['endDate', 'End Date', 'datetime-local', true]].map(([k, label, type, req]) => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}{req && ' *'}</label>
              <input type={type} required={req} value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image (optional)</label>
            <input type="file" accept="image/*" onChange={e => setForm(f => ({ ...f, coverImageFile: e.target.files[0] }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Main Organiser (optional)</label>
              <select value={form.mainOrganiser} onChange={e => setForm(f => ({ ...f, mainOrganiser: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Unassigned —</option>
                {organisers.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={creating}>Create Event</Button>
            <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
};

export default AdminEvents;
