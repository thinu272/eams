import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getConfirmInfo } from '../../api/attendees';
import { getUserTicket } from '../../api/userPortal';
import PublicLayout from '../../components/layout/PublicLayout';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const TicketWalletPage = () => {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isObjectId = /^[a-f\d]{24}$/i.test(token || '');
    if (isObjectId && authLoading) {
      return;
    }

    const request = isObjectId && user?.role === 'buyer'
      ? getUserTicket(token).then((res) => ({ mode: 'private', ticket: res.data?.data?.ticket || null }))
      : getConfirmInfo(token).then((res) => {
          const attendee = res.data?.data?.attendee || null;
          return {
            mode: 'public',
            ticket: attendee ? {
              attendee,
              categoryName: attendee.categoryName,
              allowedZones: attendee.allowedZones || [],
              event: attendee.event,
            } : null,
          };
        });

    request
      .then((result) => setTicket(result.ticket))
      .catch(() => toast.error('Ticket not found'))
      .finally(() => setLoading(false));
  }, [token, user, authLoading]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-blue-600 font-medium mb-2">Ticket Wallet</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{ticket?.attendee?.fullName || ticket?.event?.name || 'Ticket not available'}</h1>
          <p className="text-gray-600 text-sm mb-6">
            Show this QR code at entry. Keep this page open for quick access.
          </p>

          {ticket?.attendee?.qrCode ? (
            <div className="flex flex-col items-center gap-4">
              <img src={ticket.attendee.qrCode} alt="Ticket QR" className="w-64 h-64 object-contain border border-gray-200 rounded-xl" />
              <div className="text-sm text-gray-600 text-center">
                <p><span className="font-medium">Event:</span> {ticket.event?.name}</p>
                <p><span className="font-medium">Category:</span> {ticket.categoryName}</p>
              </div>
              {(ticket.allowedZones || ticket.attendee?.allowedZones || []).length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {(ticket.allowedZones || ticket.attendee?.allowedZones || []).map((zone) => (
                    <Badge key={zone} color="blue">{zone}</Badge>
                  ))}
                </div>
              )}
              {ticket.event && (
                <div className="w-full rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                  <p className="font-semibold text-gray-900">{ticket.event.name}</p>
                  <p className="mt-1">{ticket.event.venue?.name}{ticket.event.venue?.city ? `, ${ticket.event.venue.city}` : ''}</p>
                  {ticket.event.description && <p className="mt-2">{ticket.event.description}</p>}
                </div>
              )}
              <Button onClick={() => window.print()} variant="outline">Print QR</Button>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
              Ticket QR is not ready yet.
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
};

export default TicketWalletPage;
