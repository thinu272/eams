import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvent, updateEvent } from '../../api/events';
import { getUsers } from '../../api/users';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import EventForm from '../../components/events/EventForm';
import toast from 'react-hot-toast';

const EventEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [organisers, setOrganisers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    Promise.all([
      getEvent(id),
      getUsers({ role: 'main_organiser' })
    ])
      .then(([eventRes, usersRes]) => {
        setEvent(eventRes.data.data.event);
        setOrganisers(usersRes.data.data.users);
      })
      .catch(err => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (formData) => {
    setUpdating(true);
    try {
      const updateData = { ...formData };
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.slug;
      delete updateData.__v;

      if (updateData.mainOrganiser?._id) {
        updateData.mainOrganiser = updateData.mainOrganiser._id;
      }

      await updateEvent(id, updateData);
      toast.success('Event updated successfully');
      navigate(user?.role === 'main_admin' ? '/admin/events' : '/organiser/dashboard');
    } catch (err) {
      console.error('Update Error:', err.response?.data);
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    </DashboardLayout>
  );

  if (!event) return (
    <DashboardLayout>
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-900">Event not found</h2>
        <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 hover:underline">Go Back</button>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Event</h1>
            <p className="text-gray-500 text-sm">{event.name}</p>
          </div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>

        <EventForm 
          initialData={event} 
          onSubmit={handleSubmit} 
          onCancel={() => navigate(-1)} 
          loading={updating}
        />
      </div>
    </DashboardLayout>
  );
};

export default EventEditPage;
