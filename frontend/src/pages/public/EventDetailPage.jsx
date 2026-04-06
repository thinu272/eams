import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvent } from '../../api/events';
import PublicLayout from '../../components/layout/PublicLayout';
import EventHeader from '../../components/events/EventHeader';
import TicketSelector from '../../components/events/TicketSelector';
import SummaryCard from '../../components/events/SummaryCard';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';

const EventDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTickets, setSelectedTickets] = useState({});

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await getEvent(slug);
        setEvent(response.data.data.event);
        // Initialize selected tickets
        const initialSelected = {};
        response.data.data.event.categories.forEach(cat => {
          initialSelected[cat.id] = 0;
        });
        setSelectedTickets(initialSelected);
      } catch (err) {
        setError('Event not found');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [slug]);

  const handleQuantityChange = (categoryId, quantity) => {
    setSelectedTickets(prev => ({
      ...prev,
      [categoryId]: Math.max(0, quantity)
    }));
  };

  const handleProceedToCheckout = () => {
    const totalTickets = Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0);
    if (totalTickets === 0) return;

    // Store selection in localStorage
    const checkoutData = {
      eventId: event._id,
      eventName: event.name,
      selectedTickets,
      categories: event.categories,
    };
    localStorage.setItem('checkoutData', JSON.stringify(checkoutData));
    navigate('/checkout');
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSkeleton />
        </div>
      </PublicLayout>
    );
  }

  if (error || !event) {
    return (
      <PublicLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{error || 'Event not found'}</h2>
            <button
              onClick={() => navigate('/events')}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Back to Events
            </button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const totalTickets = Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0);
  const totalPrice = event.categories.reduce((sum, cat) => {
    return sum + (cat.price * (selectedTickets[cat.id] || 0));
  }, 0);

  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <EventHeader event={event} />
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Tickets</h2>
              <TicketSelector
                categories={event.categories}
                selectedTickets={selectedTickets}
                onQuantityChange={handleQuantityChange}
              />
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <SummaryCard
                selectedTickets={selectedTickets}
                categories={event.categories}
                totalTickets={totalTickets}
                totalPrice={totalPrice}
                onProceedToCheckout={handleProceedToCheckout}
              />
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default EventDetailPage;
