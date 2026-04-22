import React, { useEffect, useMemo, useState } from 'react';
import { getMyEvents } from '../../api/events';
import { bulkUpload, downloadTemplate } from '../../api/attendees';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const BulkUploadPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [categoryId, setCategoryId] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    getMyEvents().then((response) => {
      const myEvents = response.data?.data?.events || [];
      setEvents(myEvents);
      
      const lastId = localStorage.getItem('lastSelectedEventId');
      if (lastId && myEvents.some(e => e._id === lastId)) {
        setSelectedEvent(lastId);
        const selected = myEvents.find(e => e._id === lastId);
        setCategoryId(selected?.categories?.[0]?.id || '');
      } else if (myEvents.length > 0) {
        setSelectedEvent(myEvents[0]._id);
        if (myEvents[0].categories?.length) {
          setCategoryId(myEvents[0].categories[0].id);
        }
      }
    });

    const handleEventSelect = (e) => {
      const newId = e.detail;
      setSelectedEvent(newId);
      // Auto-set category for first available in new event
      getMyEvents().then(res => {
        const matching = (res.data?.data?.events || []).find(ev => ev._id === newId);
        if (matching?.categories?.length) {
          setCategoryId(matching.categories[0].id);
        }
      });
    };

    window.addEventListener('eams:event-select', handleEventSelect);
    return () => window.removeEventListener('eams:event-select', handleEventSelect);
  }, []);

  const selectedEventData = useMemo(
    () => events.find((event) => event._id === selectedEvent),
    [events, selectedEvent]
  );

  const availableCategories = useMemo(() => {
    if (!selectedEventData || !selectedEventData.categories) return [];
    
    // Sub-organisers can only see categories where they management at least one of the required zones
    if (user?.role === 'SubOrganiser') {
      const myZones = (user.responsibilities?.zoneIds || []).map(String);
      return selectedEventData.categories.filter(cat => {
        const catZones = (cat.allowedZones || []).map(String);
        // Show if cat has no zones (general access) OR has any zone overlap with sub-organiser
        return catZones.length === 0 || catZones.some(z => myZones.includes(z));
      });
    }
    
    return selectedEventData.categories;
  }, [selectedEventData, user]);

  const handleDownload = async () => {
    try {
      const response = await downloadTemplate();
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'attendee_template.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download template');
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedEvent || !categoryId) {
      toast.error('Select an event, category, and Excel file first');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('eventId', selectedEvent);
      formData.append('categoryId', categoryId);

      const response = await bulkUpload(formData);
      setResult(response.data?.data || null);
      toast.success(response.data?.message || 'Bulk upload complete');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Upload Attendees</h1>
          <p className="text-sm text-gray-500">Upload an Excel sheet to create attendee records quickly for your assigned event and category.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Step 1</p>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">Prepare the Excel file</h2>
            <p className="mt-2 text-sm text-gray-600">
              Use the template so column names match what the importer expects. Rows with missing required values will be skipped and reported back.
            </p>
            <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              Expected columns:
              <div className="mt-2 flex flex-wrap gap-2">
                {['Full Name', 'Email', 'Phone', 'National ID', 'Passport Number', 'Date of Birth', 'Nationality', 'Notes'].map((column) => (
                  <span key={column} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                    {column}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-5">
              <Button variant="outline" onClick={handleDownload}>
                Download Template
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Step 2</p>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">Upload completed sheet</h2>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Event</label>
                <select
                  value={selectedEvent}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedEvent(value);
                    const selected = events.find((item) => item._id === value);
                    // Find first available category instead of first absolute category
                    if (selected?.categories) {
                      const myZones = (user?.responsibilities?.zoneIds || []).map(String);
                      const available = selected.categories.filter(cat => {
                        const catZones = (cat.allowedZones || []).map(String);
                        return catZones.length === 0 || catZones.some(z => myZones.includes(z));
                      });
                      setCategoryId(available?.[0]?.id || '');
                    } else {
                      setCategoryId('');
                    }
                  }}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  {events.map((event) => (
                    <option key={event._id} value={event._id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a category</option>
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {user?.role === 'SubOrganiser' && availableCategories.length === 0 && selectedEvent && (
                  <p className="mt-1 text-[10px] text-red-500 italic">No categories available for your assigned zones.</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Excel file</label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center transition-colors hover:border-blue-300 hover:bg-blue-50">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  className="hidden"
                />
                <p className="text-sm font-medium text-gray-900">{file?.name || 'Choose an Excel file'}</p>
                <p className="mt-2 text-xs text-gray-500">Supported formats: .xlsx, .xls</p>
              </label>
            </div>

            <div className="mt-5 flex gap-3">
              <Button onClick={handleUpload} loading={uploading}>
                Upload and Create Attendees
              </Button>
              <Button variant="outline" onClick={() => setFile(null)}>
                Clear File
              </Button>
            </div>
          </div>
        </div>

        {result && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Upload Results</h2>
                <p className="text-sm text-gray-500">Review what was created and which rows still need attention.</p>
              </div>
              <div className="flex gap-3">
                <div className="rounded-xl bg-blue-50 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{result.created || 0}</p>
                  <p className="text-xs text-blue-700">Created</p>
                </div>
                <div className="rounded-xl bg-red-50 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{result.errors?.length || 0}</p>
                  <p className="text-xs text-red-700">Errors</p>
                </div>
              </div>
            </div>

            {result.errors?.length > 0 ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-red-100">
                <div className="grid grid-cols-[120px_1fr] bg-red-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-red-700">
                  <span>Row</span>
                  <span>Issue</span>
                </div>
                {result.errors.map((error, index) => (
                  <div key={`${error.row}-${index}`} className="grid grid-cols-[120px_1fr] border-t border-red-100 px-4 py-3 text-sm text-gray-700">
                    <span className="font-medium text-gray-900">{error.row}</span>
                    <span>{error.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                No row-level errors were reported. Your attendee list was imported cleanly.
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BulkUploadPage;
