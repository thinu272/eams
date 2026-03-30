import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getOrderByToken } from '../../api/orders';
import { inviteAttendee, confirmIdentity, getConfirmInfo } from '../../api/attendees';
import { format } from 'date-fns';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';

const ConfirmOrderPage = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState({});

  const load = () => getOrderByToken(token).then(r => setData(r.data.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, [token]);

  const handleInvite = async (ticketId, email) => {
    const emailAddr = prompt('Enter the email address to invite:');
    if (!emailAddr) return;
    setInviting(i => ({...i, [ticketId]: true}));
    try {
      await inviteAttendee(ticketId);
      toast.success(`Invite sent to ${emailAddr}`);
      load();
    } catch (err) { toast.error('Failed to send invite'); }
    finally { setInviting(i => ({...i, [ticketId]: false})); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center"><p className="text-gray-500">Order not found or link expired.</p></div>
    </div>
  );

  const { order, tickets } = data;
  const confirmed = tickets.filter(t => t.status === 'confirmed').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-10">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-sm">E</span></div>
            <span className="font-bold">EAMS</span>
          </div>
          <h1 className="text-2xl font-bold">Confirm Your Tickets</h1>
          <p className="text-blue-200 text-sm mt-1">Order {order.orderNumber} — {order.event?.name}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Progress */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Confirmation progress</span>
            <span className="text-sm text-gray-500">{confirmed} of {tickets.length} confirmed</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${(confirmed / tickets.length) * 100}%` }}/>
          </div>
          {confirmed === tickets.length && (
            <div className="mt-3 flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <span>✓</span><span className="text-sm font-medium">All tickets confirmed! Check your email for final confirmation.</span>
            </div>
          )}
        </div>

        {/* Event info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">{order.event?.name}</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Date</span><p className="font-medium">{order.event?.startDate ? format(new Date(order.event.startDate), 'EEE, MMM d yyyy') : 'TBD'}</p></div>
            <div><span className="text-gray-500">Venue</span><p className="font-medium">{order.event?.venue?.name}</p></div>
            <div><span className="text-gray-500">Total Paid</span><p className="font-medium">LKR {order.totalAmount?.toLocaleString()}</p></div>
            <div><span className="text-gray-500">Order No.</span><p className="font-medium">{order.orderNumber}</p></div>
          </div>
        </div>

        {/* Tickets */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Ticket Slots ({tickets.length})</h3>
          <div className="space-y-3">
            {tickets.map((ticket, i) => (
              <div key={ticket._id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">Ticket {i + 1}</span>
                      <Badge color={ticket.status === 'confirmed' ? 'green' : ticket.status === 'invited' ? 'blue' : 'gray'}>
                        {ticket.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">{ticket.categoryName}</p>
                    {ticket.attendee && <p className="text-sm font-medium text-gray-700 mt-1">{ticket.attendee.fullName}</p>}
                  </div>
                  <div className="flex gap-2">
                    {ticket.status === 'unassigned' && (
                      <>
                        <a href={`/attendee/confirm/${ticket.attendee?.confirmationToken}`} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Fill myself</a>
                        <Button size="sm" variant="outline" loading={inviting[ticket._id]} onClick={() => handleInvite(ticket._id)}>Invite</Button>
                      </>
                    )}
                    {ticket.status === 'invited' && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Invite sent</span>}
                    {ticket.status === 'confirmed' && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">✓ Confirmed</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmOrderPage;
