import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  LockClosedIcon,
  LockOpenIcon,
} from '@heroicons/react/24/outline';
import PublicLayout from '../../components/layout/PublicLayout';
import { getEvent, validateEventAccessCode } from '../../api/events';
import { io } from 'socket.io-client';
import { getSocketUrl, getAssetUrl } from '../../utils/backend';

const getCategoryId = (category) => category?.id || category?._id || category?.name;
const getZoneId = (zone) => zone?.id || zone?._id || zone?.name;

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState({});
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [unlockedCategories, setUnlockedCategories] = useState([]);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [accessCode, setAccessCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [codeError, setCodeError] = useState('');

  const fetchEvent = () => {
    getEvent(id)
      .then((res) => {
        setEvent(res.data?.data?.event);
        setIsExpired(res.data?.data?.isExpired || false);
      })
      .catch((err) => {
        console.error('FETCH_EVENT_ERROR:', err);
        setEvent(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvent();
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;
    const socket = io(getSocketUrl());
    socket.emit('join_event', { eventId: id });
    socket.on('event_update', () => fetchEvent());
    return () => {
      socket.emit('leave_event', { eventId: id });
      socket.disconnect();
    };
  }, [id]);

  const handleQuantityChange = (categoryId, quantity) => {
    setSelectedTickets((prev) => ({
      ...prev,
      [categoryId]: Math.max(0, quantity),
    }));
  };

  const handleValidateCode = async (e) => {
    e.preventDefault();
    if (!accessCode.trim()) return;
    setIsValidating(true);
    setCodeError('');
    try {
      const response = await validateEventAccessCode(event.slug || event._id, {
        categoryId: activeCategoryId,
        accessCode: accessCode.trim(),
      });
      const data = response.data;
      if (data.success) {
        setUnlockedCategories((prev) => [...prev, activeCategoryId]);
        setIsCodeModalOpen(false);
        setAccessCode('');
      } else {
        setCodeError(data.message || 'Invalid access code.');
      }
    } catch (err) {
      setCodeError(err.response?.data?.message || 'Failed to validate code. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-blue-600 border-t-transparent" />
        </div>
      </PublicLayout>
    );
  }

  if (!event) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-600">
            Event unavailable
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            We could not find that event
          </h1>
          <p className="mt-4 text-base text-slate-500 max-w-md mx-auto">
            The event may have been removed, sold out, or the URL might be incorrect.
          </p>
          <div className="mt-8">
            <Link
              to="/events"
              className="inline-flex rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition-all"
            >
              Back to fixtures
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const allZones = event.zones || [];
  const categories = (event.categories || []).filter((c) => c.isVisible !== false);
  const totalTickets = Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0);
  const totalPrice = categories.reduce((sum, category) => {
    return sum + category.price * (selectedTickets[getCategoryId(category)] || 0);
  }, 0);
  const selectedCategories = categories.filter(
    (category) => selectedTickets[getCategoryId(category)] > 0
  );
  const themeColor = '#2563EB';
  const heroImage = event.branding?.bannerImage || event.coverImage || event.bannerImage;

  const formatCurrency = (value) =>
    value === 0
      ? 'Free'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: event.settings?.currency || 'LKR',
          maximumFractionDigits: 0,
        }).format(value);

  let eventDate = 'TBD';
  try {
    if (event.startDate) {
      const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
      if (event.timezone) options.timeZone = event.timezone;
      eventDate = new Date(event.startDate).toLocaleDateString('en-US', options);
    }
  } catch {
    eventDate = event.startDate
      ? new Date(event.startDate).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'TBD';
  }

  let eventTime = 'TBD';
  try {
    if (event.startDate) {
      const options = { hour: '2-digit', minute: '2-digit' };
      if (event.timezone) options.timeZone = event.timezone;
      eventTime = new Date(event.startDate).toLocaleTimeString('en-US', options);
    }
  } catch {
    eventTime = event.startDate
      ? new Date(event.startDate).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'TBD';
  }

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {heroImage && (
          <img
            src={getAssetUrl(heroImage)}
            alt={event.name}
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div
            className={`grid grid-cols-1 gap-10 ${
              isExpired ? '' : 'lg:grid-cols-[1fr_320px] lg:items-end'
            }`}
          >
            <div>
              <Link
                to="/events"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to listings
              </Link>

              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-5">
                {event.branding?.logoImage && (
                  <div className="h-16 w-16 flex-shrink-0 rounded-2xl bg-white p-1.5 shadow-lg overflow-hidden">
                    <img
                      src={getAssetUrl(event.branding.logoImage)}
                      alt="logo"
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
                  {event.name}
                </h1>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  {event.eventType === 'other' && event.customEventType
                    ? event.customEventType
                    : event.eventType || 'Event'}
                </span>
                {isExpired ? (
                  <span className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-400">
                    Expired
                  </span>
                ) : (
                  <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400">
                    Tickets Available
                  </span>
                )}
              </div>

              {event.description && (
                <p className="mt-6 max-w-2xl text-base text-slate-300 leading-relaxed">
                  {event.description}
                </p>
              )}

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-blue-400 mb-1.5">
                    <CalendarDaysIcon className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Date</span>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {eventDate}{' '}
                    <span className="text-xs text-slate-300">({event.timezone || 'Asia/Colombo'})</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-blue-400 mb-1.5">
                    <ClockIcon className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Time</span>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {eventTime}{' '}
                    <span className="text-xs text-slate-400">
                      ({event.timezone || 'Asia/Colombo'})
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-blue-400 mb-1.5">
                    <MapPinIcon className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Venue</span>
                  </div>
                  <p className="text-sm font-medium text-white line-clamp-1">
                    {event.venue?.name || 'TBD'}
                  </p>
                  {(event.venue?.city || event.venue?.country) && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[event.venue?.city, event.venue?.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {event.venue?.mapUrl && (
                    <a
                      href={event.venue.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline mt-1 inline-block"
                    >
                      View on map
                    </a>
                  )}
                </div>
              </div>
            </div>

            {!isExpired && (
              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 sm:p-7 backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-400">
                  Official Tickets
                </p>
                <h2 className="mt-3 text-xl sm:text-2xl font-semibold text-white leading-snug">
                  Secure your access today
                </h2>
                <p className="mt-3 text-sm text-slate-400">
                  Select your preferred ticket category to view pricing and confirm your reservation.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTicketModalOpen(true)}
                  className="mt-6 w-full rounded-2xl bg-blue-600 hover:bg-blue-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-all active:scale-[0.98]"
                >
                  Choose Tickets
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="bg-slate-50 min-h-screen pt-10 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 xl:grid-cols-[1fr_340px]">
            <div className="space-y-10">
              {/* Cricket Match Details */}
              {event.eventType === 'cricket' && event.matchDetails && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
                  <h2 className="text-xl font-semibold text-slate-900 mb-5">Match Details</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {[
                      { label: 'Team A', value: event.matchDetails.teamA },
                      { label: 'Team B', value: event.matchDetails.teamB },
                      { label: 'Match Type', value: event.matchDetails.matchType },
                      { label: 'Series', value: event.matchDetails.series },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                          {item.label}
                        </p>
                        <p className="text-base font-semibold text-slate-900">
                          {item.value || 'TBD'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Concert Details */}
              {event.eventType === 'concert' && event.concertDetails && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
                  <h2 className="text-xl font-semibold text-slate-900 mb-5">Concert Info</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                    {[
                      { label: 'Main Artist', value: event.concertDetails.mainArtist },
                      { label: 'Genre', value: event.concertDetails.genre },
                      { label: 'Tour Name', value: event.concertDetails.tourName },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                          {item.label}
                        </p>
                        <p className="text-base font-semibold text-slate-900">
                          {item.value || 'TBD'}
                        </p>
                      </div>
                    ))}
                  </div>
                  {event.concertDetails.supportingBands?.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Supporting Acts
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {event.concertDetails.supportingBands.map((band, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-50 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-100"
                          >
                            {band}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Conference Details */}
              {event.eventType === 'conference' && event.conferenceDetails && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
                  <h2 className="text-xl font-semibold text-slate-900 mb-5">Conference Details</h2>
                  <div className="mb-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Theme
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      {event.conferenceDetails.theme || 'TBD'}
                    </p>
                  </div>
                  {event.conferenceDetails.speakers?.length > 0 && (
                    <div className="mb-5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Keynote Speakers
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {event.conferenceDetails.speakers.map((speaker, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-50 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-100"
                          >
                            {speaker}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {event.conferenceDetails.scheduleUrl && (
                    <a
                      href={event.conferenceDetails.scheduleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                    >
                      View Full Schedule <ChevronRightIcon className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}

              {/* Ticket Categories */}
              {!isExpired && (
                <>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                      Ticket Categories
                    </h2>
                    <div className="mt-2 h-1 w-12 rounded-full bg-blue-600" />
                    <p className="mt-3 text-sm text-slate-500 max-w-2xl">
                      Review packages below to see pricing and the zones they grant access to.
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    {categories.map((category) => {
                      const categoryId = getCategoryId(category);
                      const remaining = category.capacity - (category.sold || 0);
                      return (
                        <article
                          key={categoryId}
                          className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                            Category
                          </p>
                          <h3 className="text-xl font-semibold text-slate-900 mb-2">
                            {category.name}
                          </h3>
                          <p className="text-2xl font-bold text-blue-600 mb-5">
                            {formatCurrency(category.price)}
                          </p>

                          <div className="pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                                <CheckCircleIcon className="h-4 w-4 text-blue-600" />
                                Included Zones
                              </h4>
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                  remaining <= 0
                                    ? 'bg-red-50 text-red-600'
                                    : remaining < 50
                                    ? 'bg-amber-50 text-amber-600'
                                    : 'bg-emerald-50 text-emerald-600'
                                }`}
                              >
                                {remaining <= 0 ? 'Sold Out' : `${remaining} left`}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {category.allowedZones?.length > 0 ? (
                                category.allowedZones.map((zoneId) => {
                                  const matched = allZones.find((z) => getZoneId(z) === zoneId);
                                  return (
                                    <span
                                      key={zoneId}
                                      className="bg-slate-50 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-100"
                                    >
                                      {matched ? matched.name : zoneId}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-sm text-slate-400 italic">
                                  Standard Admission
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* Access Matrix */}
                  {allZones.length > 0 && categories.length > 0 && (
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                        Access Matrix
                      </h2>
                      <div className="mt-2 h-1 w-12 rounded-full bg-blue-600 mb-5" />

                      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-900">
                              <tr>
                                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                                  Stadium Zone
                                </th>
                                {categories.map((category) => (
                                  <th
                                    key={getCategoryId(category)}
                                    className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-300"
                                  >
                                    {category.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {allZones.map((zone) => (
                                <tr key={getZoneId(zone)} className="hover:bg-slate-50/80">
                                  <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-900">
                                    {zone.name}
                                  </td>
                                  {categories.map((category) => {
                                    const zoneId = getZoneId(zone);
                                    const categoryId = getCategoryId(category);
                                    const hasAccess = category.allowedZones?.includes(zoneId);
                                    return (
                                      <td
                                        key={`${zoneId}-${categoryId}`}
                                        className="px-5 py-4 text-center"
                                      >
                                        {hasAccess ? (
                                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                            <CheckCircleIcon className="h-4 w-4" />
                                          </span>
                                        ) : (
                                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xs">
                                            —
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Sponsor Packages */}
              {(event.sponsorPackages || []).filter((p) => p.isVisible).length > 0 && (
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Sponsor Packages
                  </h2>
                  <div className="mt-2 h-1 w-12 rounded-full bg-amber-500 mb-3" />
                  <p className="text-sm text-slate-500 max-w-2xl mb-6">
                    Join us as a partner. These packages offer exclusive benefits and high-impact
                    brand visibility.
                  </p>
                  <div className="grid gap-5 md:grid-cols-2">
                    {event.sponsorPackages
                      .filter((p) => p.isVisible)
                      .map((pkg) => (
                        <article
                          key={pkg.id}
                          className="rounded-[28px] border border-amber-100 bg-white p-6 shadow-sm"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 mb-1">
                            Sponsorship
                          </p>
                          <h3 className="text-xl font-semibold text-slate-900 mb-4">{pkg.name}</h3>

                          {pkg.benefits?.length > 0 && (
                            <ul className="space-y-2 mb-6">
                              {pkg.benefits.map((benefit, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                  <CheckCircleIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                  <span>{benefit}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className="pt-5 border-t border-slate-100">
                            <p className="text-xs font-medium text-slate-400 mb-3">
                              To purchase this package
                            </p>
                            <a
                              href={`tel:${pkg.contactNumber || event.organiser?.phone}`}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 px-5 py-3.5 text-sm font-semibold text-white transition-colors"
                            >
                              Contact Organizer
                            </a>
                            {pkg.contactNumber && (
                              <p className="mt-2 text-center text-sm font-medium text-slate-700">
                                {pkg.contactNumber}
                              </p>
                            )}
                          </div>
                        </article>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside>
              <div className="sticky top-24 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 mb-2">
                  Event Snapshot
                </p>
                <h2 className="text-lg font-semibold text-slate-900 leading-snug mb-5">
                  {event.name}
                </h2>
                <div className="space-y-4 text-sm text-slate-600 mb-6">
                  <div className="flex items-start gap-3">
                      <CalendarDaysIcon className="mt-0.5 h-5 w-5 text-blue-600 flex-shrink-0" />
                      <span>
                        {eventDate} <span className="text-xs text-slate-400">({event.timezone || 'Asia/Colombo'})</span>
                      </span>
                    </div>
                  <div className="flex items-start gap-3">
                    <ClockIcon className="mt-0.5 h-5 w-5 text-blue-600 flex-shrink-0" />
                    <span>
                      {eventTime}{' '}
                      <span className="text-xs text-slate-400">
                        ({event.timezone || 'Asia/Colombo'})
                      </span>
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPinIcon className="mt-0.5 h-5 w-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <span className="block">{event.venue?.name || 'TBD'}</span>
                      {event.venue?.mapUrl && (
                        <a
                          href={event.venue.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline mt-1"
                        >
                          View on Map <ChevronRightIcon className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                {!isExpired && (
                  <button
                    type="button"
                    onClick={() => setIsTicketModalOpen(true)}
                    className="w-full rounded-2xl bg-slate-900 hover:bg-slate-800 py-3.5 text-sm font-semibold text-white transition-colors"
                  >
                    Buy Tickets
                  </button>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Ticket Selection Modal */}
      {isTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 sm:items-center sm:p-6 backdrop-blur-sm">
          <div className="max-h-[95vh] w-full overflow-hidden rounded-t-[28px] bg-slate-50 shadow-2xl sm:max-w-5xl sm:rounded-[28px] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-6 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 mb-0.5">
                  Ticket Selection
                </p>
                <h2 className="text-lg font-semibold text-slate-900">{event.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsTicketModalOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
                {categories.map((category) => {
                  const categoryId = getCategoryId(category);
                  const remaining = Math.max(0, category.capacity - (category.sold || 0));
                  const maxSelectable = Math.min(10, remaining);
                  const selected = selectedTickets[categoryId] || 0;
                  const isLocked = category.isPrivate && !unlockedCategories.includes(categoryId);

                  return (
                    <div
                      key={categoryId}
                      className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all ${
                        isLocked
                          ? 'border-slate-200 bg-slate-50/70'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={`text-base font-semibold ${
                              isLocked ? 'text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {category.name}
                          </h3>
                          {category.isPrivate && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                isLocked
                                  ? 'bg-slate-200 text-slate-500'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {isLocked ? (
                                <LockClosedIcon className="h-3 w-3" />
                              ) : (
                                <LockOpenIcon className="h-3 w-3" />
                              )}
                              {isLocked ? 'Private' : 'Unlocked'}
                            </span>
                          )}
                        </div>
                        <p
                          className={`mt-1 text-xl font-bold ${
                            isLocked ? 'text-slate-300' : 'text-blue-600'
                          }`}
                        >
                          {formatCurrency(category.price)}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-slate-400">
                          Availability: {remaining} / {category.capacity}
                        </p>
                      </div>

                      <div>
                        {isLocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCategoryId(categoryId);
                              setIsCodeModalOpen(true);
                            }}
                            className="w-full sm:w-auto rounded-2xl bg-slate-900 hover:bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
                          >
                            Enter Code
                          </button>
                        ) : remaining <= 0 ? (
                          <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-2.5 text-center">
                            <span className="text-sm font-semibold text-red-600">Sold Out</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(categoryId, selected - 1)}
                              disabled={selected === 0}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-lg font-semibold text-slate-800 hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              −
                            </button>
                            <div className="w-8 text-center text-lg font-semibold text-slate-900">
                              {selected}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(
                                  categoryId,
                                  Math.min(selected + 1, maxSelectable)
                                )
                              }
                              disabled={selected >= maxSelectable}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-lg font-semibold text-slate-800 hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order Summary */}
              <div className="border-t border-slate-200 bg-white p-5 sm:p-6 lg:w-80 lg:border-l lg:border-t-0 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 mb-4">Order Summary</h3>
                  {selectedCategories.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                      <p className="text-sm text-slate-500">
                        No tickets selected yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCategories.map((category) => (
                        <div
                          key={getCategoryId(category)}
                          className="flex items-start justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {category.name}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {selectedTickets[getCategoryId(category)]} ×{' '}
                              {formatCurrency(category.price)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              selectedTickets[getCategoryId(category)] * category.price
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 hidden lg:block">
                  <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
                    <span>Total Tickets</span>
                    <span className="font-semibold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md">
                      {totalTickets}
                    </span>
                  </div>
                  <div className="flex items-end justify-between mb-5">
                    <span className="text-base font-semibold text-slate-900">Total</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {formatCurrency(totalPrice)}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={totalTickets === 0}
                    onClick={() => {
                      setIsTicketModalOpen(false);
                      navigate('/checkout', {
                        state: { selectedTickets, eventId: event._id, event },
                      });
                    }}
                    className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Proceed to Checkout
                  </button>
                  <p className="mt-3 text-center text-xs text-slate-400">
                    Secure checkout powered by ENTRYNEX
                  </p>
                </div>

                {/* Mobile sticky bar */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] z-20">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Total
                      </p>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(totalPrice)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Tickets
                      </p>
                      <p className="text-base font-bold text-slate-900">{totalTickets}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={totalTickets === 0}
                    onClick={() => {
                      setIsTicketModalOpen(false);
                      navigate('/checkout', {
                        state: { selectedTickets, eventId: event._id, event },
                      });
                    }}
                    className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 py-3.5 text-sm font-semibold text-white disabled:opacity-50 transition-all"
                  >
                    Checkout Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Access Code Modal */}
      {isCodeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 mb-0.5">
                  Security Check
                </p>
                <h3 className="text-lg font-semibold text-slate-900">Unlock Private Access</h3>
              </div>
              <button
                onClick={() => {
                  setIsCodeModalOpen(false);
                  setAccessCode('');
                  setCodeError('');
                }}
                className="rounded-full bg-white p-2 text-slate-400 hover:text-slate-700 shadow-sm border border-slate-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleValidateCode} className="p-6">
              <p className="text-sm text-slate-500 mb-5">
                This ticket category is restricted. Enter the official access code provided by the
                organizer.
              </p>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="accessCode"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    Access Code
                  </label>
                  <input
                    type="text"
                    id="accessCode"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="E.G. VIP-12345"
                    autoFocus
                    className={`w-full rounded-2xl border-2 px-4 py-3.5 text-center text-base font-semibold tracking-widest uppercase outline-none transition-all ${
                      codeError
                        ? 'border-red-200 bg-red-50 text-red-900 focus:border-red-400'
                        : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10'
                    }`}
                  />
                  {codeError && (
                    <p className="mt-2 text-center text-xs font-medium text-red-600">
                      {codeError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!accessCode.trim() || isValidating}
                  className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isValidating ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Validating...
                    </span>
                  ) : (
                    'Unlock Ticket'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PublicLayout>
  );
};

export default EventDetailPage;