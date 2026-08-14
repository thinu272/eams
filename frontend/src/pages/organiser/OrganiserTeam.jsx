import React, { useEffect, useState } from 'react';
import OrganiserLayout from '../../layouts/OrganiserLayout';
import { listSubOrganisers, createSubOrganiser, updateSubOrganiserStatus, getOrganiserTicketCategories, deleteSubOrganiser } from '../../api/organiser';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { TrashIcon, PencilIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

const OrganiserTeam = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [form, setForm] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    password: '', 
    canCollectCash: false,
    canConfirmCashPayments: false,
    canApproveBankTransfer: false,
    canViewPayments: false,
    canProcessRefunds: false,
    canManagePaymentMethods: false,
    canViewPaymentHistory: false,
    canHandlePaymentDisputes: false,
    canGeneratePaymentReports: false,
    canAddAttendees: false,
    canPhotoVerification: false,
    canSendInvitations: false,
    canExcelBulkImports: false,
    canGateScanAccess: false,
    canViewEvents: false,
    canEditEvents: false,
    canViewAttendees: false,
    canEditAttendees: false,
    canViewTickets: false,
    canEditTickets: false,
    canScanTickets: false,
    canViewZones: false,
    canManageZones: false,
    canViewReports: false,
    canExportReports: false,
    canViewRevenue: false,
    canSendNotifications: false
  });
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const load = () => {
    setLoading(true);
    listSubOrganisers()
      .then((res) => setUsers(res.data?.data?.users || []))
      .finally(() => setLoading(false));
  };

  const resetForm = () => {
    setForm({ 
      name: '', 
      email: '', 
      phone: '', 
      password: '', 
      canCollectCash: false,
      canConfirmCashPayments: false,
      canApproveBankTransfer: false,
      canViewPayments: false,
      canProcessRefunds: false,
      canManagePaymentMethods: false,
      canViewPaymentHistory: false,
      canHandlePaymentDisputes: false,
      canGeneratePaymentReports: false,
      canAddAttendees: false,
      canPhotoVerification: false,
      canSendInvitations: false,
      canExcelBulkImports: false,
      canGateScanAccess: false,
      canViewEvents: false,
      canEditEvents: false,
      canViewAttendees: false,
      canEditAttendees: false,
      canViewTickets: false,
      canEditTickets: false,
      canScanTickets: false,
      canViewZones: false,
      canManageZones: false,
      canViewReports: false,
      canExportReports: false,
      canViewRevenue: false,
      canSendNotifications: false
    });
    setSelectedCategories([]);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      return toast.error('Please fill in all required fields');
    }
    setSubmitting(true);
    try {
      const permissions = {
        canCollectCash: form.canCollectCash,
        canConfirmCashPayments: form.canConfirmCashPayments,
        canApproveBankTransfer: form.canApproveBankTransfer,
        canViewPayments: form.canViewPayments,
        canProcessRefunds: form.canProcessRefunds,
        canManagePaymentMethods: form.canManagePaymentMethods,
        canViewPaymentHistory: form.canViewPaymentHistory,
        canHandlePaymentDisputes: form.canHandlePaymentDisputes,
        canGeneratePaymentReports: form.canGeneratePaymentReports,
        canAddAttendees: form.canAddAttendees,
        canPhotoVerification: form.canPhotoVerification,
        canSendInvitations: form.canSendInvitations,
        canExcelBulkImports: form.canExcelBulkImports,
        canGateScanAccess: form.canGateScanAccess,
        canViewEvents: form.canViewEvents,
        canEditEvents: form.canEditEvents,
        canViewAttendees: form.canViewAttendees,
        canEditAttendees: form.canEditAttendees,
        canViewTickets: form.canViewTickets,
        canEditTickets: form.canEditTickets,
        canScanTickets: form.canScanTickets,
        canViewZones: form.canViewZones,
        canManageZones: form.canManageZones,
        canViewReports: form.canViewReports,
        canExportReports: form.canExportReports,
        canViewRevenue: form.canViewRevenue,
        canSendNotifications: form.canSendNotifications
      };
      await createSubOrganiser({ 
        ...form, 
        permissions,
        assignedCategories: selectedCategories,
        // Send individual permission fields for backend compatibility
        canCollectCash: form.canCollectCash,
        canConfirmCashPayments: form.canConfirmCashPayments,
        canApproveBankTransfer: form.canApproveBankTransfer,
        canViewPayments: form.canViewPayments,
        canProcessRefunds: form.canProcessRefunds,
        canManagePaymentMethods: form.canManagePaymentMethods,
        canViewPaymentHistory: form.canViewPaymentHistory,
        canHandlePaymentDisputes: form.canHandlePaymentDisputes,
        canGeneratePaymentReports: form.canGeneratePaymentReports,
        canAddAttendees: form.canAddAttendees,
        canPhotoVerification: form.canPhotoVerification,
        canSendInvitations: form.canSendInvitations,
        canExcelBulkImports: form.canExcelBulkImports,
        canGateScanAccess: form.canGateScanAccess,
      });
      toast.success('Sub organiser invited successfully');
      setOpen(false);
      resetForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invite failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (user) => {
    setEditMode(true);
    setEditingUserId(user._id);
    const userPermissions = user.permissions || {};
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      password: '',
      canCollectCash: user.canCollectCash || userPermissions.canCollectCash || false,
      canConfirmCashPayments: userPermissions.canConfirmCashPayments || false,
      canApproveBankTransfer: user.canApproveBankTransfer || userPermissions.canApproveBankTransfer || false,
      canViewPayments: userPermissions.canViewPayments || false,
      canProcessRefunds: userPermissions.canProcessRefunds || false,
      canManagePaymentMethods: userPermissions.canManagePaymentMethods || false,
      canViewPaymentHistory: userPermissions.canViewPaymentHistory || false,
      canHandlePaymentDisputes: userPermissions.canHandlePaymentDisputes || false,
      canGeneratePaymentReports: userPermissions.canGeneratePaymentReports || false,
      canAddAttendees: userPermissions.canAddAttendees || false,
      canPhotoVerification: userPermissions.canPhotoVerification || false,
      canSendInvitations: userPermissions.canSendInvitations || false,
      canExcelBulkImports: userPermissions.canExcelBulkImports || false,
      canGateScanAccess: userPermissions.canGateScanAccess || false,
      canViewEvents: userPermissions.canViewEvents || false,
      canEditEvents: userPermissions.canEditEvents || false,
      canViewAttendees: userPermissions.canViewAttendees || false,
      canEditAttendees: userPermissions.canEditAttendees || false,
      canViewTickets: userPermissions.canViewTickets || false,
      canEditTickets: userPermissions.canEditTickets || false,
      canScanTickets: userPermissions.canScanTickets || false,
      canViewZones: userPermissions.canViewZones || false,
      canManageZones: userPermissions.canManageZones || false,
      canViewReports: userPermissions.canViewReports || false,
      canExportReports: userPermissions.canExportReports || false,
      canViewRevenue: userPermissions.canViewRevenue || false,
      canSendNotifications: userPermissions.canSendNotifications || false,
    });
    // Fetch categories and set selections
    getOrganiserTicketCategories({ eventId: localStorage.getItem('lastSelectedEventId') })
      .then(res => {
        const cats = res.data?.data?.categories || [];
        setCategories(cats);
        const assigned = cats.filter(cat => (cat.assignedSubOrganisers || []).includes(user._id)).map(cat => cat._id);
        setSelectedCategories(assigned);
      })
      .catch(err => {
        console.error('Failed to load categories', err);
      });
    setOpen(true);
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    
    try {
      await deleteSubOrganiser(userToDelete._id);
      toast.success('Team member deleted successfully');
      setDeleteModalOpen(false);
      setUserToDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const load = () => {
    setLoading(true);
    listSubOrganisers()
      .then((res) => setUsers(res.data?.data?.users || []))
      .finally(() => setLoading(false));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      return toast.error('Please fill in all required fields');
    }
    setSubmitting(true);
    try {
      const permissions = {
        canCollectCash: form.canCollectCash,
        canConfirmCashPayments: form.canConfirmCashPayments,
        canApproveBankTransfer: form.canApproveBankTransfer,
        canViewPayments: form.canViewPayments,
        canProcessRefunds: form.canProcessRefunds,
        canManagePaymentMethods: form.canManagePaymentMethods,
        canViewPaymentHistory: form.canViewPaymentHistory,
        canHandlePaymentDisputes: form.canHandlePaymentDisputes,
        canGeneratePaymentReports: form.canGeneratePaymentReports,
        canAddAttendees: form.canAddAttendees,
        canPhotoVerification: form.canPhotoVerification,
        canSendInvitations: form.canSendInvitations,
        canExcelBulkImports: form.canExcelBulkImports,
        canGateScanAccess: form.canGateScanAccess,
        canViewEvents: form.canViewEvents,
        canEditEvents: form.canEditEvents,
        canViewAttendees: form.canViewAttendees,
        canEditAttendees: form.canEditAttendees,
        canViewTickets: form.canViewTickets,
        canEditTickets: form.canEditTickets,
        canScanTickets: form.canScanTickets,
        canViewZones: form.canViewZones,
        canManageZones: form.canManageZones,
        canViewReports: form.canViewReports,
        canExportReports: form.canExportReports,
        canViewRevenue: form.canViewRevenue,
        canSendNotifications: form.canSendNotifications
      };
      const updateData = { 
        name: form.name, 
        email: form.email, 
        phone: form.phone, 
        canCollectCash: form.canCollectCash,
        canConfirmCashPayments: form.canConfirmCashPayments,
        canApproveBankTransfer: form.canApproveBankTransfer,
        canViewPayments: form.canViewPayments,
        canProcessRefunds: form.canProcessRefunds,
        canManagePaymentMethods: form.canManagePaymentMethods,
        canViewPaymentHistory: form.canViewPaymentHistory,
        canHandlePaymentDisputes: form.canHandlePaymentDisputes,
        canGeneratePaymentReports: form.canGeneratePaymentReports,
        canAddAttendees: form.canAddAttendees,
        canPhotoVerification: form.canPhotoVerification,
        canSendInvitations: form.canSendInvitations,
        canExcelBulkImports: form.canExcelBulkImports,
        canGateScanAccess: form.canGateScanAccess,
        permissions,
        assignedCategories: selectedCategories,
        // Send individual permission fields for backend compatibility
        canViewEvents: form.canViewEvents,
        canEditEvents: form.canEditEvents,
        canViewAttendees: form.canViewAttendees,
        canEditAttendees: form.canEditAttendees,
        canViewTickets: form.canViewTickets,
        canEditTickets: form.canEditTickets,
        canScanTickets: form.canScanTickets,
        canViewZones: form.canViewZones,
        canManageZones: form.canManageZones,
        canViewReports: form.canViewReports,
        canExportReports: form.canExportReports,
        canViewRevenue: form.canViewRevenue,
        canSendNotifications: form.canSendNotifications
      };
      if (form.password) {
        updateData.password = form.password;
      }
      await updateSubOrganiserStatus(editingUserId, updateData);
      toast.success('Team member updated successfully');
      setOpen(false);
      setEditMode(false);
      setEditingUserId(null);
      resetForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setOpen(false);
    setEditMode(false);
    setEditingUserId(null);
    resetForm();
    setCategories([]);
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await updateSubOrganiserStatus(id, currentStatus === 'Active' ? 'inactive' : 'active');
      toast.success('Status updated successfully');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  };

  const toggleCashCollection = async (id, currentCanCollectCash) => {
    try {
      await updateSubOrganiserStatus(id, { canCollectCash: !currentCanCollectCash });
      toast.success('Cash collection permission updated successfully');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Permission update failed');
    }
  };

  return (
    <OrganiserLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Team Management</h1>
            <p className="text-slate-500 mt-1">Manage your sub-organisers and team members</p>
          </div>
          <Button 
            onClick={() => setOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            + Add Team Member
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-slate-600 text-sm font-medium">Total Members</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{users.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-slate-600 text-sm font-medium">Active</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{users.filter(u => u.status === 'Active').length}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-slate-600 text-sm font-medium">Inactive</p>
            <p className="text-2xl font-bold text-slate-500 mt-1">{users.filter(u => u.status !== 'Active').length}</p>
          </div>
        </div>

        {/* Team Members Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Name</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Email</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Phone</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Cash Collection</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Status</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900">{u.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">ID: {u._id?.slice(-6)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{u.email}</td>
                      <td className="px-6 py-4 text-slate-700">{u.phone || '—'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleCashCollection(u._id, u.canCollectCash || u.permissions?.canCollectCash)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            (u.canCollectCash || u.permissions?.canCollectCash) ? 'bg-green-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              (u.canCollectCash || u.permissions?.canCollectCash) ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {u.status === 'Active' ? (
                            <>
                              <CheckCircleIcon className="w-4 h-4 text-green-600" />
                              <span className="inline-flex px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                Active
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircleIcon className="w-4 h-4 text-slate-400" />
                              <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                                Inactive
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEdit(u)}
                            className="text-xs"
                          >
                            <PencilIcon className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => toggleStatus(u._id, u.status)}
                            className="text-xs"
                          >
                            {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDeleteClick(u)}
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <TrashIcon className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-slate-400 text-4xl mb-3">👥</div>
              <p className="text-slate-500 font-medium">No team members yet</p>
              <p className="text-slate-400 text-sm mt-1">Add your first team member to get started</p>
              <Button 
                size="sm"
                onClick={() => setOpen(true)}
                className="mt-4"
              >
                Add First Member
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Team Member Modal */}
      <Modal 
        open={open} 
        onClose={handleCloseModal}
        title={editMode ? "Edit Team Member" : "Add New Team Member"}
        size="lg"
      >
        <div className="mb-6">
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">{editMode ? "Edit Team Member" : "Add Team Member"}</h3>
              <p className="text-sm text-blue-700">{editMode ? "Update team member details and permissions" : "Create a new sub-organiser account with access to your event"}</p>
            </div>
          </div>
        </div>

        <form onSubmit={editMode ? handleUpdate : handleCreate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Full Name *
              </label>
              <input 
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                placeholder="Enter full name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address *
              </label>
              <input 
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                placeholder="john@example.com"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <p className="text-xs text-slate-500 mt-1">Invitation will be sent to this email</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Phone Number *
              </label>
              <input 
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                placeholder="+1 234 567 8900"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                required
              />
              <p className="text-xs text-slate-500 mt-1">International format required</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {editMode ? 'New Password (leave blank to keep current)' : 'Temporary Password *'}
              </label>
              <input 
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                placeholder={editMode ? "Enter new password or leave blank" : "Create a secure temporary password"}
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required={!editMode}
              />
              <p className="text-xs text-slate-500 mt-1">{editMode ? "Only fill if you want to change the password" : "Member will be asked to change this on first login"}</p>
            </div>
          </div>

          {/* Permissions Scope Section */}
          <div className="border-t pt-6">
            <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Permissions Scope
            </h4>
            
            <div className="space-y-4">
              {/* Payment & Financial Permissions */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Payment & Financial</h5>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canCollectCash}
                      onChange={(e) => setForm((f) => ({ ...f, canCollectCash: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Collect Cash Payments</p>
                      <p className="text-xs text-slate-600">View and collect cash at entrance reservations</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canConfirmCashPayments}
                      onChange={(e) => setForm((f) => ({ ...f, canConfirmCashPayments: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Confirm Cash Payments</p>
                      <p className="text-xs text-slate-600">Confirm and finalize received cash payments</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canApproveBankTransfer}
                      onChange={(e) => setForm((f) => ({ ...f, canApproveBankTransfer: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Approve Bank Transfers</p>
                      <p className="text-xs text-slate-600">Review and approve bank transfer payments</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canViewRevenue}
                      onChange={(e) => setForm((f) => ({ ...f, canViewRevenue: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">View Revenue</p>
                      <p className="text-xs text-slate-600">Access revenue and financial reports</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canViewPayments}
                      onChange={(e) => setForm((f) => ({ ...f, canViewPayments: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">View All Payments</p>
                      <p className="text-xs text-slate-600">Access payment overview and transaction details</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canProcessRefunds}
                      onChange={(e) => setForm((f) => ({ ...f, canProcessRefunds: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Process Refunds</p>
                      <p className="text-xs text-slate-600">Handle refund requests and process returns</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canManagePaymentMethods}
                      onChange={(e) => setForm((f) => ({ ...f, canManagePaymentMethods: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Manage Payment Methods</p>
                      <p className="text-xs text-slate-600">Configure and manage payment gateways</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canViewPaymentHistory}
                      onChange={(e) => setForm((f) => ({ ...f, canViewPaymentHistory: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">View Payment History</p>
                      <p className="text-xs text-slate-600">Access historical payment records and logs</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canHandlePaymentDisputes}
                      onChange={(e) => setForm((f) => ({ ...f, canHandlePaymentDisputes: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Handle Payment Disputes</p>
                      <p className="text-xs text-slate-600">Resolve payment conflicts and chargebacks</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canGeneratePaymentReports}
                      onChange={(e) => setForm((f) => ({ ...f, canGeneratePaymentReports: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Generate Payment Reports</p>
                      <p className="text-xs text-slate-600">Create and export financial payment reports</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Event Management Permissions */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Event Management</h5>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canViewEvents}
                      onChange={(e) => setForm((f) => ({ ...f, canViewEvents: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">View Events</p>
                      <p className="text-xs text-slate-600">View event details and information</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canEditEvents}
                      onChange={(e) => setForm((f) => ({ ...f, canEditEvents: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Edit Events</p>
                      <p className="text-xs text-slate-600">Modify event details and settings</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Attendee Management Permissions */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Attendee Management</h5>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canViewAttendees}
                      onChange={(e) => setForm((f) => ({ ...f, canViewAttendees: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">View Attendees</p>
                      <p className="text-xs text-slate-600">View attendee list and information</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canEditAttendees}
                      onChange={(e) => setForm((f) => ({ ...f, canEditAttendees: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Edit Attendees</p>
                      <p className="text-xs text-slate-600">Modify attendee information</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canAddAttendees}
                      onChange={(e) => setForm((f) => ({ ...f, canAddAttendees: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Add Attendees</p>
                      <p className="text-xs text-slate-600">Register guests directly</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canPhotoVerification}
                      onChange={(e) => setForm((f) => ({ ...f, canPhotoVerification: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Photo Verification</p>
                      <p className="text-xs text-slate-600">Approve attendee photo uploads</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canSendInvitations}
                      onChange={(e) => setForm((f) => ({ ...f, canSendInvitations: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Send Invitations</p>
                      <p className="text-xs text-slate-600">Resend confirmation emails</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canExcelBulkImports}
                      onChange={(e) => setForm((f) => ({ ...f, canExcelBulkImports: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Excel Bulk Imports</p>
                      <p className="text-xs text-slate-600">Upload large spreadsheets</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Ticket Management Permissions */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Ticket Management</h5>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canViewTickets}
                      onChange={(e) => setForm((f) => ({ ...f, canViewTickets: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">View Tickets</p>
                      <p className="text-xs text-slate-600">View ticket information and details</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canEditTickets}
                      onChange={(e) => setForm((f) => ({ ...f, canEditTickets: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Edit Tickets</p>
                      <p className="text-xs text-slate-600">Modify ticket details and status</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canScanTickets}
                      onChange={(e) => setForm((f) => ({ ...f, canScanTickets: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Scan Tickets</p>
                      <p className="text-xs text-slate-600">Scan tickets for entry validation</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canGateScanAccess}
                      onChange={(e) => setForm((f) => ({ ...f, canGateScanAccess: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Gate Scan Access</p>
                      <p className="text-xs text-slate-600">Scan check-ins at entry</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Zone Management Permissions */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Zone Management</h5>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canViewZones}
                      onChange={(e) => setForm((f) => ({ ...f, canViewZones: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">View Zones</p>
                      <p className="text-xs text-slate-600">View zone information and capacity</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canManageZones}
                      onChange={(e) => setForm((f) => ({ ...f, canManageZones: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Manage Zones</p>
                      <p className="text-xs text-slate-600">Create and modify zone settings</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Reports & Analytics Permissions */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Reports & Analytics</h5>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canViewReports}
                      onChange={(e) => setForm((f) => ({ ...f, canViewReports: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">View Reports</p>
                      <p className="text-xs text-slate-600">Access event and activity reports</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canExportReports}
                      onChange={(e) => setForm((f) => ({ ...f, canExportReports: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Export Reports</p>
                      <p className="text-xs text-slate-600">Download and export reports</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Communication Permissions */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Communication</h5>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canSendNotifications}
                      onChange={(e) => setForm((f) => ({ ...f, canSendNotifications: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Send Notifications</p>
                      <p className="text-xs text-slate-600">Send notifications to attendees and team members</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
            {/* Category Assignment Section */}
            <div className="border-t pt-6">
              <h4 className="text-sm font-bold text-slate-900 mb-4">Assign Ticket Categories</h4>
              <div className="space-y-3">
                {categories.map(cat => (
                  <label key={cat._id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat._id)}
                      onChange={e => {
                        const checked = e.target.checked;
                        setSelectedCategories(prev => checked ? [...new Set([...prev, cat._id])] : prev.filter(id => id !== cat._id));
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-700">{cat.name}</span>
                      <span className="text-xs text-slate-500">{cat.description}</span>
                    </div>
                  </label>
                ))}
                {categories.length === 0 && (
                  <p className="text-xs italic text-slate-400 py-3 text-center">No ticket categories available.</p>
                )}
              </div>
            </div>
            <div className="border-t pt-6 flex gap-3">
              <Button 
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3"
                loading={submitting}
              >
                {editMode ? 'Update Sub Organiser' : 'Send Invitation'}
              </Button>
              <Button 
                type="button"
                variant="outline" 
                className="flex-1 py-3"
                onClick={handleCloseModal}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal 
          open={deleteModalOpen} 
          onClose={() => {
            setDeleteModalOpen(false);
            setUserToDelete(null);
          }}
          title="Delete Team Member"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="font-medium">This action cannot be undone</p>
            </div>
            
            <p className="text-slate-700">
              Are you sure you want to delete <span className="font-semibold text-slate-900">{userToDelete?.name}</span>? 
              This will permanently remove this team member from all events and revoke their access.
            </p>

            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-600">
                <span className="font-medium">Email:</span> {userToDelete?.email}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-medium">Role:</span> {userToDelete?.role}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="button"
                variant="outline" 
                className="flex-1 py-3"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3"
                onClick={handleDeleteConfirm}
              >
                Delete Team Member
              </Button>
            </div>
          </div>
        </Modal>
      </OrganiserLayout>
    );
  };

  export default OrganiserTeam;
