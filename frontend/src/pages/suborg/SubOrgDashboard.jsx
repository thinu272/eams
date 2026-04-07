import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyEvents } from '../../api/events';
import { getAttendees } from '../../api/attendees';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Stat from '../../components/ui/Stat';
import Badge from '../../components/ui/Badge';
import {
  ArrowUpTrayIcon,
  CameraIcon,
  CheckBadgeIcon,
  EnvelopeIcon,
  UserPlusIcon,
  UsersIcon,
} from '@heroicons/react/24/solid';

const actionCards = [
  {
    to: '/suborg/attendees',
    label: 'Add Attendees',
    description: 'Register attendees one by one and send invites.',
    icon: UserPlusIcon,
    containerClass: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    iconClass: 'bg-blue-100 text-blue-700',
  },
  {
    to: '/suborg/upload',
    label: 'Bulk Upload',
    description: 'Import attendee lists from Excel files.',
    icon: ArrowUpTrayIcon,
    containerClass: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
    iconClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    to: '/suborg/verify',
    label: 'Photo Verification',
    description: 'Review uploaded identity photos quickly.',
    icon: CameraIcon,
    containerClass: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
    iconClass: 'bg-amber-100 text-amber-700',
  },
];

const confirmationColors = {
  confirmed: 'green',
  invited: 'blue',
  pending: 'yellow',
  rejected: 'red',
};

const photoColors = {
  verified: 'green',
  pending: 'yellow',
  rejected: 'red',
};

const SubOrgDashboard = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMyEvents().then((response) => {
      const myEvents = response.data?.data?.events || [];
      setEvents(myEvents);
      if (myEvents.length > 0) {
        setSelectedEvent(myEvents[0]._id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;

    setLoading(true);
    getAttendees({ eventId: selectedEvent, limit: 100 })
      .then((response) => {
        setAttendees(response.data?.data?.attendees || []);
      })
      .finally(() => setLoading(false));
  }, [selectedEvent]);

  const selectedEventData = useMemo(
    () => events.find((event) => event._id === selectedEvent),
    [events, selectedEvent]
  );

  const stats = useMemo(() => {
    const total = attendees.length;
    const confirmed = attendees.filter((attendee) => attendee.confirmationStatus === 'confirmed').length;
    const invited = attendees.filter((attendee) => attendee.confirmationStatus === 'invited').length;
    const pendingPhotos = attendees.filter(
      (attendee) => attendee.photo && attendee.photoVerificationStatus === 'pending'
    ).length;

    return { total, confirmed, invited, pendingPhotos };
  }, [attendees]);

  const actionQueue = useMemo(() => {
    return attendees
      .filter(
        (attendee) =>
          attendee.confirmationStatus !== 'confirmed' ||
          (attendee.photo && attendee.photoVerificationStatus === 'pending')
      )
      .slice(0, 5);
  }, [attendees]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sub-Organiser Dashboard</h1>
            <p className="text-sm text-gray-500">Manage attendee intake, bulk imports, invites, and photo review for your assigned events.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
              Signed in as <span className="font-semibold text-gray-900">{user?.name || 'Sub Organiser'}</span>
            </div>
            <select
              value={selectedEvent}
              onChange={(event) => setSelectedEvent(event.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            >
              {events.map((event) => (
                <option key={event._id} value={event._id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-cyan-50 to-white p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Assigned Event</p>
              <h2 className="text-2xl font-bold text-gray-900">{selectedEventData?.name || 'Select an event'}</h2>
              <p className="max-w-2xl text-sm text-gray-600">
                Keep attendee data moving smoothly from upload to invite to photo verification. The sections below only appear for your permitted role and assigned events.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
              <div className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-blue-100">
                <p className="text-xs text-gray-500">Categories</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{selectedEventData?.categories?.length || 0}</p>
              </div>
              <div className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-blue-100">
                <p className="text-xs text-gray-500">Zones</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{selectedEventData?.zones?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Assigned Events" value={events.length} color="blue" icon={<UsersIcon className="h-5 w-5" />} />
          <Stat label="Attendees Loaded" value={stats.total} color="green" icon={<UsersIcon className="h-5 w-5" />} />
          <Stat label="Invites / Confirmed" value={`${stats.invited}/${stats.confirmed}`} color="purple" icon={<EnvelopeIcon className="h-5 w-5" />} />
          <Stat label="Photos Pending" value={stats.pendingPhotos} color="orange" icon={<CheckBadgeIcon className="h-5 w-5" />} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Operational Shortcuts</h3>
                  <p className="text-sm text-gray-500">Jump straight into the core workflows for attendee operations.</p>
                </div>
                {loading && <p className="text-xs text-gray-400">Refreshing event data...</p>}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {actionCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Link
                      key={card.to}
                      to={card.to}
                      className={`rounded-2xl border p-5 transition-colors ${card.containerClass}`}
                    >
                      <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${card.iconClass}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900">{card.label}</h4>
                      <p className="mt-2 text-sm text-gray-600">{card.description}</p>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Action Queue</h3>
                  <p className="text-sm text-gray-500">Attendees who still need confirmation follow-up or photo review.</p>
                </div>
                <Link to="/suborg/attendees" className="text-sm font-medium text-blue-600 hover:underline">
                  Open attendee desk
                </Link>
              </div>

              <div className="space-y-3">
                {actionQueue.map((attendee) => (
                  <div key={attendee._id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{attendee.fullName || 'Unnamed attendee'}</p>
                      <p className="text-sm text-gray-500">{attendee.email || attendee.phone || attendee.categoryName || 'No contact details yet'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge color={confirmationColors[attendee.confirmationStatus] || 'gray'}>
                        {attendee.confirmationStatus}
                      </Badge>
                      {attendee.photo && (
                        <Badge color={photoColors[attendee.photoVerificationStatus] || 'gray'}>
                          photo {attendee.photoVerificationStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {!loading && actionQueue.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                    Everyone in this sample set looks up to date. New uploads and confirmations will appear here as work comes in.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-gray-900">Current Snapshot</h3>
            <p className="mt-1 text-sm text-gray-500">A quick read on where attendee processing stands for the selected event.</p>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Confirmed attendees</span>
                  <span className="text-sm font-semibold text-gray-900">{stats.confirmed}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${stats.total ? (stats.confirmed / stats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Invite follow-ups</span>
                  <span className="text-sm font-semibold text-gray-900">{stats.invited}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${stats.total ? (stats.invited / stats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Pending photo review</span>
                  <span className="text-sm font-semibold text-gray-900">{stats.pendingPhotos}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-amber-500"
                    style={{ width: `${stats.total ? (stats.pendingPhotos / stats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SubOrgDashboard;
