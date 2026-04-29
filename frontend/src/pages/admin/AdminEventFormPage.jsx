import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import EventForm from '../../components/admin/EventForm';
import { createEvent, getEventForEdit, updateEvent } from '../../api/events';
import toast from 'react-hot-toast';

const AdminEventFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);

  useEffect(() => {
    if (!id) return;
    getEventForEdit(id)
      .then((res) => setInitialData(res.data?.data?.event || null))
      .catch(() => toast.error('Failed to load event'))
      .finally(() => setFetching(false));
  }, [id]);

  const handleSubmit = async (payload, filesObject) => {
    setLoading(true);
    try {
      const hasFiles = filesObject && Object.values(filesObject).some(file => !!file);

      if (hasFiles) {
        const formData = new FormData();
        Object.keys(payload).forEach((key) => {
          const value = payload[key];
          if (value === undefined) return;
          if (typeof value === 'object') {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value);
          }
        });
        
        if (filesObject.coverImage) formData.append('coverImage', filesObject.coverImage);
        if (filesObject.logoImage) formData.append('logoImage', filesObject.logoImage);
        if (filesObject.bannerImage) formData.append('bannerImage', filesObject.bannerImage);

        if (id) {
          await updateEvent(id, formData);
        } else {
          await createEvent(formData);
        }
      } else if (id) {
        await updateEvent(id, payload);
      } else {
        await createEvent(payload);
      }
      toast.success(id ? 'Event updated' : 'Event created');
      navigate('/admin/events');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-semibold">Event Builder</p>
          <h1 className="text-3xl font-bold text-slate-900">{id ? 'Edit Event' : 'Create New Event'}</h1>
          <p className="text-sm text-slate-500">Configure ticket categories, zones, and attendee requirements.</p>
          <Link to="/admin/events" className="text-sm text-blue-600 hover:text-blue-700">Back to All Events</Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {fetching ? (
            <p className="text-sm text-slate-500">Loading event data...</p>
          ) : (
            <EventForm initialData={initialData} onSubmit={handleSubmit} loading={loading} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminEventFormPage;
