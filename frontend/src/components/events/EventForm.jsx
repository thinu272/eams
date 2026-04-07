import React, { useState } from 'react';
import { format } from 'date-fns';
import Button from '../ui/Button';
import Card from '../ui/Card';

const tabs = ['Basic Info', 'Categories', 'Zones', 'Match Details', 'Settings'];

const EventForm = ({ initialData = {}, onSubmit, onCancel, loading, organisers = [] }) => {
  const [activeTab, setActiveTab] = useState('Basic Info');
  const [form, setForm] = useState({
    name: '',
    description: '',
    eventType: 'cricket',
    venue: { name: '', city: '', country: 'Sri Lanka' },
    startDate: '',
    endDate: '',
    mainOrganiser: '',
    categories: [],
    zones: [],
    matchDetails: { teamA: '', teamB: '', matchType: '', series: '' },
    settings: {
      requirePhotoVerification: true,
      allowSelfConfirmation: true,
      rfidEnabled: true,
      maxTicketsPerOrder: 10,
    },
    ...initialData,
    // Format dates for datetime-local input (yyyy-MM-ddTHH:mm)
    startDate: initialData.startDate ? format(new Date(initialData.startDate), "yyyy-MM-dd'T'HH:mm") : '',
    endDate: initialData.endDate ? format(new Date(initialData.endDate), "yyyy-MM-dd'T'HH:mm") : '',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.includes('.')) {
      const [p1, p2] = name.split('.');
      setForm(prev => ({ ...prev, [p1]: { ...prev[p1], [p2]: type === 'checkbox' ? checked : value } }));
    } else {
      setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const addItem = (field, item) => setForm(prev => ({ ...prev, [field]: [...prev[field], item] }));
  const removeItem = (field, index) => setForm(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl">
        {activeTab === 'Basic Info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
                <input name="name" value={form.name} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                <select name="eventType" value={form.eventType} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {['cricket', 'concert', 'conference', 'other'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name *</label>
                <input name="venue.name" value={form.venue.name} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input name="venue.city" value={form.venue.city} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div className="grid grid-cols-2 gap-2 col-span-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input type="datetime-local" name="startDate" value={form.startDate} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input type="datetime-local" name="endDate" value={form.endDate} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows="3" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></textarea>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
                <input type="file" accept="image/*" onChange={(e) => setForm(prev => ({ ...prev, coverImageFile: e.target.files[0] }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                {form.coverImage && (
                  <div className="mt-2">
                    <img src={form.coverImage} alt="Current cover" className="w-32 h-20 object-cover rounded" />
                  </div>
                )}
              </div>
              {organisers.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Main Organiser</label>
                  <select name="mainOrganiser" value={form.mainOrganiser?._id || form.mainOrganiser || ''} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">— Unassigned —</option>
                    {organisers.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Categories' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700">Ticket Categories</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => addItem('categories', { id: `cat-${Date.now()}`, name: '', price: 0, capacity: 0, allowedZones: [] })}>+ Add Category</Button>
            </div>
            {form.categories.map((cat, idx) => (
              <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-wrap gap-3 items-end">
                <div className="w-40"><label className="block text-xs text-gray-500 mb-1">Name *</label><input required value={cat.name} onChange={e => { const nc = [...form.categories]; nc[idx].name = e.target.value; setForm({...form, categories: nc})}} className="w-full border border-gray-300 rounded px-2 py-1 text-sm"/></div>
                <div className="w-24"><label className="block text-xs text-gray-500 mb-1">Price *</label><input type="number" required min="0" value={cat.price} onChange={e => { const nc = [...form.categories]; nc[idx].price = Number(e.target.value); setForm({...form, categories: nc})}} className="w-full border border-gray-300 rounded px-2 py-1 text-sm"/></div>
                <div className="w-24"><label className="block text-xs text-gray-500 mb-1">Capacity *</label><input type="number" required min="1" value={cat.capacity} onChange={e => { const nc = [...form.categories]; nc[idx].capacity = Number(e.target.value); setForm({...form, categories: nc})}} className="w-full border border-gray-300 rounded px-2 py-1 text-sm"/></div>
                <button type="button" onClick={() => removeItem('categories', idx)} className="text-red-500 text-sm pb-1">Remove</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Zones' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700">Event Zones</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => addItem('zones', { id: `zone-${Date.now()}`, name: '', description: '' })}>+ Add Zone</Button>
            </div>
            {form.zones.map((zone, idx) => (
              <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex gap-3 items-end">
                <div className="flex-1"><label className="block text-xs text-gray-500 mb-1">Zone Name *</label><input required value={zone.name} onChange={e => { const nz = [...form.zones]; nz[idx].name = e.target.value; setForm({...form, zones: nz})}} className="w-full border border-gray-300 rounded px-2 py-1 text-sm"/></div>
                <div className="flex-1"><label className="block text-xs text-gray-500 mb-1">Description</label><input value={zone.description} onChange={e => { const nz = [...form.zones]; nz[idx].description = e.target.value; setForm({...form, zones: nz})}} className="w-full border border-gray-300 rounded px-2 py-1 text-sm"/></div>
                <button type="button" onClick={() => removeItem('zones', idx)} className="text-red-500 text-sm pb-1">Remove</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Match Details' && (
          <div className="grid grid-cols-2 gap-4">
             <div><label className="block text-sm font-medium text-gray-700 mb-1">Team A</label><input name="matchDetails.teamA" value={form.matchDetails.teamA} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/></div>
             <div><label className="block text-sm font-medium text-gray-700 mb-1">Team B</label><input name="matchDetails.teamB" value={form.matchDetails.teamB} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/></div>
             <div><label className="block text-sm font-medium text-gray-700 mb-1">Match Type</label><input name="matchDetails.matchType" value={form.matchDetails.matchType} onChange={handleChange} placeholder="e.g. T20, ODI" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/></div>
             <div><label className="block text-sm font-medium text-gray-700 mb-1">Series</label><input name="matchDetails.series" value={form.matchDetails.series} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/></div>
          </div>
        )}

        {activeTab === 'Settings' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" name="settings.requirePhotoVerification" checked={form.settings.requirePhotoVerification} onChange={handleChange} id="requirePhoto"/>
              <label htmlFor="requirePhoto" className="text-sm text-gray-700 font-medium">Require Photo Verification</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" name="settings.allowSelfConfirmation" checked={form.settings.allowSelfConfirmation} onChange={handleChange} id="allowSelf"/>
              <label htmlFor="allowSelf" className="text-sm text-gray-700 font-medium">Allow Attendee Self-Confirmation</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" name="settings.rfidEnabled" checked={form.settings.rfidEnabled} onChange={handleChange} id="rfid"/>
              <label htmlFor="rfid" className="text-sm text-gray-700 font-medium">Enable RFID/Wristband tracking</label>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 pt-6 border-t border-gray-100">
        <Button type="submit" loading={loading} className="px-8">Save Event Details</Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
      </div>
    </form>
  );
};

export default EventForm;
