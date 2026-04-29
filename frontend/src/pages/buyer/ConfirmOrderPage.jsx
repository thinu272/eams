import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrderByToken, finalizeOrder } from '../../api/orders';
import { assignTicket, inviteTicket } from '../../api/attendees';
import { format } from 'date-fns';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import toast from 'react-hot-toast';
import { TicketIcon, CheckBadgeIcon, EnvelopeIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/solid';

const ConfirmOrderPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState({});
  const [assigning, setAssigning] = useState({});

  // Modal state
  const [assignModal, setAssignModal] = useState({ open: false, ticketId: null });
  const [assignForm, setAssignForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    nationalId: '',
    passportNumber: '',
    photo: null
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [assignErrors, setAssignErrors] = useState({});
  const [finalizing, setFinalizing] = useState(false);
  const [inviteModal, setInviteModal] = useState({ open: false, ticketId: null });
  const [inviteForm, setInviteForm] = useState({ email: '', phone: '', notificationChannel: 'email' });

  const load = () => getOrderByToken(token).then(r => setData(r.data.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, [token]);

  const handleInvite = async (ticketId) => {
    setInviteModal({ open: true, ticketId });
    setInviteForm({ email: '', phone: '', notificationChannel: 'email' });
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteForm.email) return toast.error('Email is required');
    if ((inviteForm.notificationChannel === 'sms' || inviteForm.notificationChannel === 'both') && !inviteForm.phone) {
      return toast.error('Phone number is required for SMS notifications');
    }
    if (inviteForm.phone && !phoneRegex.test(inviteForm.phone.trim())) {
      return toast.error('Enter a valid international phone number (e.g. +1234567890)');
    }
    setInviting(i => ({...i, [inviteModal.ticketId]: true}));
    try {
      await inviteTicket({
        ticketId: inviteModal.ticketId,
        email: inviteForm.email,
        phone: inviteForm.phone,
        notificationChannel: inviteForm.notificationChannel,
      });
      toast.success(`Invite sent to ${inviteForm.email}`);
      setInviteModal({ open: false, ticketId: null });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invite');
    } finally {
      setInviting(i => ({...i, [inviteModal.ticketId]: false}));
    }
  };

  const handleAssignMyself = (ticketId) => {
    setAssignModal({ open: true, ticketId });
    setAssignForm({
      fullName: order?.buyerName || '',
      email: order?.buyerEmail || '',
      phone: order?.buyerPhone || '',
      dateOfBirth: '',
      nationalId: '',
      passportNumber: '',
      photo: null
    });
    setPhotoPreview(null);
    setAssignErrors({});
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setAssigning(a => ({...a, [assignModal.ticketId]: true}));
    setAssignErrors({});

    try {
      let data;
      
      if (assignForm.phone && !/^\+?[0-9]{9,15}$/.test(assignForm.phone.trim())) {
        setAssignErrors({ phone: 'Phone number is invalid' });
        setAssigning(a => ({...a, [assignModal.ticketId]: false}));
        return;
      }

      if (assignForm.photo) {
        // Use FormData for file upload
        data = new FormData();
        data.append('ticketId', assignModal.ticketId);
        data.append('fullName', assignForm.fullName);
        data.append('email', assignForm.email);
        data.append('phone', assignForm.phone);
        data.append('dateOfBirth', assignForm.dateOfBirth);
        data.append('nationalId', assignForm.nationalId);
        data.append('passportNumber', assignForm.passportNumber);
        data.append('photo', assignForm.photo);
      } else {
        // Use regular JSON for non-file data
        data = {
          ticketId: assignModal.ticketId,
          fullName: assignForm.fullName,
          email: assignForm.email,
          phone: assignForm.phone,
          dateOfBirth: assignForm.dateOfBirth,
          nationalId: assignForm.nationalId,
          passportNumber: assignForm.passportNumber
        };
      }

      await assignTicket(data);
      toast.success('Ticket assigned successfully!');
      setAssignModal({ open: false, ticketId: null });
      setPhotoPreview(null);
      load(); // Refresh data
    } catch (err) {
      if (err.response?.data?.errors) {
        const errors = {};
        err.response.data.errors.forEach(error => {
          errors[error.path] = error.msg;
        });
        setAssignErrors(errors);
      } else {
        toast.error('Failed to assign ticket');
      }
    } finally {
      setAssigning(a => ({...a, [assignModal.ticketId]: false}));
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading your order...</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <TicketIcon className="mx-auto h-10 w-10 text-blue-600 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
        <p className="text-gray-600 mb-6">This order confirmation link may have expired or is invalid.</p>
        <Button onClick={() => navigate('/')}>Go to Home</Button>
      </div>
    </div>
  );

  const { order, tickets } = data;
  const assigned = tickets.filter(t => t.status === 'ASSIGNED' || t.status === 'CONFIRMED').length;
  const progressPercentage = tickets.length > 0 ? (assigned / tickets.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-4">
              <TicketIcon className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Confirm Your Tickets</h1>
            <p className="text-blue-100">Order #{order.orderNumber} • {order.event?.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Progress Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Confirmation Progress</h2>
            <span className="text-sm text-gray-600">{assigned} of {tickets.length} assigned</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          {assigned === tickets.length ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-green-700 bg-green-50 rounded-lg px-4 py-3">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckBadgeIcon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-medium">All tickets assigned!</p>
                  <p className="text-sm text-green-600">Complete confirmation to finalize and send final ticket notifications with QR codes.</p>
                </div>
              </div>
              <Button onClick={async () => {
                if (!order?._id) return;
                setFinalizing(true);
                try {
                  await finalizeOrder(order._id);
                  toast.success('Tickets confirmed. Check your email or SMS shortly.');
                  load();
                } catch (err) {
                  console.error('Finalize error:', err);
                  toast.error(err.response?.data?.message || 'Failed to finalize order');
                } finally {
                  setFinalizing(false);
                }
              }} loading={finalizing} className="w-full">
                Complete Confirmation
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Please confirm all ticket holders to complete your order.
            </p>
          )}
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
          
          {/* Buyer Information */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Buyer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-xs text-gray-500 block uppercase tracking-wide">Name</span>
                <p className="font-medium text-gray-900">{order?.buyerName || 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 block uppercase tracking-wide">Email</span>
                <p className="font-medium text-gray-900">{order?.buyerEmail || 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 block uppercase tracking-wide">Phone</span>
                <p className="font-medium text-gray-900">{order?.buyerPhone || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Event Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500 block">Event Name</span>
                <p className="font-medium text-gray-900">{order?.event?.name || 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 block">Date & Time</span>
                <p className="font-medium text-gray-900">
                  {order?.event?.startDate ? format(new Date(order.event.startDate), 'EEEE, MMMM d, yyyy \'at\' h:mm a') : 'TBD'}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500 block">Venue</span>
                <p className="font-medium text-gray-900">{order?.event?.venue?.name || 'N/A'}</p>
                {order?.event?.venue?.address && (
                  <p className="text-sm text-gray-600">{order.event.venue.address}</p>
                )}
              </div>
              <div>
                <span className="text-sm text-gray-500 block">Total Amount</span>
                <p className="font-medium text-gray-900 text-lg">LKR {order?.totalAmount?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tickets Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Your Tickets ({tickets.length})</h2>
            <Badge color={assigned === tickets.length ? 'green' : 'blue'}>
              {assigned}/{tickets.length} Assigned
            </Badge>
          </div>

          <div className="space-y-4">
            {tickets.map((ticket, index) => (
              <div key={ticket._id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{ticket.categoryName}</h3>
                        <p className="text-sm text-gray-600">Ticket #{ticket.ticketNumber}</p>
                      </div>
                      <Badge
                        color={
                          ticket.status === 'ASSIGNED' ? 'green' :
                          ticket.status === 'INVITED' ? 'blue' :
                          ticket.status === 'CONFIRMED' ? 'green' :
                          ticket.status === 'PENDING' ? 'yellow' : 'gray'
                        }
                      >
                        {ticket.status === 'PENDING' ? 'Needs Assignment' :
                         ticket.status === 'ASSIGNED' ? 'Assigned' :
                         ticket.status === 'INVITED' ? 'Invited' :
                         ticket.status === 'CONFIRMED' ? 'Confirmed' : ticket.status}
                      </Badge>
                    </div>

                    {ticket.attendee && (
                      <div className="ml-11 mt-2 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-start gap-3">
                          {ticket.attendee.photo && (
                            <div className="flex-shrink-0">
                              <img
                                src={`http://localhost:5000/${ticket.attendee.photo}`}
                                alt={ticket.attendee.fullName}
                                className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{ticket.attendee.fullName}</p>
                            <p className="text-sm text-gray-600">{ticket.attendee.email}</p>
                            {ticket.attendee.photoVerificationStatus && (
                              <div className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                <PhotoIcon className="h-3.5 w-3.5" />
                                <span>Photo {ticket.attendee.photoVerificationStatus}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {ticket.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAssignMyself(ticket._id)}
                          loading={assigning[ticket._id]}
                          className="whitespace-nowrap"
                        >
                          Assign Myself
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={inviting[ticket._id]}
                          onClick={() => handleInvite(ticket._id)}
                        >
                          Send Invite
                        </Button>
                      </>
                    )}
                    {ticket.status === 'INVITED' && (
                      <div className="text-center">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-1">
                          <EnvelopeIcon className="h-4 w-4" />
                        </div>
                        <p className="text-xs text-blue-600 font-medium">Invite Sent</p>
                        <p className="text-xs text-gray-500">{ticket.inviteEmail}</p>
                      </div>
                    )}
                    {(ticket.status === 'ASSIGNED' || ticket.status === 'CONFIRMED') && (
                      <div className="text-center">
                        <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-1">
                          <CheckBadgeIcon className="h-4 w-4" />
                        </div>
                        <p className="text-xs text-green-600 font-medium">Assigned</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-blue-50 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
          <p className="text-blue-700 text-sm mb-4">
            If you have any questions about confirming your tickets or need assistance,
            please contact our support team.
          </p>
          <div className="flex gap-4">
            <Button size="sm" variant="outline" onClick={() => window.location.href = 'mailto:support@entrynex.com'}>
              Email Support
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open('tel:+94123456789', '_self')}>
              Call Support
            </Button>
          </div>
        </div>
      </div>

      {/* Assign Myself Modal */}
      <Modal
        open={assignModal.open}
        onClose={() => setAssignModal({ open: false, ticketId: null })}
        title="Assign Ticket to Yourself"
        size="md"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <Input
            label="Full Name *"
            value={assignForm.fullName}
            onChange={(e) => setAssignForm(f => ({...f, fullName: e.target.value}))}
            error={assignErrors.fullName}
            placeholder="Enter your full name"
            required
          />

          <Input
            label="Email Address *"
            type="email"
            value={assignForm.email}
            onChange={(e) => setAssignForm(f => ({...f, email: e.target.value}))}
            error={assignErrors.email}
            placeholder="Enter your email address"
            required
          />

          <Input
            label="Phone Number"
            type="tel"
            value={assignForm.phone}
            onChange={(e) => setAssignForm(f => ({...f, phone: e.target.value}))}
            error={assignErrors.phone}
            placeholder="+1234567890"
          />

          <Input
            label="Date of Birth"
            type="date"
            value={assignForm.dateOfBirth}
            onChange={(e) => setAssignForm(f => ({...f, dateOfBirth: e.target.value}))}
            error={assignErrors.dateOfBirth}
          />

          <Input
            label="National ID / NIC"
            value={assignForm.nationalId}
            onChange={(e) => setAssignForm(f => ({...f, nationalId: e.target.value}))}
            error={assignErrors.nationalId}
            placeholder="Enter your National ID or NIC number"
          />

          <Input
            label="Passport Number"
            value={assignForm.passportNumber}
            onChange={(e) => setAssignForm(f => ({...f, passportNumber: e.target.value}))}
            error={assignErrors.passportNumber}
            placeholder="Enter your passport number (if applicable)"
          />

          {/* Photo Upload Section */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Photo for Verification <span className="text-gray-400 text-xs">(Optional but recommended)</span>
            </label>
            <div className="flex flex-col gap-3">
              {/* File Input */}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    const file = e.target.files[0];
                    // Validate file size (5MB)
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error('Photo must be less than 5MB');
                      return;
                    }
                    setAssignForm(f => ({...f, photo: file}));
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setPhotoPreview(reader.result);
                    };
                    reader.readAsDataURL(file);
                    toast.success('Photo selected');
                  }
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              
              {/* Photo Preview */}
              {photoPreview && (
                <div className="relative flex justify-center">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="max-w-xs max-h-48 rounded-lg border-2 border-blue-200 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAssignForm(f => ({...f, photo: null}));
                      setPhotoPreview(null);
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-red-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
              
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <PhotoIcon className="h-3.5 w-3.5" />
                <span>Upload a clear photo of your face for identity verification at event entry.</span>
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignModal({ open: false, ticketId: null })}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={assigning[assignModal.ticketId]}
              className="flex-1"
            >
              Assign Ticket
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={inviteModal.open}
        onClose={() => setInviteModal({ open: false, ticketId: null })}
        title="Send Invite"
        size="md"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          <Input
            label="Email Address *"
            type="email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))}
            placeholder="Enter invite email"
            required
          />
          <Input
            label="Phone Number"
            type="tel"
            value={inviteForm.phone}
            onChange={(e) => setInviteForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+1234567890"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Send Via</label>
            <select
              value={inviteForm.notificationChannel}
              onChange={(e) => setInviteForm(f => ({ ...f, notificationChannel: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="both">Email + SMS</option>
            </select>
          </div>
          <div className="flex gap-3">
            <Button type="submit">Send</Button>
            <Button variant="outline" type="button" onClick={() => setInviteModal({ open: false, ticketId: null })}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ConfirmOrderPage;
