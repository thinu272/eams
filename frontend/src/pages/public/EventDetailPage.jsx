import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvent } from '../../api/events';
import { createOrder } from '../../api/orders';
import { format } from 'date-fns';
import PublicLayout from '../../components/layout/PublicLayout';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const EventDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});
  const [buyerInfo, setBuyerInfo] = useState({ name: '', email: '', phone: '' });
  const [placing, setPlacing] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    getEvent(slug).then(r => {
      setEvent(r.data.data.event);
      const q = {};
      r.data.data.event.categories.forEach(c => { q[c.id] = 0; });
      setQuantities(q);
    }).catch(() => navigate('/404')).finally(() => setLoading(false));
  }, [slug, navigate]);

  const totalTickets = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalPrice = event?.categories.reduce((sum, c) => sum + (c.price * (quantities[c.id] || 0)), 0) || 0;

  const handleOrder = async () => {
    if (!buyerInfo.name || !buyerInfo.email) return toast.error('Name and email required');
    const items = event.categories.filter(c => (quantities[c.id] || 0) > 0).map(c => ({ categoryId: c.id, quantity: quantities[c.id] }));
    if (items.length === 0) return toast.error('Select at least one ticket');
    setPlacing(true);
    try {
      const { data } = await createOrder({ eventId: event._id, ...buyerInfo, buyerName: buyerInfo.name, buyerEmail: buyerInfo.email, buyerPhone: buyerInfo.phone, items });
      toast.success('Order placed! Check your email for the confirmation link.');
      navigate(`/confirm/${data.data.order.confirmationLink}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Order failed');
    } finally { setPlacing(false); }
  };

  if (loading) return <PublicLayout><div className="flex items-center justify-center py-32"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/></div></PublicLayout>;
  if (!event) return null;

  return (
    <PublicLayout>
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {event.matchDetails?.teamA && <p className="text-blue-300 text-sm font-medium mb-2">{event.matchDetails.teamA} vs {event.matchDetails.teamB} — {event.matchDetails.matchType}</p>}
          <h1 className="text-4xl font-bold mb-4">{event.name}</h1>
          <div className="flex flex-wrap gap-6 text-blue-200 text-sm">
            <span>📅 {format(new Date(event.startDate), 'EEEE, MMMM d, yyyy')}</span>
            <span>📍 {event.venue?.name}, {event.venue?.city}</span>
            {event.gatesOpenTime && <span>🚪 Gates open {format(new Date(event.gatesOpenTime), 'h:mm a')}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Categories */}
          <div className="lg:col-span-2 space-y-6">
            <p className="text-gray-600">{event.description}</p>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Select Tickets</h2>
              <div className="space-y-3">
                {event.categories.map(cat => {
                  const remaining = cat.capacity - cat.sold;
                  const soldOut = remaining <= 0;
                  return (
                    <div key={cat.id} className={`border rounded-xl p-5 transition-all ${soldOut ? 'opacity-50 bg-gray-50' : 'bg-white hover:border-blue-300'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="w-3 h-3 rounded-full" style={{ background: cat.color }}/>
                            <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                            {soldOut && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Sold Out</span>}
                          </div>
                          <p className="text-sm text-gray-500 mb-2">{cat.description}</p>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {(cat.benefits || []).map((b, i) => <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">✓ {b}</span>)}
                          </div>
                          <p className="text-xs text-gray-400">{remaining > 0 ? `${remaining} remaining` : 'Sold out'}</p>
                        </div>
                        <div className="ml-6 text-right">
                          <p className="text-lg font-bold text-gray-900 mb-2">{cat.price === 0 ? 'Free' : `LKR ${cat.price.toLocaleString()}`}</p>
                          {!soldOut && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => setQuantities(q => ({ ...q, [cat.id]: Math.max(0, (q[cat.id] || 0) - 1) }))} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100">-</button>
                              <span className="w-8 text-center font-medium">{quantities[cat.id] || 0}</span>
                              <button onClick={() => setQuantities(q => ({ ...q, [cat.id]: Math.min(remaining, (q[cat.id] || 0) + 1) }))} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100">+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Zones info */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Venue Zones</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(event.zones || []).map(zone => (
                  <div key={zone.id} className="border rounded-lg p-3 bg-white">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ background: zone.color }}/>
                      <span className="font-medium text-sm text-gray-900">{zone.name}</span>
                    </div>
                    {zone.description && <p className="text-xs text-gray-500">{zone.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Order summary */}
          <div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
              {totalTickets === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No tickets selected</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {event.categories.filter(c => (quantities[c.id] || 0) > 0).map(c => (
                    <div key={c.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">{quantities[c.id]}x {c.name}</span>
                      <span className="font-medium">LKR {(c.price * quantities[c.id]).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
                    <span>Total ({totalTickets} tickets)</span>
                    <span>LKR {totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {step === 1 && totalTickets > 0 && (
                <Button className="w-full" onClick={() => setStep(2)}>Continue to Checkout</Button>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <input placeholder="Full Name *" value={buyerInfo.name} onChange={e => setBuyerInfo(b => ({...b, name: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                  <input placeholder="Email Address *" type="email" value={buyerInfo.email} onChange={e => setBuyerInfo(b => ({...b, email: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                  <input placeholder="Phone Number" value={buyerInfo.phone} onChange={e => setBuyerInfo(b => ({...b, phone: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                  <p className="text-xs text-gray-500">Total: <strong>LKR {totalPrice.toLocaleString()}</strong></p>
                  <Button className="w-full" onClick={handleOrder} loading={placing}>Place Order & Pay</Button>
                  <button onClick={() => setStep(1)} className="w-full text-sm text-gray-500 hover:text-gray-700">← Back</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default EventDetailPage;
