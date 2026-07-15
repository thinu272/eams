import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getMfaStatus, setupMfa, verifyMfa, disableMfa } from '../../api/users';

const MfaSetupPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mfaStatus, setMfaStatus] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  // Fetch MFA status on load
  useEffect(() => {
    fetchMfaStatus();
  }, []);

  const fetchMfaStatus = async () => {
    try {
      const response = await getMfaStatus();
      setMfaStatus(response.data?.data);
    } catch (err) {
      toast.error('Failed to fetch MFA status');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupMfa = async () => {
    setLoading(true);
    try {
      const response = await setupMfa();
      const data = response.data?.data;
      setSetupData(data);
      setShowQrCode(true);
      toast.success('MFA setup initiated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setVerifying(true);
    try {
      await verifyMfa(verificationCode);
      toast.success('Two-factor authentication enabled!');
      fetchMfaStatus();
      setSetupData(null);
      setVerificationCode('');
      setShowQrCode(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setVerifying(false);
    }
  };

  const handleCancelSetup = () => {
    setSetupData(null);
    setVerificationCode('');
    setShowQrCode(false);
  };

  const handleDisableMfa = async () => {
    if (!window.confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return;
    }

    setDisabling(true);
    try {
      await disableMfa();
      toast.success('Two-factor authentication disabled');
      fetchMfaStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disable MFA');
    } finally {
      setDisabling(false);
    }
  };

  // Generate QR code URL (using a simple placeholder - in production use a QR library)
  const getQrCodeUrl = () => {
    if (!setupData?.qrCodeUrl) return null;
    // Return the otpauth URL as a QR code image using a public QR API
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qrCodeUrl)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Two-Factor Authentication</h1>
          <p className="mt-2 text-slate-600">
            {mfaStatus?.enabled 
              ? 'Manage your two-factor authentication settings' 
              : 'Add an extra layer of security to your account'}
          </p>
        </div>

        {/* MFA Already Enabled */}
        {mfaStatus?.enabled && !setupData && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Two-Factor Authentication is Enabled</h2>
              <p className="text-slate-600 mb-6">
                Your account is protected with an extra layer of security. You'll need to enter a verification code from your authenticator app when signing in.
              </p>

              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Recovery Codes</h3>
                <p className="text-xs text-slate-500 mb-3">
                  Save these recovery codes in a safe place. You can use them to access your account if you lose your authenticator device.
                </p>
                {mfaStatus.recoveryCodes ? (
                  <div className="bg-white rounded-lg p-3 border border-slate-200 font-mono text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      {mfaStatus.recoveryCodes.map((code, index) => (
                        <span key={index} className="text-slate-700">{code}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-amber-600">Recovery codes not available</p>
                )}
              </div>

              <button
                onClick={handleDisableMfa}
                disabled={disabling}
                className="px-6 py-2.5 text-red-600 border border-red-300 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {disabling ? 'Disabling...' : 'Disable Two-Factor Authentication'}
              </button>
            </div>
          </div>
        )}

        {/* Setup Flow */}
        {setupData && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            {/* Step 1: Scan QR Code */}
            {showQrCode && (
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Setup Authenticator App</h2>
                
                <div className="bg-white rounded-xl p-4 border border-slate-200 inline-block mb-4">
                  <img 
                    src={getQrCodeUrl()} 
                    alt="QR Code" 
                    className="w-48 h-48 mx-auto"
                  />
                </div>

                <div className="text-left bg-slate-50 rounded-xl p-4 mb-4">
                  <p className="text-sm text-slate-600 mb-2">
                    <strong>Can't scan the QR code?</strong>
                  </p>
                  <p className="text-xs text-slate-500 break-all font-mono">
                    {setupData.qrCodeUrl}
                  </p>
                </div>

                <button
                  onClick={() => setShowQrCode(false)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Enter code manually instead →
                </button>
              </div>
            )}

            {/* Step 2: Manual Entry */}
            {!showQrCode && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-slate-900 mb-4">Manual Entry</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Account:</span>
                    <span className="text-slate-700 font-mono">{setupData.accountName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Key:</span>
                    <span className="text-slate-700 font-mono">{setupData.secret}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Time Based:</span>
                    <span className="text-slate-700">Yes</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowQrCode(true)}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-700"
                >
                  ← Show QR Code
                </button>
              </div>
            )}

            {/* Step 3: Verification */}
            <form onSubmit={handleVerifyMfa}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelSetup}
                  className="flex-1 py-3 px-4 text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying || verificationCode.length !== 6}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifying ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Not Enabled - Show Setup Button */}
        {!mfaStatus?.enabled && !setupData && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Enable Two-Factor Authentication</h2>
              <p className="text-slate-600 mb-6">
                Two-factor authentication adds an extra layer of security to your account. Even if someone discovers your password, they won't be able to access your account without the verification code from your authenticator app.
              </p>

              <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
                <h3 className="text-sm font-medium text-slate-700 mb-3">What you'll need:</h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    An authenticator app (Google Authenticator, Authy, 1Password, etc.)
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    A smartphone or device to scan QR codes
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Recovery codes (we'll provide these after setup)
                  </li>
                </ul>
              </div>

              <button
                onClick={handleSetupMfa}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Set Up Two-Factor Authentication
              </button>
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link to="/dashboard" className="text-sm text-slate-600 hover:text-blue-600 flex items-center justify-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MfaSetupPage;