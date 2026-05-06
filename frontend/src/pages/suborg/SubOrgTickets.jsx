import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getSubDashboard, createSubTicket, regenerateTicketCode } from '../../api/sub';
import { PlusIcon, KeyIcon, LockClosedIcon, LockOpenIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const SubOrgTickets = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentEventId, setCurrentEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  
  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    capacity: '',
    allowedZones: [],
    isPrivate: false,
    isVisible: true,
    maxUsage: '',
    description: ''
  });

  // Result State
  const [showResult, setShowResult] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  const load = (eventId) => {
    setLoading(true);
    getSubDashboard({ eventId })
      .then((response) => {
        setData(response.data?.data || null);
      })
      .catch((error) => {
        toast.error(error.response?.data?.message || 'Failed to load data.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(currentEventId);
    const handleEventSelect = (e) => {
      setCurrentEventId(e.detail);
      load(e.detail);
    };
    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!currentEventId) return toast.error('Please select an event first.');
    if (formData.allowedZones.length === 0) return toast.error('Please select at least one zone.');

    setIsSubmitting(true);
    try {
      const response = await createSubTicket({
        ...formData,
        eventId: currentEventId
      });

      if (response.data.success) {
        toast.success('Ticket category created!');
        if (response.data.data.category.accessCode) {
          setGeneratedCode(response.data.data.category.accessCode);
          setShowResult(true);
        }
        setIsModalOpen(false);
        setFormData({
          name: '', price: '', capacity: '', allowedZones: [], isPrivate: false, isVisible: true, maxUsage: '', description: ''
        });
        load(currentEventId);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleZone = (zoneId) => {
    setFormData(prev => ({
      ...prev,
      allowedZones: prev.allowedZones.includes(zoneId)
        ? prev.allowedZones.filter(id => id !== zoneId)
        : [...prev.allowedZones, zoneId]
    }));
  };

  const handleRegenerateCode = async (categoryId) => {
    if (!currentEventId) return toast.error('Please select an event first.');

    try {
      const response = await regenerateTicketCode(categoryId, { eventId: currentEventId });
      const nextCode = response.data?.data?.accessCode;
      if (!nextCode) {
        toast.error('A new access code was not returned.');
        return;
      }

      setGeneratedCode(nextCode);
      setShowResult(true);
      toast.success('Access code regenerated.');
      load(currentEventId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to regenerate code.');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-[28px] bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-300">Ticket Management</p>
              <h1 className="mt-2 text-3xl font-black uppercase">Private & Public Access</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Create and manage restricted ticket categories. Private tickets require a secure access code to unlock.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-indigo-500 active:scale-95"
            >
              <PlusIcon className="h-5 w-5" />
              Create Ticket
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(data?.categories || []).map((category) => (
            <div key={category.id} className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{category.name}</h3>
                  <p className="text-2xl font-black text-indigo-600">LKR {category.price}</p>
                </div>
                {category.isPrivate ? (
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shadow-sm border border-amber-100">
                    <LockClosedIcon className="h-5 w-5" />
                  </span>
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100">
                    <LockOpenIcon className="h-5 w-5" />
                  </span>
                )}
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                  <span>Capacity</span>
                  <span className="text-slate-900">{category.sold || 0} / {category.capacity}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${category.isPrivate ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${(category.sold / category.capacity) * 100}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Assigned Zones</p>
                <div className="flex flex-wrap gap-1.5">
                  {category.allowedZones?.map(zId => (
                    <span key={zId} className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 border border-slate-100">
                      {data?.zones?.find(z => String(z._id || z.id) === String(zId))?.name || zId}
                    </span>
                  ))}
                </div>
              </div>

              {category.isPrivate && (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Access Code</p>
                      <p className="mt-2 font-mono text-xl font-black tracking-widest text-slate-900">
                        {category.accessCode || 'Not available'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRegenerateCode(category.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-amber-700 transition hover:bg-amber-100"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      Regenerate
                    </button>
                  </div>
                  <p className="mt-3 text-xs font-medium text-amber-800">
                    Share this code only with the people who should unlock this private ticket.
                  </p>
                </div>
              )}
            </div>
          ))}
          {!loading && (data?.categories || []).length === 0 && (
            <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
              <PlusIcon className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4 text-sm font-bold text-slate-500">No ticket categories created yet.</p>
              <button onClick={() => setIsModalOpen(true)} className="mt-4 text-sm font-black text-indigo-600 underline">Create your first category</button>
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[32px] bg-white shadow-2xl transition-all">
            <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-6">
              <h2 className="text-xl font-black uppercase text-slate-900">New Ticket Category</h2>
            </div>
            <form onSubmit={handleCreate} className="p-8">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Category Name</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-2xl border border-slate-200 px-5 py-3 font-semibold focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. VIP Backstage"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Price (LKR)</label>
                  <input
                    type="number"
                    required
                    className="w-full rounded-2xl border border-slate-200 px-5 py-3 font-semibold focus:border-indigo-500 focus:outline-none"
                    placeholder="5000"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Capacity</label>
                  <input
                    type="number"
                    required
                    className="w-full rounded-2xl border border-slate-200 px-5 py-3 font-semibold focus:border-indigo-500 focus:outline-none"
                    placeholder="100"
                    value={formData.capacity}
                    onChange={e => setFormData({...formData, capacity: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Assign to Zones</label>
                  <div className="flex flex-wrap gap-2">
                    {(data?.zones || []).map(zone => (
                      <button
                        key={zone._id || zone.id}
                        type="button"
                        onClick={() => toggleZone(zone._id || zone.id)}
                        className={`rounded-xl px-4 py-2 text-xs font-bold border transition-all ${
                          formData.allowedZones.includes(zone._id || zone.id)
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                        }`}
                      >
                        {zone.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="md:col-span-2 rounded-2xl bg-slate-50 p-6 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black uppercase text-slate-900">Private Access</h4>
                      <p className="text-xs text-slate-500 mt-1">Require a secure code to unlock this ticket.</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input 
                        type="checkbox" 
                        className="peer sr-only" 
                        checked={formData.isPrivate}
                        onChange={e => setFormData({...formData, isPrivate: e.target.checked})}
                      />
                      <div className="peer h-7 w-12 rounded-full bg-slate-200 after:absolute after:start-[4px] after:top-[4px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-500 peer-checked:after:translate-x-full" />
                    </label>
                  </div>
                  {formData.isPrivate && (
                    <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Max Uses (Optional)</label>
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold focus:border-amber-500 focus:outline-none"
                        placeholder="Leave blank for unlimited"
                        value={formData.maxUsage}
                        onChange={e => setFormData({...formData, maxUsage: e.target.value})}
                      />
                    </div>
                  )}
                </div>

                <div className="md:col-span-2 rounded-2xl bg-slate-50 p-6 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black uppercase text-slate-900">Visible to Public</h4>
                      <p className="text-xs text-slate-500 mt-1">Show this ticket in the public event listing.</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input 
                        type="checkbox" 
                        className="peer sr-only" 
                        checked={formData.isVisible}
                        onChange={e => setFormData({...formData, isVisible: e.target.checked})}
                      />
                      <div className="peer h-7 w-12 rounded-full bg-slate-200 after:absolute after:start-[4px] after:top-[4px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-2xl bg-slate-100 py-4 text-sm font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] rounded-2xl bg-indigo-600 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Access Code Result Modal */}
      {showResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-xl">
          <div className="w-full max-w-md overflow-hidden rounded-[40px] bg-white p-10 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-500 mb-6">
              <KeyIcon className="h-10 w-10" />
            </div>
            <h2 className="text-3xl font-black uppercase text-slate-900 mb-2">Access Code Created</h2>
            <p className="text-sm font-medium text-slate-500 mb-8 px-4">
              <span className="text-rose-600 font-bold uppercase">Important:</span> This code is now also visible in the Tickets tab for authorised sub-organisers.
            </p>
            
            <div className="rounded-3xl bg-slate-50 p-8 border-2 border-dashed border-amber-200 relative group cursor-pointer active:scale-95 transition-all"
                 onClick={() => {
                   navigator.clipboard.writeText(generatedCode);
                   toast.success('Code copied to clipboard!');
                 }}>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3 group-hover:text-amber-600 transition-colors">Click to Copy Code</p>
              <p className="text-4xl font-black tracking-widest text-slate-900 uppercase font-mono">{generatedCode}</p>
            </div>
            
            <button
              onClick={() => setShowResult(false)}
              className="mt-10 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-slate-900/20 hover:brightness-110"
            >
              <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
              I have saved the code
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default SubOrgTickets;
