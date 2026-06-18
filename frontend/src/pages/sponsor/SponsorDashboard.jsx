import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card, { CardHeader } from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';
import { getSponsorWorkspace, getSponsorTeam, addSponsorTeamMember, removeSponsorTeamMember, downloadTicketPass } from '../../api/sponsor';
import { UserGroupIcon, TicketIcon, CheckBadgeIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const emptyMember = { fullName: '', email: '', phone: '' };

const SponsorDashboard = () => {
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [team, setTeam] = useState([]);
  const [memberModal, setMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState(emptyMember);

  const activeSection = params.get('section') || 'overview';

  const loadData = async () => {
    setLoading(true);
    try {
      const [wsRes, teamRes] = await Promise.all([
        getSponsorWorkspace(),
        getSponsorTeam()
      ]);
      setWorkspace(wsRes.data?.data);
      setTeam(teamRes.data?.data || []);
    } catch (error) {
      toast.error('Failed to load sponsor data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddMember = async () => {
    if (!memberForm.fullName || !memberForm.email) {
      toast.error('Name and email are required');
      return;
    }
    try {
      await addSponsorTeamMember(memberForm);
      toast.success('Team member added and notified');
      setMemberModal(false);
      setMemberForm(emptyMember);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (id) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) return;
    try {
      await removeSponsorTeamMember(id);
      toast.success('Member removed');
      loadData();
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleDownloadPass = async (token, name) => {
    if (!token) return toast.error('QR Token not found');
    try {
      const response = await downloadTicketPass(token);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Pass-${name.replace(/\s+/g, '-')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download pass');
    }
  };

  if (loading && !workspace) return <DashboardLayout><LoadingSkeleton /></DashboardLayout>;

  const pkg = workspace?.package;
  const event = workspace?.event;
  const capacity = Number(pkg?.capacity || 0);
  const teamCount = team.length;
  const remainingSlots = Math.max(capacity - teamCount, 0);
  const utilization = capacity > 0 ? Math.round((teamCount / capacity) * 100) : 0;
  const verifiedCount = team.filter((member) => String(member.photoVerificationStatus || '').toLowerCase() === 'verified').length;
  const pendingVerificationCount = team.filter((member) => String(member.photoVerificationStatus || '').toLowerCase() === 'pending').length;
  const confirmedPassCount = team.filter((member) => String(member.confirmationStatus || '').toLowerCase() === 'confirmed').length;

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-20">
        <section className="relative overflow-hidden rounded-3xl sm:rounded-[40px] p-6 sm:p-8 lg:p-12 bg-brand-dark text-white shadow-2xl">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-brand-main/20 rounded-full blur-[120px]"></div>
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="animate-fade-in">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-brand-main">Sponsor Portal</p>
              <h1 className="mt-4 text-3xl sm:text-4xl lg:text-6xl font-black tracking-tight leading-none">{pkg?.name || 'Sponsor Package'}</h1>
              <p className="mt-4 text-white/60 font-medium max-w-xl text-sm sm:text-base">{event?.name} · {event?.venue?.name}</p>
              <div className="mt-6 flex flex-wrap gap-4 text-xs sm:text-sm font-medium">
                <span className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 backdrop-blur-sm italic">
                  Premium Sponsor Pass Holder
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 lg:gap-6 animate-fade-in [animation-delay:200ms] w-full lg:w-auto">
               <div className="glass-dark border-white/5 px-5 py-4 sm:px-6 sm:py-5 rounded-3xl min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Pass Capacity</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-black text-brand-main">{teamCount} / {capacity}</p>
                  <p className="mt-1 text-[9px] sm:text-[10px] font-bold text-white/30 uppercase tracking-widest">Team Members</p>
               </div>
               <div className="glass-dark border-white/5 px-5 py-4 sm:px-6 sm:py-5 rounded-3xl min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Utilization</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-black text-brand-main">{utilization}%</p>
                  <p className="mt-1 text-[9px] sm:text-[10px] font-bold text-white/30 uppercase tracking-widest">{remainingSlots} Slots Left</p>
               </div>
            </div>
          </div>
        </section>

        {activeSection === 'overview' && (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader title="Overview Metrics" subtitle="Live sponsor package and pass-holder health." />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Verified Profiles</p>
                  <p className="mt-2 text-3xl font-black text-emerald-600">{verifiedCount}</p>
                  <p className="mt-1 text-xs text-slate-500">Completed identity verification</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Verification</p>
                  <p className="mt-2 text-3xl font-black text-amber-600">{pendingVerificationCount}</p>
                  <p className="mt-1 text-xs text-slate-500">Action needed by pass holders</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Confirmed Passes</p>
                  <p className="mt-2 text-3xl font-black text-blue-600">{confirmedPassCount}</p>
                  <p className="mt-1 text-xs text-slate-500">Ready for venue operations</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Capacity Remaining</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{remainingSlots}</p>
                  <p className="mt-1 text-xs text-slate-500">Available seats in your package</p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">Package usage</span>
                  <span className="font-bold text-slate-900">{teamCount} / {capacity}</span>
                </div>
                <div className="mt-3 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(utilization, 100)}%` }} />
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Package Snapshot" subtitle="Current event and package context." />
              <div className="space-y-4 text-sm">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Package Name</p>
                  <p className="mt-1 text-base font-bold text-slate-900">{pkg?.name || '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Event</p>
                  <p className="mt-1 text-base font-bold text-slate-900">{event?.name || '-'}</p>
                  <p className="mt-1 text-xs text-slate-500">{event?.venue?.name || '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Package Capacity</p>
                  <p className="mt-1 text-base font-bold text-slate-900">{capacity}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</p>
                  <p className="mt-1 text-slate-700">
                    {verifiedCount} verified, {pendingVerificationCount} pending, {confirmedPassCount} confirmed passes.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {(activeSection === 'overview' || activeSection === 'team') && (
          <Card>
            <CardHeader 
              title="Team Members" 
              subtitle="Manage your sponsor team. Members will receive an email to verify their identity and receive their pass."
              action={
                team.length < (pkg?.capacity || 0) && (
                  <Button onClick={() => setMemberModal(true)} icon={<PlusIcon className="w-4 h-4" />}>Add Member</Button>
                )
              }
            />
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Verification</Th>
                  <Th>Pass Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => (
                  <Tr key={member._id}>
                    <Td>
                      <div className="font-semibold">{member.fullName}</div>
                      <div className="text-xs text-slate-500">{member.email}</div>
                    </Td>
                    <Td>
                      <Badge color={member.photoVerificationStatus === 'verified' ? 'green' : (member.photoVerificationStatus === 'rejected' ? 'red' : 'amber')}>
                        {member.photoVerificationStatus || 'pending'}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge color={member.confirmationStatus === 'confirmed' ? 'green' : 'blue'}>
                        {member.confirmationStatus}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        {member.confirmationStatus === 'confirmed' && (
                          <button 
                            onClick={() => handleDownloadPass(member.qrToken || member.confirmationToken, member.fullName)}
                            className="text-blue-600 font-bold text-xs uppercase hover:underline"
                          >
                            Download Pass
                          </button>
                        )}
                        <button onClick={() => handleRemoveMember(member._id)} className="text-rose-600">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </Td>
                  </Tr>
                ))}
                {team.length === 0 && (
                  <tr><td colSpan="4" className="px-4 py-8 text-center text-sm text-slate-500">No team members added yet.</td></tr>
                )}
              </tbody>
            </Table>
          </Card>
        )}
      </div>

      <Modal open={memberModal} onClose={() => setMemberModal(false)} title="Add Team Member">
        <div className="space-y-4">
          <div className="rounded-xl bg-blue-50 p-4 border border-blue-100">
            <p className="text-xs text-blue-700">Add a member to your sponsor package. They will be invited to confirm their identity and photo for their entry pass.</p>
          </div>
          <label className="block text-sm font-medium text-slate-700">Full Name *</label>
          <input 
            value={memberForm.fullName} 
            onChange={(e) => setMemberForm(curr => ({ ...curr, fullName: e.target.value }))} 
            className="w-full rounded-xl border px-4 py-2" 
            placeholder="e.g. John Doe"
          />
          <label className="block text-sm font-medium text-slate-700">Email Address *</label>
          <input 
            value={memberForm.email} 
            onChange={(e) => setMemberForm(curr => ({ ...curr, email: e.target.value }))} 
            className="w-full rounded-xl border px-4 py-2" 
            placeholder="john@example.com"
          />
          <label className="block text-sm font-medium text-slate-700">Phone Number</label>
          <input 
            value={memberForm.phone} 
            onChange={(e) => setMemberForm(curr => ({ ...curr, phone: e.target.value }))} 
            className="w-full rounded-xl border px-4 py-2" 
            placeholder="+94 ..."
          />
          <Button className="w-full" onClick={handleAddMember}>Add & Invite</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default SponsorDashboard;
