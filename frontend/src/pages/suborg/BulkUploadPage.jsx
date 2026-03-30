import React, { useState, useEffect } from 'react';
import { getMyEvents } from '../../api/events';
import { bulkUpload, downloadTemplate } from '../../api/attendees';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const BulkUploadPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { getMyEvents().then(r => { const evs = r.data.data.events; setEvents(evs); if (evs.length) { setSelectedEvent(evs[0]._id); if (evs[0].categories?.length) setCategoryId(evs[0].categories[0].id); } }); }, []);

  const selectedEventData = events.find(e => e._id === selectedEvent);

  const handleDownload = async () => {
    const r = await downloadTemplate();
    const url = URL.createObjectURL(new Blob([r.data]));
    const a = document.createElement('a'); a.href = url; a.download = 'attendee_template.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!file || !selectedEvent || !categoryId) return toast.error('Select event, category and file');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('eventId', selectedEvent); fd.append('categoryId', categoryId);
      const r = await bulkUpload(fd);
      setResult(r.data.data);
      toast.success(r.data.message);
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <DashboardLayout>
      <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">Bulk Upload Attendees</h1></div>
      <div className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Step 1 — Download Template</h3>
          <p className="text-sm text-gray-500 mb-4">Download the Excel template, fill in attendee details, then upload it below.</p>
          <Button variant="outline" onClick={handleDownload}>⬇ Download Excel Template</Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Step 2 — Upload Completed File</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
            <select value={selectedEvent} onChange={e => { setSelectedEvent(e.target.value); const ev = events.find(x => x._id === e.target.value); if (ev?.categories?.length) setCategoryId(ev.categories[0].id); }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Category</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {(selectedEventData?.categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Excel File (.xlsx)</label>
            <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files[0])} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <Button onClick={handleUpload} loading={uploading}>Upload Attendees</Button>
        </div>

        {result && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Upload Results</h3>
            <div className="flex gap-6">
              <div className="text-center"><p className="text-3xl font-bold text-green-600">{result.created}</p><p className="text-sm text-gray-500">Created</p></div>
              <div className="text-center"><p className="text-3xl font-bold text-red-600">{result.errors?.length || 0}</p><p className="text-sm text-gray-500">Errors</p></div>
            </div>
            {result.errors?.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">Errors:</p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">Row {e.row}: {e.message}</p>)}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BulkUploadPage;
