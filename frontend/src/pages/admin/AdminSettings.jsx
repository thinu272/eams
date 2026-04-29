import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Card, { CardHeader } from '../../components/ui/Card';
import toast from 'react-hot-toast';
import { getAdminSettings, updateAdminSettings } from '../../api/admin';

const AdminSettings = () => {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAdminSettings()
      .then((response) => setSettings(response.data?.data?.settings || null))
      .catch(() => toast.error('Failed to load settings'));
  }, []);

  const updateField = (section, field, value) => {
    setSettings((current) => ({
      ...current,
      [section]: { ...current[section], [field]: value },
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await updateAdminSettings(settings);
      setSettings(response.data?.data?.settings || settings);
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">Loading settings...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-semibold">System Controls</p>
          <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
          <p className="text-sm text-slate-500">Persistent communication, retention, security, and template defaults for the ENTRYNEX admin layer.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader title="Communication Providers" subtitle="Operational sender defaults and provider visibility" />
            <div className="grid gap-4 lg:grid-cols-2">
              <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Sender email" value={settings.communication?.senderEmail || ''} onChange={(e) => updateField('communication', 'senderEmail', e.target.value)} />
              <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="SMS sender" value={settings.communication?.smsSender || ''} onChange={(e) => updateField('communication', 'smsSender', e.target.value)} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Email provider: {settings.communication?.emailProvider || 'smtp'}</div>
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">SMS provider: {settings.communication?.smsProvider || 'mock'}</div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Templates" subtitle="Default text for invite, confirmation, and rejection flows" />
            <div className="grid gap-4">
              <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Invite email subject" value={settings.templates?.invite?.subject || ''} onChange={(e) => setSettings((current) => ({ ...current, templates: { ...current.templates, invite: { ...current.templates.invite, subject: e.target.value } } }))} />
              <textarea className="rounded-xl border border-slate-200 px-4 py-3 text-sm" rows="3" placeholder="Confirmation SMS template" value={settings.templates?.confirmation?.sms || ''} onChange={(e) => setSettings((current) => ({ ...current, templates: { ...current.templates, confirmation: { ...current.templates.confirmation, sms: e.target.value } } }))} />
              <textarea className="rounded-xl border border-slate-200 px-4 py-3 text-sm" rows="3" placeholder="Rejection SMS template" value={settings.templates?.rejection?.sms || ''} onChange={(e) => setSettings((current) => ({ ...current, templates: { ...current.templates, rejection: { ...current.templates.rejection, sms: e.target.value } } }))} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Security and Retention" subtitle="Defaults for token lifespan, mode, and data retention" />
            <div className="grid gap-4 lg:grid-cols-3">
              <select className="rounded-xl border border-slate-200 px-4 py-3 text-sm" value={settings.security?.mode || 'strict'} onChange={(e) => updateField('security', 'mode', e.target.value)}>
                <option value="strict">Strict</option>
                <option value="balanced">Balanced</option>
                <option value="open">Open</option>
              </select>
              <input type="number" className="rounded-xl border border-slate-200 px-4 py-3 text-sm" value={settings.security?.jwtTtlHours || 24} onChange={(e) => updateField('security', 'jwtTtlHours', Number(e.target.value))} />
              <input type="number" className="rounded-xl border border-slate-200 px-4 py-3 text-sm" value={settings.retention?.logsDays || 365} onChange={(e) => updateField('retention', 'logsDays', Number(e.target.value))} />
            </div>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="bg-blue-600 hover:bg-blue-500">Save Settings</Button>
            <Button type="button" variant="outline" onClick={() => window.location.assign('/admin/dashboard?section=settings')}>Open Dashboard Settings</Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default AdminSettings;
