import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { addInventoryRfid, getRfidInventory, uploadInventoryRfid, disableRfidTag, enableRfidTag, deleteRfidFromInventory, unassignRfidTag } from '../../api/rfid';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  XMarkIcon,
  TrashIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const ActionModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, confirmStyle, loading }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-600">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 p-5">
          <button
            disabled={loading}
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white transition disabled:opacity-50 ${confirmStyle}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminRfidInventoryPage = ({ embedded = false }) => {
  const { user } = useAuth();
  const [tags, setTags] = useState([]);
  const [counts, setCounts] = useState({ total: 0, available: 0, assigned: 0, disabled: 0 });
  const [manualTags, setManualTags] = useState('');
  const [singleTag, setSingleTag] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmStyle: 'bg-blue-600 hover:bg-blue-700',
    action: null,
    actionData: null,
  });

  const loadTags = async () => {
    try {
      const response = await getRfidInventory();
      setTags(response.data?.data?.tags || []);
      setCounts(response.data?.data?.counts || { total: 0, available: 0, assigned: 0, disabled: 0 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load RFID inventory');
    }
  };

  useEffect(() => { loadTags(); }, []);

  const addManual = async (e) => {
    e.preventDefault();
    const values = manualTags.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean);
    if (!values.length) return toast.error('Enter at least one RFID code');
    setLoading(true);
    try {
      const response = await addInventoryRfid(values);
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
      const response = await addInventoryRfid([value]);
      if (!response.data?.data?.added) return toast.error('RFID already exists or was invalid');
      toast.success('RFID assigned to inventory');
      setSingleTag('');
      loadTags();
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to add RFID'); }
  };

  const upload = async (e) => {
    const nextFile = e.target.files?.[0];
    setFile(nextFile || null);
    if (!nextFile) return;
    setLoading(true);
    try {
      const response = await uploadInventoryRfid(nextFile);
      toast.success(`${response.data?.data?.added || 0} RFID tags imported`);
      loadTags();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to import RFID Excel file');
    } finally { setLoading(false); setFile(null); e.target.value = ''; }
  };

  // Disable an available RFID tag
  const handleDisable = (rfidTag) => {
    setModalConfig({
      title: 'Disable RFID Tag',
      message: `Are you sure you want to disable RFID ${rfidTag}? It will be marked as disabled and unavailable for assignment.`,
      confirmText: 'Disable',
      confirmStyle: 'bg-amber-600 hover:bg-amber-700',
      action: async () => {
        setActionLoading(rfidTag);
        try {
          await disableRfidTag(rfidTag, 'Manually disabled by admin');
          toast.success(`RFID ${rfidTag} disabled`);
          loadTags();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to disable RFID');
        } finally { setActionLoading(null); setModalOpen(false); }
      },
      actionData: rfidTag,
    });
    setModalOpen(true);
  };

  // Re-enable a disabled RFID tag
  const handleEnable = (rfidTag) => {
    setModalConfig({
      title: 'Enable RFID Tag',
      message: `Are you sure you want to enable RFID ${rfidTag}? It will become available for assignment.`,
      confirmText: 'Enable',
      confirmStyle: 'bg-emerald-600 hover:bg-emerald-700',
      action: async () => {
        setActionLoading(rfidTag);
        try {
          await enableRfidTag(rfidTag);
          toast.success(`RFID ${rfidTag} enabled`);
          loadTags();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to enable RFID');
        } finally { setActionLoading(null); setModalOpen(false); }
      },
      actionData: rfidTag,
    });
    setModalOpen(true);
  };

  // Delete a non-assigned RFID tag from inventory (admin only)
  const handleDelete = (rfidTag) => {
    setModalConfig({
      title: 'Delete RFID Tag',
      message: `Are you sure you want to delete RFID ${rfidTag} from inventory? This action cannot be undone.`,
      confirmText: 'Delete',
      confirmStyle: 'bg-red-600 hover:bg-red-700',
      action: async () => {
        setActionLoading(rfidTag);
        try {
          await deleteRfidFromInventory(rfidTag);
          toast.success(`RFID ${rfidTag} deleted from inventory`);
          loadTags();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to delete RFID');
        } finally { setActionLoading(null); setModalOpen(false); }
      },
      actionData: rfidTag,
    });
    setModalOpen(true);
  };

  // Unassign an RFID from an assigned attendee
  const handleUnassign = (rfidTag) => {
    setModalConfig({
      title: 'Unassign RFID Tag',
      message: `Are you sure you want to unassign RFID ${rfidTag} from its attendee? The tag will become available for reassignment.`,
      confirmText: 'Unassign',
      confirmStyle: 'bg-amber-600 hover:bg-amber-700',
      action: async () => {
        setActionLoading(rfidTag);
        try {
          await unassignRfidTag(rfidTag, 'Manually unassigned by admin');
          toast.success(`RFID ${rfidTag} unassigned and is now available`);
          loadTags();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to unassign RFID');
        } finally { setActionLoading(null); setModalOpen(false); }
      },
      actionData: rfidTag,
    });
    setModalOpen(true);
  };

  const content = (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Event Operations</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">RFID Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">Register physical RFID tags here. Tags remain available until an operator assigns them after scanning an attendee QR code.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          {[['Total', counts.total, 'text-slate-900'], ['Available', counts.available, 'text-emerald-600'], ['Assigned', counts.assigned, 'text-blue-600'], ['Disabled', counts.disabled, 'text-amber-600']].map(([label, value, color]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p></div>)}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <form onSubmit={addManual} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Add RFID manually</h2>
            <p className="mt-1 text-xs text-slate-500">Tap one card into the focused field, or paste multiple codes below.</p>
            <input value={singleTag} onChange={(e) => setSingleTag(e.target.value.replace(/\D/g, '').slice(0, 10))} onKeyDown={addSingle} autoFocus maxLength={10} inputMode="numeric" placeholder="Tap card to add one RFID..." className="mt-4 w-full rounded-xl border border-blue-300 bg-blue-50 p-3 text-center font-mono tracking-[0.2em] outline-none focus:ring-2 focus:ring-blue-500" />
            <textarea value={manualTags} onChange={(e) => setManualTags(e.target.value)} rows={6} placeholder="1234567890\n1234567891" className="mt-4 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm" />
            <button disabled={loading} className="mt-3 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Add RFID tags</button>
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
          <div className="border-b border-slate-100 px-5 py-4 font-bold text-slate-900 flex justify-between items-center">
            <span>RFID inventory</span>
            <span className="text-xs font-normal text-slate-500">{tags.length} tags</span>
          </div>
          <div className="max-h-[28rem] overflow-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">RFID</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Event</th><th className="px-5 py-3">Attendee</th><th className="px-5 py-3">Actions</th></tr></thead><tbody>{tags.map((tag) => <tr key={tag._id} className="border-t border-slate-100"><td className="px-5 py-3 font-mono">{tag.rfidTag}</td><td className="px-5 py-3"><span className={tag.status === 'ASSIGNED' ? 'text-blue-600 font-medium' : tag.status === 'DISABLED' ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>{tag.status}</span></td><td className="px-5 py-3">{tag.event?.name || '-'}</td><td className="px-5 py-3">{tag.attendee?.fullName || '-'}</td><td className="px-5 py-3">
                {tag.status === 'ASSIGNED' && (
                  <button onClick={() => handleUnassign(tag.rfidTag)} disabled={actionLoading === tag.rfidTag} className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50">
                    <ArrowPathIcon className="h-3.5 w-3.5" /> Unassign
                  </button>
                )}
                {tag.status === 'AVAILABLE' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleDisable(tag.rfidTag)} disabled={actionLoading === tag.rfidTag} className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50">
                      <XMarkIcon className="h-3.5 w-3.5" /> Disable
                    </button>
                    <button onClick={() => handleDelete(tag.rfidTag)} disabled={actionLoading === tag.rfidTag} className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50">
                      <TrashIcon className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                )}
                {tag.status === 'DISABLED' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleEnable(tag.rfidTag)} disabled={actionLoading === tag.rfidTag} className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50">
                      <ArrowPathIcon className="h-3.5 w-3.5" /> Enable
                    </button>
                    <button onClick={() => handleDelete(tag.rfidTag)} disabled={actionLoading === tag.rfidTag} className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50">
                      <TrashIcon className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                )}
              </td></tr>)}</tbody></table></div>
        </div>
        {/* Action Modal */}
        <ActionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onConfirm={modalConfig.action}
          title={modalConfig.title}
          message={modalConfig.message}
          confirmText={modalConfig.confirmText}
          confirmStyle={modalConfig.confirmStyle}
          loading={actionLoading !== null}
        />
      </div>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default AdminRfidInventoryPage;
