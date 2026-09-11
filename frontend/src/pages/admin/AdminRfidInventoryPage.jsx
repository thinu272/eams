import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getAllEventsAdmin } from '../../api/events';
import { addRfidTags, deleteRfidTag, getRfidTags, uploadRfidTags } from '../../api/rfid';
import toast from 'react-hot-toast';

const AdminRfidInventoryPage = ({ embedded = false }) => {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState([]);
  const [manualTags, setManualTags] = useState('');
  const [singleTag, setSingleTag] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();

  const event = useMemo(() => events.find((item) => item._id === eventId), [events, eventId]);
  const categories = event?.categories || [];
  const available = tags.filter((tag) => tag.status === 'available').length;
  const assigned = tags.filter((tag) => tag.status === 'assigned').length;
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const categoryLimit = Number(selectedCategory?.capacity || 0);
  const categoryConstraint = categoryLimit ? `${assigned + available}/${categoryLimit} RFID slots used` : 'No category limit';

  const loadTags = async (id = eventId) => {
    if (!id) return;
    try {
      const response = await getRfidTags(id);
      setTags(response.data?.data?.tags || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load RFID inventory');
    }
  };

  useEffect(() => {
    getAllEventsAdmin({ limit: 200 }).then((response) => {
      const nextEvents = response.data?.data?.events || [];
      setEvents(nextEvents);
      const preferredEventId = searchParams.get('eventId');
      setEventId(nextEvents.some((item) => item._id === preferredEventId) ? preferredEventId : nextEvents[0]?._id || '');
    }).catch(() => toast.error('Failed to load events'));
  }, [searchParams]);

  useEffect(() => {
    setCategoryId(event?.categories?.[0]?.id || '');
    loadTags();
  }, [eventId]);

  const addManual = async (e) => {
    e.preventDefault();
    const values = manualTags.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean);
    if (!eventId || !categoryId || !values.length) return toast.error('Select an event/category and enter RFID codes');
    setLoading(true);
    try {
      const response = await addRfidTags(eventId, categoryId, values);
      toast.success(`${response.data?.data?.added || 0} RFID tags added`);
      setManualTags('');
      loadTags();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add RFID tags');
    } finally { setLoading(false); }
  };

  const addSingle = async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = singleTag.trim();
    if (!/^\d{10}$/.test(value)) return toast.error('RFID must be exactly 10 digits');
    try {
      const response = await addRfidTags(eventId, categoryId, [value]);
      if (!response.data?.data?.added) return toast.error('RFID already exists or was invalid');
      toast.success('RFID assigned to inventory');
      setSingleTag('');
      loadTags();
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to add RFID'); }
  };

  const upload = async (e) => {
    const nextFile = e.target.files?.[0];
    setFile(nextFile || null);
    if (!nextFile || !eventId || !categoryId) return;
    setLoading(true);
    try {
      const response = await uploadRfidTags(eventId, categoryId, nextFile);
      toast.success(`${response.data?.data?.added || 0} RFID tags imported`);
      loadTags();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to import RFID Excel file');
    } finally { setLoading(false); setFile(null); e.target.value = ''; }
  };

  const remove = async (tag) => {
    try {
      await deleteRfidTag(eventId, tag._id);
      setTags((current) => current.filter((item) => item._id !== tag._id));
    } catch (error) { toast.error(error.response?.data?.message || 'Cannot remove this RFID'); }
  };

  const content = (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Event Operations</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">RFID Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">Load RFID cards by ticket category. The first available card is assigned when a buyer claims a ticket.</p>
        </div>
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm">
            {events.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm">
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name} ({category.capacity})</option>)}
          </select>
          <div className="flex flex-col justify-center rounded-xl bg-slate-50 px-3 py-2 text-sm"><div className="flex items-center justify-around"><span>Available <b className="text-emerald-600">{available}</b></span><span>Assigned <b className="text-blue-600">{assigned}</b></span></div><div className="mt-2 text-center text-[11px] font-medium text-slate-600">{categoryConstraint}</div></div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <form onSubmit={addManual} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Add cards manually</h2>
            <p className="mt-1 text-xs text-slate-500">Tap one card into the focused field, or paste multiple codes below.</p>
            <input value={singleTag} onChange={(e) => setSingleTag(e.target.value.replace(/\D/g, '').slice(0, 10))} onKeyDown={addSingle} autoFocus maxLength={10} inputMode="numeric" placeholder="Tap card to add one RFID..." className="mt-4 w-full rounded-xl border border-blue-300 bg-blue-50 p-3 text-center font-mono tracking-[0.2em] outline-none focus:ring-2 focus:ring-blue-500" />
            <textarea value={manualTags} onChange={(e) => setManualTags(e.target.value)} rows={6} placeholder="1234567890\n1234567891" className="mt-4 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm" />
            <button disabled={loading} className="mt-3 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Add RFID cards</button>
          </form>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Import Excel inventory</h2>
            <p className="mt-1 text-xs text-slate-500">Upload an `.xlsx` file with a column named `RFID Tag` or `rfidTag`.</p>
            <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 px-4 py-10 text-sm font-semibold text-blue-700">
              {file ? file.name : 'Choose Excel file'}
              <input type="file" accept=".xlsx,.xls,.csv" onChange={upload} className="hidden" />
            </label>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 font-bold text-slate-900">{event?.name || 'Event'} RFID cards</div>
          <div className="max-h-[28rem] overflow-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">RFID</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Attendee</th><th /></tr></thead><tbody>{tags.map((tag) => <tr key={tag._id} className="border-t border-slate-100"><td className="px-5 py-3 font-mono">{tag.rfidTag}</td><td className="px-5 py-3">{categories.find((item) => item.id === tag.categoryId)?.name || tag.categoryId}</td><td className="px-5 py-3"><span className={tag.status === 'assigned' ? 'text-blue-600' : 'text-emerald-600'}>{tag.status}</span></td><td className="px-5 py-3">{tag.attendee?.fullName || '-'}</td><td className="px-5 py-3 text-right">{tag.status === 'available' && <button onClick={() => remove(tag)} className="text-xs font-semibold text-red-600">Remove</button>}</td></tr>)}</tbody></table></div>
        </div>
      </div>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default AdminRfidInventoryPage;
