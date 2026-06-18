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
    
    // Join a room for this specific event
    socket.emit('join_event', { eventId: id });

    socket.on('event_update', (data) => {
      console.log('Real-time update received:', data);
      fetchEvent();
    });

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
        // Optional: show success toast or notification
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
           <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      </PublicLayout>
    );
  }

  if (!event) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">
            Event unavailable
          </p>
          <h1 className="mt-4 text-5xl font-black text-slate-900 uppercase tracking-tight">We could not find that event</h1>
          <p className="mt-4 text-lg text-slate-500 font-medium max-w-2xl mx-auto">
            The event may have been removed, sold out, or the URL might be incorrect.
          </p>
          <div className="mt-10">
            <Link
              to="/events"
              className="inline-flex rounded-xl bg-slate-900 px-8 py-4 text-base font-bold text-white transition-transform hover:scale-105 active:scale-95 shadow-xl shadow-slate-900/20"
            >
              Back to official fixtures
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const allZones = event.zones || [];
  const categories = (event.categories || []).filter(c => c.isVisible !== false);
  const totalTickets = Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0);
  const totalPrice = categories.reduce((sum, category) => {
    return sum + category.price * (selectedTickets[getCategoryId(category)] || 0);
  }, 0);
  
  const selectedCategories = categories.filter((category) => selectedTickets[getCategoryId(category)] > 0);
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
      if (event.timezone) {
        options.timeZone = event.timezone;
      }
      eventDate = new Date(event.startDate).toLocaleDateString('en-US', options);
    }
  } catch (err) {
    console.error('Timezone date rendering error:', err);
    eventDate = event.startDate ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD';
  }

  let eventTime = 'TBD';
  try {
    if (event.startDate) {
      const options = { hour: '2-digit', minute: '2-digit' };
      if (event.timezone) {
        options.timeZone = event.timezone;
      }
      eventTime = new Date(event.startDate).toLocaleTimeString('en-US', options);
    }
  } catch (err) {
    console.error('Timezone time rendering error:', err);
    eventTime = event.startDate ? new Date(event.startDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'TBD';
  }

  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {heroImage && (
          <img
            src={getAssetUrl(heroImage)}
            alt={event.name}
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-blue-950/40 mix-blend-multiply" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <div>
              <Link
                to="/events"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold text-sky-400 transition hover:bg-white/10 hover:border-sky-400/50 backdrop-blur"
              >
                <ArrowLeftIcon className="h-4 w-4" /> Back to listings
              </Link>
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 mt-8">
                {event.branding?.logoImage && (
                  <div className="h-20 w-20 flex-shrink-0 rounded-2xl bg-white p-2 shadow-2xl ring-4 ring-white/10 overflow-hidden">
                    <img src={getAssetUrl(event.branding.logoImage)} alt="logo" className="h-full w-full object-contain" />
                  </div>
                )}
                <h1 className="max-w-4xl text-2xl font-black uppercase tracking-tight sm:text-4xl lg:text-6xl text-white leading-[1.1]">
                  {event.name}
                </h1>
              </div>
               <div className="mt-6 flex items-center gap-4">
                  <span className="rounded-md px-3 py-1 text-xs font-black uppercase tracking-widest text-white" style={{ backgroundColor: themeColor }}>
                    {event.eventType === 'other' && event.customEventType ? event.customEventType : (event.eventType || 'Cricket Match')}
                  </span>
                  {isExpired ? (
                    <span className="rounded-md bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest border border-red-500/50 text-red-500">
                      Match Expired
                    </span>
                  ) : (
                    <span className="rounded-md bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest border" style={{ color: themeColor, borderColor: `${themeColor}4D` }}>
                      Tickets Available
                    </span>
                  )}
              </div>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300">
                {event.description}
              </p>

              <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
                 <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-xl">
                  <div className="flex items-center gap-3 mb-2" style={{ color: themeColor }}>
                    <CalendarDaysIcon className="h-6 w-6" />
                    <span className="text-sm font-bold uppercase tracking-wider">Date</span>
                  </div>
                  <p className="font-medium text-white">{eventDate}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-xl">
                  <div className="flex items-center gap-3 text-blue-400 mb-2">
                    <ClockIcon className="h-6 w-6" />
                    <span className="text-sm font-bold uppercase tracking-wider">Time</span>
                  </div>
                  <p className="font-medium text-white">{eventTime} <span className="text-xs text-sky-400 font-bold">({event.timezone || 'Asia/Colombo'})</span></p>
                </div>

                 <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-xl">
                  <div className="flex items-center gap-3 mb-2" style={{ color: themeColor }}>
                    <MapPinIcon className="h-6 w-6" />
                    <span className="text-sm font-bold uppercase tracking-wider">Venue</span>
                  </div>
                  <p className="font-medium text-white line-clamp-2">{event.venue?.name || 'TBD'}</p>
                </div>
              </div>
            </div>

             <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
              <p className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: isExpired ? '#EF4444' : themeColor }}>
                {isExpired ? 'Match Concluded' : 'Official Tickets'}
              </p>
              <h2 className="mt-4 text-2xl sm:text-3xl font-black text-white leading-tight">
                {isExpired ? 'This event has ended.' : 'Secure your access today.'}
              </h2>
              <p className="mt-4 text-base text-slate-300 font-medium">
                {isExpired 
                  ? 'Ticket booking is no longer available for this match. Please check our upcoming fixtures.'
                  : 'Select your preferred ticket category to view pricing and confirm your reservation.'
                }
              </p>
               <button
                type="button"
                onClick={() => !isExpired && setIsTicketModalOpen(true)}
                disabled={isExpired}
                className={`mt-8 inline-flex w-full items-center justify-center rounded-xl px-6 py-4 text-lg font-black text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98] brightness-110 ${isExpired ? 'bg-slate-700 cursor-not-allowed opacity-50 shadow-none' : 'shadow-blue-900/50'}`}
                style={!isExpired ? { backgroundColor: themeColor } : {}}
              >
                {isExpired ? 'Booking Closed' : 'Choose Tickets'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 min-h-screen pt-12 pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-12">
              {/* Event Specific Details */}
              {(event.eventType === 'cricket' && event.matchDetails) && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm overflow-hidden">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-6">Match Details</h2>
                  <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Team A</p>
                      <p className="text-lg font-bold text-slate-900">{event.matchDetails.teamA || 'TBD'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Team B</p>
                      <p className="text-lg font-bold text-slate-900">{event.matchDetails.teamB || 'TBD'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Match Type</p>
                      <p className="text-lg font-bold text-slate-900">{event.matchDetails.matchType || 'TBD'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Series</p>
                      <p className="text-lg font-bold text-slate-900">{event.matchDetails.series || 'TBD'}</p>
                    </div>
                  </div>
                </div>
              )}

              {(event.eventType === 'concert' && event.concertDetails) && (
                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-6">Concert Info</h2>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Main Artist</p>
                        <p className="text-lg font-bold text-slate-900">{event.concertDetails.mainArtist || 'TBD'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Genre</p>
                        <p className="text-lg font-bold text-slate-900">{event.concertDetails.genre || 'TBD'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tour Name</p>
                        <p className="text-lg font-bold text-slate-900">{event.concertDetails.tourName || 'TBD'}</p>
                      </div>
                    </div>
                    {event.concertDetails.supportingBands?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Supporting Acts</p>
                        <div className="flex flex-wrap gap-2">
                          {event.concertDetails.supportingBands.map((band, idx) => (
                            <span key={idx} className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200">
                              {band}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(event.eventType === 'conference' && event.conferenceDetails) && (
                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-6">Conference Details</h2>
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Theme</p>
                      <p className="text-lg font-bold text-slate-900">{event.conferenceDetails.theme || 'TBD'}</p>
                    </div>
                    {event.conferenceDetails.speakers?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Keynote Speakers</p>
                        <div className="flex flex-wrap gap-2">
                          {event.conferenceDetails.speakers.map((speaker, idx) => (
                            <span key={idx} className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200">
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
                        className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:underline"
                      >
                        View Full Schedule <ChevronRightIcon className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Ticket Categories Segment */}
               <div className="pt-12">
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900">Ticket Categories</h2>
                <div className="mt-2 h-1 w-12 sm:w-16 rounded-full" style={{ backgroundColor: themeColor }}></div>
                <p className="mt-4 text-base font-medium text-slate-500 max-w-3xl">
                  Review the packages below to see pricing and the specific stadium zones they grant access to.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 mt-8">
                {categories.map((category) => {
                  const categoryId = getCategoryId(category);
                  return (
                     <article
                      key={categoryId}
                      className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-blue-900/10 relative overflow-hidden"
                      style={{ '--hover-border': themeColor }}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full -z-0 opacity-50 group-hover:scale-110 transition-transform" style={{ backgroundColor: `${themeColor}1A` }}></div>
                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <p className="text-sm font-black uppercase tracking-widest text-slate-400">
                            Category
                          </p>
                        </div>
                         <h3 className="text-3xl font-black text-slate-900 mb-4">{category.name}</h3>
                        <p className="text-4xl font-black mb-8" style={{ color: themeColor }}>
                          {formatCurrency(category.price)}
                        </p>
                        
                        <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900 flex items-center gap-2">
                               <CheckCircleIcon className="h-5 w-5" style={{ color: themeColor }} /> Included Zones
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                                (category.capacity - category.sold) <= 0 
                                  ? 'bg-red-100 text-red-600' 
                                  : (category.capacity - category.sold) < 50 
                                    ? 'bg-amber-100 text-amber-600' 
                                    : 'bg-emerald-100 text-emerald-600'
                              }`}>
                                {(category.capacity - category.sold) <= 0 
                                  ? 'Sold Out' 
                                  : `${category.capacity - category.sold} Seats Left`}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {category.allowedZones && category.allowedZones.length > 0 ? (
                              category.allowedZones.map(zoneId => {
                                const matchedZone = allZones.find((zone) => getZoneId(zone) === zoneId);
                                return (
                                  <span key={zoneId} className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200">
                                    {matchedZone ? matchedZone.name : zoneId}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-sm text-slate-500 italic">Standard Admission</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Matrix Table */}
              {allZones.length > 0 && categories.length > 0 && (
                <div className="pt-8">
                   <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900">Access Matrix</h2>
                  <div className="mt-2 h-1 w-16 rounded-full mb-6" style={{ backgroundColor: themeColor }}></div>
                  
                  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-900">
                          <tr>
                            <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-widest text-slate-300">
                              Stadium Zone
                            </th>
                            {categories.map((category) => (
                              <th
                                key={getCategoryId(category)}
                                className="px-6 py-5 text-center text-xs font-bold uppercase tracking-widest text-slate-300"
                              >
                                {category.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allZones.map((zone) => (
                            <tr key={getZoneId(zone)} className="hover:bg-slate-50 transition-colors">
                              <td className="whitespace-nowrap px-6 py-5 font-bold text-slate-900">
                                {zone.name}
                              </td>
                              {categories.map((category) => {
                                const zoneId = getZoneId(zone);
                                const categoryId = getCategoryId(category);
                                const hasAccess = category.allowedZones?.includes(zoneId);
                                return (
                                  <td key={`${zoneId}-${categoryId}`} className="px-6 py-4 text-center">
                                    {hasAccess ? (
                                       <span className="inline-flex items-center justify-center h-8 w-8 rounded-full ring-4" style={{ backgroundColor: `${themeColor}1A`, color: themeColor, ringColor: `${themeColor}1A` }}>
                                        <CheckCircleIcon className="h-4 w-4" />
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-400">
                                        -
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

              {/* Sponsor Packages Segment */}
              {(event.sponsorPackages || []).filter(p => p.isVisible).length > 0 && (
                <div className="pt-12">
                  <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900">Sponsor Packages</h2>
                  <div className="mt-2 h-1 w-12 sm:w-16 rounded-full bg-amber-500"></div>
                  <p className="mt-4 text-base font-medium text-slate-500 max-w-3xl">
                    Join us as a partner. These premium packages offer exclusive benefits and high-impact brand visibility.
                  </p>
                  <div className="mt-8 grid gap-6 md:grid-cols-2">
                    {event.sponsorPackages.filter(p => p.isVisible).map((pkg) => (
                      <article
                        key={pkg.id}
                        className="flex flex-col rounded-3xl border border-amber-100 bg-white p-6 sm:p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-amber-900/10 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full bg-amber-50 opacity-50"></div>
                        <div className="relative z-10 flex flex-col h-full">
                          <p className="text-sm font-black uppercase tracking-widest text-amber-600 mb-2">Sponsorship</p>
                          <h3 className="text-2xl font-black text-slate-900 mb-4">{pkg.name}</h3>
                          
                          <div className="flex-1">
                            {pkg.benefits && pkg.benefits.length > 0 && (
                              <ul className="space-y-2 mb-6">
                                {pkg.benefits.map((benefit, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                    <CheckCircleIcon className="h-5 w-5 text-amber-500 shrink-0" />
                                    <span>{benefit}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="mt-6 pt-6 border-t border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">To purchase this package</p>
                            <a 
                              href={`tel:${pkg.contactNumber || event.organiser?.phone}`}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-4 text-sm font-black text-white hover:bg-amber-600 transition-colors shadow-lg shadow-amber-900/20"
                            >
                              Contact Organizer
                            </a>
                            {pkg.contactNumber && (
                              <p className="mt-3 text-center text-sm font-bold text-slate-900">{pkg.contactNumber}</p>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Summary */}
            <aside className="xl:pt-0 w-full max-w-full overflow-hidden">
              <div className="sticky top-24 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl shadow-slate-200/50">
                 <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: themeColor }}>
                  Event Snapshot
                </p>
                <h2 className="text-2xl font-black text-slate-900 uppercase leading-tight mb-6">{event.name}</h2>
                <div className="space-y-5 text-sm font-medium text-slate-600 mb-10">
                  <div className="flex items-start gap-4">
                    <CalendarDaysIcon className="mt-0.5 h-6 w-6 text-blue-600" />
                    <span>{eventDate}</span>
                  </div>
                  <div className="flex items-start gap-4">
                    <ClockIcon className="mt-0.5 h-6 w-6 text-blue-600" />
                    <span>{eventTime} <span className="text-xs text-blue-600 font-bold">({event.timezone || 'Asia/Colombo'})</span></span>
                  </div>
                   <div className="flex items-start gap-4">
                    <MapPinIcon className="mt-0.5 h-6 w-6" style={{ color: themeColor }} />
                    <div className="space-y-1">
                      <span className="leading-relaxed block">{event.venue?.name || 'TBD'}</span>
                      {event.venue?.mapUrl && (
                        <a 
                          href={event.venue.mapUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider hover:underline"
                          style={{ color: themeColor }}
                        >
                          View on Map <ChevronRightIcon className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTicketModalOpen(true)}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-6 py-4 text-lg font-black text-white hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                >
                  Buy Tickets
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Ticket Selection Modal */}
      {isTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 sm:items-center sm:p-6 backdrop-blur-sm">
          <div className="max-h-[95vh] w-full overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl ring-1 ring-slate-900/5 sm:max-w-5xl sm:rounded-3xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-sky-500 mb-1">
                  Ticket Selection
                </p>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{event.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsTicketModalOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
                aria-label="Close ticket selector"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {categories.map((category) => {
                  const categoryId = getCategoryId(category);
                  const capacity = category.defaultCapacity || 0;
                  const maxSelectable = Math.min(10, capacity > 0 ? capacity : 10);
                  const selected = selectedTickets[categoryId] || 0;
                  const isLocked = category.isPrivate && !unlockedCategories.includes(categoryId);

                  return (
                    <div
                      key={categoryId}
                      className={`rounded-2xl border p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 transition-all ${
                        isLocked ? 'border-slate-200 bg-slate-50/50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-lg sm:text-xl font-black ${isLocked ? 'text-slate-400' : 'text-slate-900'}`}>{category.name}</h3>
                          {category.isPrivate && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isLocked ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {isLocked ? <LockClosedIcon className="h-3 w-3" /> : <LockOpenIcon className="h-3 w-3" />}
                              {isLocked ? 'Private' : 'Unlocked'}
                            </span>
                          )}
                        </div>
                        <p className={`mt-1 sm:mt-2 text-xl sm:text-2xl font-black ${isLocked ? 'text-slate-300' : 'text-blue-700'}`}>
                          {formatCurrency(category.price)}
                        </p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Availability: {Math.max(0, category.capacity - (category.sold || 0))} / {category.capacity}
                        </p>
                      </div>

                      <div className="flex sm:block">
                        {isLocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCategoryId(categoryId);
                              setIsCodeModalOpen(true);
                            }}
                            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-black text-white hover:bg-slate-800 transition-all"
                          >
                            Enter Code
                          </button>
                        ) : (category.capacity - (category.sold || 0)) <= 0 ? (
                          <div className="w-full sm:w-auto text-center rounded-xl bg-red-50 px-6 py-3 border border-red-100">
                            <span className="text-sm font-black uppercase tracking-widest text-red-600">Sold Out</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between sm:justify-end gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-100/50 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(categoryId, selected - 1)}
                              disabled={selected === 0}
                              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-slate-200 text-xl font-bold text-slate-900 shadow-sm transition-all hover:border-blue-500 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              -
                            </button>
                            <div className="w-10 text-center text-xl font-black text-slate-900">
                              {selected}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(categoryId, Math.min(selected + 1, Math.min(maxSelectable, category.capacity - (category.sold || 0))))
                              }
                              disabled={selected >= maxSelectable || selected >= (category.capacity - (category.sold || 0))}
                              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-slate-200 text-xl font-bold text-slate-900 shadow-sm transition-all hover:border-blue-500 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
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

              <div className="border-t border-slate-200 bg-white p-6 lg:w-96 lg:border-l lg:border-t-0 flex flex-col justify-between shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-10 pb-24 lg:pb-6">
                <div>
                  <h3 className="text-lg font-black uppercase text-slate-900 mb-6">Order Summary</h3>
                  {selectedCategories.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                      <p className="text-sm font-medium text-slate-500">
                        No tickets selected yet. Add tickets to preview your order.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedCategories.map((category) => (
                        <div
                          key={getCategoryId(category)}
                          className="flex items-start justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                        >
                          <div>
                            <p className="font-bold text-slate-900 text-sm sm:text-base">{category.name}</p>
                            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
                              {selectedTickets[getCategoryId(category)]} × {formatCurrency(category.price)}
                            </p>
                          </div>
                          <p className="font-black text-slate-900 text-sm sm:text-base">
                            {formatCurrency(selectedTickets[getCategoryId(category)] * category.price)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200 hidden lg:block">
                  <div className="flex items-center justify-between text-sm font-bold text-slate-500 mb-3">
                    <span>Total Tickets</span>
                    <span className="bg-slate-100 text-slate-900 px-3 py-1 rounded-md">{totalTickets}</span>
                  </div>
                   <div className="flex items-end justify-between mb-8">
                    <span className="text-lg font-black uppercase text-slate-900">Total</span>
                    <span className="text-3xl font-black" style={{ color: themeColor }}>
                      {formatCurrency(totalPrice)}
                    </span>
                  </div>

                   <button
                    type="button"
                    disabled={totalTickets === 0}
                    onClick={() => {
                      setIsTicketModalOpen(false);
                      // In the real system, you might map this payload up to Checkout API expectations.
                      // For now, pass what we have. Note: _id instead of id.
                      navigate('/checkout', { state: { selectedTickets, eventId: event._id, event } });
                    }}
                    className="flex w-full items-center justify-center rounded-xl px-6 py-4 text-lg font-black text-white shadow-lg shadow-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ backgroundColor: themeColor }}
                  >
                    Proceed to Checkout
                  </button>
                  <p className="mt-4 text-center text-xs font-medium text-slate-400">
                    Secure checkout powered by ENTRYNEX.
                  </p>
                </div>

                {/* Mobile Sticky Bar */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-6 xs:pb-7 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-20">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Price</p>
                      <p className="text-xl font-black text-slate-900">{formatCurrency(totalPrice)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tickets</p>
                      <p className="text-lg font-black text-slate-900">{totalTickets}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={totalTickets === 0}
                    onClick={() => {
                      setIsTicketModalOpen(false);
                      navigate('/checkout', { state: { selectedTickets, eventId: event._id, event } });
                    }}
                    className="w-full flex items-center justify-center rounded-xl px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-50 transition-all"
                    style={{ backgroundColor: themeColor }}
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
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5 transition-all">
            <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">
                  Security Check
                </p>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Unlock Private Access</h3>
              </div>
              <button
                onClick={() => {
                  setIsCodeModalOpen(false);
                  setAccessCode('');
                  setCodeError('');
                }}
                className="rounded-full bg-white p-2 text-slate-400 hover:text-slate-900 shadow-sm"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleValidateCode} className="p-8">
              <p className="text-sm font-medium text-slate-500 mb-6">
                This ticket category is restricted. Please enter the official access code provided by the organizer.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="accessCode" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                    Access Code
                  </label>
                  <input
                    type="text"
                    id="accessCode"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="E.G. VIP-12345"
                    autoFocus
                    className={`w-full rounded-2xl border-2 px-5 py-4 text-center text-lg font-black tracking-widest uppercase transition-all outline-none ${
                        codeError 
                          ? 'border-red-200 bg-red-50 text-red-900 focus:border-red-500' 
                          : 'border-slate-100 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white'
                    }`}
                  />
                  {codeError && (
                    <p className="mt-3 text-center text-xs font-bold text-red-600 uppercase tracking-wide">
                      {codeError}
                    </p>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={!accessCode.trim() || isValidating}
                  className="flex w-full items-center justify-center rounded-2xl bg-blue-600 py-4 text-base font-black uppercase tracking-widest text-white shadow-xl shadow-blue-900/20 transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isValidating ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Validating...
                    </div>
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
