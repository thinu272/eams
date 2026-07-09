import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { getSuperAdminSettings, updateSuperAdminSettings, uploadSystemAsset } from '../../api/superAdmin';
import Button from '../../components/ui/Button';
import Card, { CardHeader } from '../../components/ui/Card';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'branding', label: 'Branding' },
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'payment', label: 'Payments' },
  { id: 'security', label: 'Security' },
  { id: 'ticketing', label: 'Ticketing' },
  { id: 'regional', label: 'Regional' },
  { id: 'integrations', label: 'Integrations' },
];

const Field = ({ label, children }) => (
  <label className="space-y-2">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    {children}
  </label>
);

const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${props.className || ''}`}
  />
);

const Select = (props) => (
  <select
    {...props}
    className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${props.className || ''}`}
  />
);

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <div className="relative">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className={`block h-6 w-10 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-slate-200'}`}></div>
      <div className={`dot absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`}></div>
    </div>
    <span className="text-sm font-medium text-slate-700">{label}</span>
  </label>
);

const AdminSettingsPanel = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(null);
  const [initialSettings, setInitialSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await getSuperAdminSettings();
      const data = response.data?.data?.settings;
      if (data) {
        setSettings(data);
        setInitialSettings(JSON.stringify(data));
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = settings && initialSettings !== JSON.stringify(settings);

  const updateSetting = (section, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const updateNestedSetting = (section, parentKey, childKey, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [parentKey]: {
          ...prev[section][parentKey],
          [childKey]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      await updateSuperAdminSettings(settings);
      setInitialSettings(JSON.stringify(settings));
      toast.success('Settings updated successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (key, file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('photo', file);
      
      toast.loading('Uploading image...', { id: `upload-${key}` });
      const res = await uploadSystemAsset(formData);
      
      if (res.data?.success) {
        updateSetting('branding', key, res.data.data.url);
        toast.success('Image uploaded successfully', { id: `upload-${key}` });
      } else {
        toast.error('Failed to upload image', { id: `upload-${key}` });
      }
    } catch (error) {
      toast.error(`Upload failed: ${error.response?.data?.message || error.message}`, { id: `upload-${key}` });
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (!settings) return null;

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar Tabs */}
      <div className="md:w-64 flex-shrink-0">
        <Card padding={false} className="overflow-hidden">
          <div className="flex flex-col">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-4 text-left text-sm font-medium transition-colors border-l-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        <Card className="min-h-[500px]">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {TABS.find((t) => t.id === activeTab)?.label} Settings
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Manage global configuration for the ENTRYNEX platform.
              </p>
            </div>
            <Button onClick={handleSave} loading={saving} disabled={!hasChanges}>
              Save Changes
            </Button>
          </div>

          <div className="space-y-6 max-w-3xl">
            {activeTab === 'general' && (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Platform Name">
                    <Input value={settings.general?.platformName || ''} onChange={(e) => updateSetting('general', 'platformName', e.target.value)} />
                  </Field>
                  <Field label="Support Email">
                    <Input type="email" value={settings.general?.supportEmail || ''} onChange={(e) => updateSetting('general', 'supportEmail', e.target.value)} />
                  </Field>
                  <Field label="System Status">
                    <Select value={settings.general?.systemStatus || 'Active'} onChange={(e) => updateSetting('general', 'systemStatus', e.target.value)}>
                      <option value="Active">Active</option>
                      <option value="Maintenance">Maintenance Mode</option>
                    </Select>
                  </Field>
                </div>
              </>
            )}

            {activeTab === 'branding' && (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Logo">
                    <div className="flex gap-3">
                      <Input value={settings.branding?.logoUrl || ''} onChange={(e) => updateSetting('branding', 'logoUrl', e.target.value)} placeholder="https://..." />
                      <label className="flex-shrink-0 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl text-sm font-medium transition-colors border border-slate-200 flex items-center">
                        Upload
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload('logoUrl', e.target.files[0])} />
                      </label>
                    </div>
                  </Field>
                  <Field label="Favicon">
                    <div className="flex gap-3">
                      <Input value={settings.branding?.faviconUrl || ''} onChange={(e) => updateSetting('branding', 'faviconUrl', e.target.value)} placeholder="https://..." />
                      <label className="flex-shrink-0 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl text-sm font-medium transition-colors border border-slate-200 flex items-center">
                        Upload
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload('faviconUrl', e.target.files[0])} />
                      </label>
                    </div>
                  </Field>
                  <Field label="Primary Color">
                    <div className="flex gap-3">
                      <Input type="color" value={settings.branding?.primaryColor || '#2563eb'} onChange={(e) => updateSetting('branding', 'primaryColor', e.target.value)} className="w-16 h-12 p-1 cursor-pointer" />
                      <Input value={settings.branding?.primaryColor || '#2563eb'} onChange={(e) => updateSetting('branding', 'primaryColor', e.target.value)} />
                    </div>
                  </Field>
                  <Field label="Secondary Color">
                    <div className="flex gap-3">
                      <Input type="color" value={settings.branding?.secondaryColor || '#4f46e5'} onChange={(e) => updateSetting('branding', 'secondaryColor', e.target.value)} className="w-16 h-12 p-1 cursor-pointer" />
                      <Input value={settings.branding?.secondaryColor || '#4f46e5'} onChange={(e) => updateSetting('branding', 'secondaryColor', e.target.value)} />
                    </div>
                  </Field>
                </div>
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <Toggle label="Apply branding to Emails" checked={settings.branding?.applyToEmails} onChange={(v) => updateSetting('branding', 'applyToEmails', v)} />
                  <Toggle label="Apply branding to PDF Tickets" checked={settings.branding?.applyToTickets} onChange={(v) => updateSetting('branding', 'applyToTickets', v)} />
                  <Toggle label="Apply branding to UI" checked={settings.branding?.applyToUi} onChange={(v) => updateSetting('branding', 'applyToUi', v)} />
                </div>
              </>
            )}

            {activeTab === 'email' && (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Email Provider">
                    <Select value={settings.email?.provider || 'smtp'} onChange={(e) => updateSetting('email', 'provider', e.target.value)}>
                      <option value="smtp">Custom SMTP Server</option>
                      <option value="sendgrid">Twilio SendGrid</option>
                      <option value="mock">Mock Email (Console Logging)</option>
                    </Select>
                  </Field>
                  <Field label="Template Integration">
                    <Select value={settings.email?.templateMode || 'code'} onChange={(e) => updateSetting('email', 'templateMode', e.target.value)}>
                      <option value="code">Built-in (Code Based)</option>
                      <option value="sendgrid">SendGrid Dynamic Templates</option>
                    </Select>
                  </Field>
                  <Field label="Sender Name">
                    <Input value={settings.email?.senderName || ''} onChange={(e) => updateSetting('email', 'senderName', e.target.value)} placeholder="e.g., ENTRYNEX Events" />
                  </Field>
                </div>

                {settings.email?.provider === 'smtp' && (
                  <div className="grid gap-6 md:grid-cols-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <Field label="SMTP Host">
                      <Input value={settings.email?.smtpHost || ''} onChange={(e) => updateSetting('email', 'smtpHost', e.target.value)} placeholder="smtp.mailtrap.io" />
                    </Field>
                    <Field label="SMTP Port">
                      <Input type="number" value={settings.email?.smtpPort || 587} onChange={(e) => updateSetting('email', 'smtpPort', Number(e.target.value))} />
                    </Field>
                    <Field label="SMTP Username">
                      <Input value={settings.email?.smtpUser || ''} onChange={(e) => updateSetting('email', 'smtpUser', e.target.value)} />
                    </Field>
                    <Field label="SMTP Password">
                      <Input type="password" value={settings.email?.smtpPassword || ''} onChange={(e) => updateSetting('email', 'smtpPassword', e.target.value)} />
                    </Field>
                  </div>
                )}

                {settings.email?.provider === 'sendgrid' && (
                  <div className="grid gap-6 md:grid-cols-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <Field label="SendGrid API Key">
                      <Input type="password" value={settings.email?.sendgridApiKey || ''} onChange={(e) => updateSetting('email', 'sendgridApiKey', e.target.value)} placeholder="SG.xxxxxxx..." />
                    </Field>
                  </div>
                )}

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="font-semibold text-slate-900">Email Templates</h3>
                  
                  {settings.email?.templateMode === 'sendgrid' ? (
                    <div className="grid gap-4 md:grid-cols-2 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                      <Field label="Invitation Template ID">
                        <Input value={settings.email?.templateIds?.invite || ''} onChange={(e) => updateNestedSetting('email', 'templateIds', 'invite', e.target.value)} placeholder="d-xxxxxxxx" />
                      </Field>
                      <Field label="Ticket Template ID">
                        <Input value={settings.email?.templateIds?.ticket || ''} onChange={(e) => updateNestedSetting('email', 'templateIds', 'ticket', e.target.value)} placeholder="d-xxxxxxxx" />
                      </Field>
                      <Field label="Order Template ID">
                        <Input value={settings.email?.templateIds?.order || ''} onChange={(e) => updateNestedSetting('email', 'templateIds', 'order', e.target.value)} placeholder="d-xxxxxxxx" />
                      </Field>
                      <Field label="Password Reset Template ID">
                        <Input value={settings.email?.templateIds?.reset || ''} onChange={(e) => updateNestedSetting('email', 'templateIds', 'reset', e.target.value)} placeholder="d-xxxxxxxx" />
                      </Field>
                    </div>
                  ) : (
                    <>
                      <Field label="Invitation Email Subject">
                        <Input value={settings.email?.templates?.inviteSubject || ''} onChange={(e) => updateNestedSetting('email', 'templates', 'inviteSubject', e.target.value)} />
                      </Field>
                      <Field label="Ticket Email Subject">
                        <Input value={settings.email?.templates?.ticketSubject || ''} onChange={(e) => updateNestedSetting('email', 'templates', 'ticketSubject', e.target.value)} />
                      </Field>
                      <Field label="Password Reset Subject">
                        <Input value={settings.email?.templates?.resetSubject || ''} onChange={(e) => updateNestedSetting('email', 'templates', 'resetSubject', e.target.value)} />
                      </Field>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'sms' && (
              <div className="space-y-6">
                <Toggle label="Enable SMS Notifications" checked={settings.sms?.enabled} onChange={(v) => updateSetting('sms', 'enabled', v)} />
                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="SMS Provider">
                    <Select value={settings.sms?.provider || 'mock'} onChange={(e) => updateSetting('sms', 'provider', e.target.value)}>
                      <option value="mock">Mock SMS (Console Logging)</option>
                      <option value="twilio">Twilio</option>
                      <option value="localApi">Local API Gateway</option>
                    </Select>
                  </Field>
                </div>
                {settings.sms?.provider !== 'mock' && (
                  <div className="grid gap-6 md:grid-cols-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <Field label="API Key / SID">
                      <Input value={settings.sms?.apiKey || ''} onChange={(e) => updateSetting('sms', 'apiKey', e.target.value)} />
                    </Field>
                    <Field label="API Secret / Auth Token">
                      <Input type="password" value={settings.sms?.apiSecret || ''} onChange={(e) => updateSetting('sms', 'apiSecret', e.target.value)} />
                    </Field>
                  </div>
                )}
                
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="font-semibold text-slate-900">Custom SMS Templates</h3>
                  <Field label="Ticket Confirmation SMS">
                    <textarea 
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      rows="3"
                      value={settings.sms?.templates?.confirmation || ''} 
                      onChange={(e) => updateNestedSetting('sms', 'templates', 'confirmation', e.target.value)}
                      placeholder="Use {{eventName}}, {{attendeeName}} etc."
                    />
                  </Field>
                  <Field label="Verification Rejection SMS">
                    <textarea 
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      rows="3"
                      value={settings.sms?.templates?.rejection || ''} 
                      onChange={(e) => updateNestedSetting('sms', 'templates', 'rejection', e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            )}

            {activeTab === 'whatsapp' && (
              <div className="space-y-6">
                <Toggle label="Enable WhatsApp Notifications" checked={settings.whatsapp?.enabled} onChange={(v) => updateSetting('whatsapp', 'enabled', v)} />
                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="WhatsApp Provider">
                    <Select value={settings.whatsapp?.provider || 'none'} onChange={(e) => updateSetting('whatsapp', 'provider', e.target.value)}>
                      <option value="none">Disabled</option>
                      <option value="twilio">Twilio WhatsApp API</option>
                      <option value="meta">Meta Graph API (Direct)</option>
                    </Select>
                  </Field>
                </div>
                {settings.whatsapp?.provider !== 'none' && (
                  <div className="grid gap-6 md:grid-cols-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <Field label="API Key / Token">
                      <Input value={settings.whatsapp?.apiKey || ''} onChange={(e) => updateSetting('whatsapp', 'apiKey', e.target.value)} />
                    </Field>
                    <Field label="API Secret / App ID">
                      <Input type="password" value={settings.whatsapp?.apiSecret || ''} onChange={(e) => updateSetting('whatsapp', 'apiSecret', e.target.value)} />
                    </Field>
                  </div>
                )}
                
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="font-semibold text-slate-900">WhatsApp Templates</h3>
                  <Field label="Ticket Confirmation Message">
                    <textarea 
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      rows="3"
                      value={settings.whatsapp?.templates?.confirmation || ''} 
                      onChange={(e) => updateNestedSetting('whatsapp', 'templates', 'confirmation', e.target.value)}
                      placeholder="Use {{eventName}}, {{attendeeName}} etc."
                    />
                  </Field>
                </div>
              </div>
            )}

            {activeTab === 'payment' && (
              <div className="space-y-6">
                <Toggle label="Enable Payment Processing" checked={settings.payment?.enabled} onChange={(v) => updateSetting('payment', 'enabled', v)} />
                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Payment Gateway">
                    <Select value={settings.payment?.gateway || 'none'} onChange={(e) => updateSetting('payment', 'gateway', e.target.value)}>
                      <option value="none">None</option>
                      <option value="stripe">Stripe</option>
                      <option value="payhere">PayHere</option>
                    </Select>
                  </Field>
                  <Field label="Gateway Default Currency">
                    <Input value={settings.payment?.defaultCurrency || 'LKR'} onChange={(e) => updateSetting('payment', 'defaultCurrency', e.target.value)} />
                  </Field>
                </div>
                {settings.payment?.gateway !== 'none' && (
                  <div className="grid gap-6 md:grid-cols-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <Field label="Publishable Key / Merchant ID">
                      <Input value={settings.payment?.publishableKey || ''} onChange={(e) => updateSetting('payment', 'publishableKey', e.target.value)} />
                    </Field>
                    <Field label="Secret Key">
                      <Input type="password" value={settings.payment?.secretKey || ''} onChange={(e) => updateSetting('payment', 'secretKey', e.target.value)} />
                    </Field>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'security' && (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="JWT Expiration (Hours)">
                    <Input type="number" value={settings.security?.jwtTtlHours || 24} onChange={(e) => updateSetting('security', 'jwtTtlHours', Number(e.target.value))} />
                  </Field>
                  <Field label="Login Rate Limit (Attempts/15m)">
                    <Input type="number" value={settings.security?.loginRateLimit || 5} onChange={(e) => updateSetting('security', 'loginRateLimit', Number(e.target.value))} />
                  </Field>
                  <Field label="Minimum Password Length">
                    <Input type="number" value={settings.security?.minPasswordLength || 8} onChange={(e) => updateSetting('security', 'minPasswordLength', Number(e.target.value))} />
                  </Field>
                </div>
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <Toggle label="Require Password Complexity (Symbols/Numbers)" checked={settings.security?.requirePasswordComplexity} onChange={(v) => updateSetting('security', 'requirePasswordComplexity', v)} />
                  <Toggle label="Require Email Verification for New Users" checked={settings.security?.emailVerificationRequired} onChange={(v) => updateSetting('security', 'emailVerificationRequired', v)} />
                  <Toggle label="Enable Two-Factor Authentication (2FA)" checked={settings.security?.twoFactorEnabled} onChange={(v) => updateSetting('security', 'twoFactorEnabled', v)} />
                  <Toggle label="Limit to One Active Device per Account" checked={settings.security?.oneActiveDeviceLimit} onChange={(v) => updateSetting('security', 'oneActiveDeviceLimit', v)} />
                  <Toggle label="Require Admin Approval for New Devices" checked={settings.security?.deviceApprovalRequired} onChange={(v) => updateSetting('security', 'deviceApprovalRequired', v)} />
                </div>
              </>
            )}

            {activeTab === 'ticketing' && (
              <div className="space-y-6">
                <Toggle label="Enable QR Code Tickets" checked={settings.ticketing?.qrEnabled} onChange={(v) => updateSetting('ticketing', 'qrEnabled', v)} />
                <Toggle label="Enable PDF Ticket Downloads" checked={settings.ticketing?.pdfEnabled} onChange={(v) => updateSetting('ticketing', 'pdfEnabled', v)} />
                <Toggle label="Auto-send ticket email on order confirmation" checked={settings.ticketing?.autoSendOnConfirm} onChange={(v) => updateSetting('ticketing', 'autoSendOnConfirm', v)} />
                <Toggle label="Enable Access Code login for Attendees" checked={settings.ticketing?.accessCodeToggle} onChange={(v) => updateSetting('ticketing', 'accessCodeToggle', v)} />
              </div>
            )}

            {activeTab === 'regional' && (
              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Global Default Currency">
                  <Select value={settings.regional?.defaultCurrency || 'LKR'} onChange={(e) => updateSetting('regional', 'defaultCurrency', e.target.value)}>
                    <option value="LKR">LKR (Sri Lankan Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="GBP">GBP (British Pound)</option>
                    <option value="AUD">AUD (Australian Dollar)</option>
                    <option value="SGD">SGD (Singapore Dollar)</option>
                    <option value="INR">INR (Indian Rupee)</option>
                  </Select>
                </Field>
                <Field label="System Timezone">
                  <Select value={settings.regional?.timezone || 'Asia/Colombo'} onChange={(e) => updateSetting('regional', 'timezone', e.target.value)}>
                    <option value="Asia/Colombo">Asia/Colombo (LKT)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  </Select>
                </Field>
                <Field label="Date Format">
                  <Select value={settings.regional?.dateFormat || 'MM/DD/YYYY'} onChange={(e) => updateSetting('regional', 'dateFormat', e.target.value)}>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </Select>
                </Field>
                <div className="pt-8">
                  <Toggle label="Enable Multi-currency support" checked={settings.regional?.multiCurrency} onChange={(v) => updateSetting('regional', 'multiCurrency', v)} />
                </div>
              </div>
            )}

            {activeTab === 'integrations' && (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Image Storage Provider">
                    <Select value={settings.integrations?.storageProvider || 'local'} onChange={(e) => updateSetting('integrations', 'storageProvider', e.target.value)}>
                      <option value="local">Local Disk</option>
                      <option value="aws">AWS S3</option>
                      <option value="cloudinary">Cloudinary</option>
                    </Select>
                  </Field>
                </div>
                {settings.integrations?.storageProvider === 'aws' && (
                  <div className="grid gap-6 md:grid-cols-2 p-4 bg-slate-50 rounded-xl border border-slate-200 mt-4">
                    <Field label="AWS Access Key">
                      <Input value={settings.integrations?.awsAccessKey || ''} onChange={(e) => updateSetting('integrations', 'awsAccessKey', e.target.value)} />
                    </Field>
                    <Field label="AWS Secret Key">
                      <Input type="password" value={settings.integrations?.awsSecretKey || ''} onChange={(e) => updateSetting('integrations', 'awsSecretKey', e.target.value)} />
                    </Field>
                    <Field label="AWS Bucket Name">
                      <Input value={settings.integrations?.awsBucket || ''} onChange={(e) => updateSetting('integrations', 'awsBucket', e.target.value)} />
                    </Field>
                  </div>
                )}
                <div className="grid gap-6 md:grid-cols-2 mt-6">
                  <Field label="Google Maps API Key (Optional)">
                    <Input type="password" value={settings.integrations?.mapsApiKey || ''} onChange={(e) => updateSetting('integrations', 'mapsApiKey', e.target.value)} />
                  </Field>
                  <Field label="AI Face Validation API Key (Optional)">
                    <Input type="password" value={settings.integrations?.aiServiceKey || ''} onChange={(e) => updateSetting('integrations', 'aiServiceKey', e.target.value)} />
                  </Field>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettingsPanel;
