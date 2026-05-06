import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { getDashboardPathForRole } from '../../config/roleNavigation';
import { 
  LockClosedIcon, 
  EnvelopeIcon, 
  EyeIcon, 
  EyeSlashIcon,
  ChevronRightIcon,
  BoltIcon
} from '@heroicons/react/24/outline';


const LoginPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', mfaToken: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);

  useEffect(() => {
    if (user?.role) {
      navigate(getDashboardPathForRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  const getLoginErrorMessage = (error) => {
    if (error.response?.data?.message) return error.response.data.message;
    if (Array.isArray(error.response?.data?.errors) && error.response.data.errors.length > 0) {
      return error.response.data.errors[0]?.msg || 'Unable to sign in.';
    }
    if (!error.response) return 'Unable to reach the server. Please try again.';
    return 'Unable to sign in right now.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(form.email, form.password, form.mfaToken);
      if (result?.requireMfa) {
        setMfaStep(true);
        toast('MFA Required | Check your authenticator app');
        return;
      }
      if (result?.requirePasswordChange) {
        toast(result.message || 'Security update required');
        navigate('/change-password', { state: { tempToken: result.tempToken } });
        return;
      }
      toast.success(`Access Granted | Welcome, ${result.name}`);
      navigate(getDashboardPathForRole(result.role));
    } catch (err) {
      toast.error(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 font-sans selection:bg-blue-500/30 flex items-center justify-center p-6 sm:p-12">
      {/* Premium Gradient Background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/30" />

      {/* Soft Daylight Glows */}
      <div className="absolute top-0 right-1/4 h-[600px] w-[600px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 h-[600px] w-[600px] rounded-full bg-sky-500/5 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[480px] animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
        {/* Branding Section */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-brand-main/10 mb-6 border border-brand-main/20 shadow-sm backdrop-blur-md">
             <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" onError={(e) => e.target.style.display='none'} />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-2">
             Secure <span className="text-brand-main">Gateway</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">
            Precision Access Management
          </p>
        </div>

        {/* Login Card (Light Glass) */}
        <div className="group relative rounded-[2.5rem] border border-white/60 bg-white/80 p-10 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] transition-all duration-500 hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          
          <form onSubmit={handleSubmit} className="space-y-7">
            {!mfaStep ? (
              <>
                {/* Identity Email */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Verification Email</label>
                  <div className="relative group/field">
                    <EnvelopeIcon className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within/field:text-blue-600 transition-colors" />
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm(f => ({...f, email: e.target.value}))}
                      placeholder="identity@stadium.entrynex.com"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-5 pl-14 pr-6 text-sm font-semibold text-slate-900 placeholder-slate-400 transition-all focus:border-brand-main/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-main/50 shadow-sm"
                    />
                  </div>
                </div>

                {/* Access Key */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Access Key</label>
                     <Link to="/forgot-password" core="true" className="text-[10px] font-bold text-blue-600 hover:text-blue-500 transition-colors uppercase tracking-[0.2em] underline-offset-4 hover:underline">
                       Lost Key?
                     </Link>
                  </div>
                  <div className="relative group/field">
                    <LockClosedIcon className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within/field:text-blue-600 transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={e => setForm(f => ({...f, password: e.target.value}))}
                      placeholder="••••••••••••"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-5 pl-14 pr-14 text-sm font-semibold text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-1">MFA Security Token</label>
                <div className="relative group/field">
                  <BoltIcon className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-600 transition-colors" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={form.mfaToken}
                    onChange={e => setForm(f => ({...f, mfaToken: e.target.value}))}
                    placeholder="Enter 6-digit code"
                    className="w-full rounded-2xl border border-blue-200 bg-blue-50/30 py-5 pl-14 pr-6 text-sm font-semibold text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-sm"
                  />
                </div>
                <button type="button" onClick={() => setMfaStep(false)} className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 hover:text-slate-600 transition-colors">
                  ← Back to Credentials
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-2xl bg-brand-dark py-5 text-[11px] font-black uppercase tracking-[0.3em] text-white shadow-[0_10px_25px_-5px_rgba(10,17,40,0.3)] transition-all duration-300 hover:bg-brand-main hover:shadow-[0_15px_30px_-5px_rgba(38,132,255,0.4)] disabled:opacity-50 active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
              
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {mfaStep ? 'Verify Security Token' : 'Initiate Secure Access'}
                  <ChevronRightIcon className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-10 flex items-center gap-5">
             <div className="h-[1px] flex-1 bg-slate-200" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Operations</span>
             <div className="h-[1px] flex-1 bg-slate-200" />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 text-center">
            <Link to="/signup" className="group p-5 rounded-2xl border border-slate-100 bg-slate-50/50 transition-all hover:bg-white hover:border-blue-500/20 hover:shadow-md">
               <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-1">Recruit Attendee</span>
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Join the high-fidelity ecosystem</span>
            </Link>
            
            <Link to="/" className="group p-5 rounded-2xl border border-slate-100 bg-slate-50/50 transition-all hover:bg-white hover:border-amber-500/20 hover:shadow-md">
               <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 mb-1">Public Terminal</span>
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Access as unregistered guest</span>
            </Link>
          </div>

          {/* Quick Access Lab Dropdown */}
          <div className="mt-6 border-t border-slate-100 pt-6">
            <details className="group/details">
              <summary className="flex items-center justify-center gap-2 cursor-pointer list-none text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-blue-600 transition-colors">
                <span className="bg-blue-500/10 px-2 py-0.5 rounded text-blue-600">Lab Access</span>
                View System Credentials
              </summary>
              <div className="mt-4 grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2">
                {[
                  { r: 'Admin', e: 'admin@stadium.entrynex.com', p: 'Admin@Matrix.Reset' },
                  { r: 'Organiser', e: 'organiser@stadium.entrynex.com', p: 'Organiser@Matrix.Reset' },
                  { r: 'Sub-Org', e: 'suborg@stadium.entrynex.com', p: 'SubOrg@Matrix.Reset' },
                  { r: 'Staff', e: 'staff@stadium.entrynex.com', p: 'Staff@Matrix.Reset' },
                  { r: 'Auditor', e: 'auditor@stadium.entrynex.com', p: 'Auditor@Matrix.Reset' },
                  { r: 'Attendee', e: 'attendee@stadium.entrynex.com', p: 'Attendee@Matrix.Reset' },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col p-3 rounded-xl bg-slate-50 border border-slate-100 text-[9px] font-bold tracking-wider">
                    <span className="text-blue-600 uppercase mb-1">{item.r} Identity</span>
                    <div className="flex justify-between text-slate-600">
                       <span>{item.e}</span>
                       <span className="text-slate-300">/</span>
                       <span>{item.p}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>

        {/* Footer Status */}
         <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-4 bg-white/60 px-6 py-2.5 rounded-full border border-white shadow-sm backdrop-blur-md">
             <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
               Network Status: <span className="text-blue-600/80">Secured</span>
             </p>
          </div>
        </div>
      </div>

      {/* Modern Branding Bar */}
      <div className="absolute bottom-10 inset-x-12 hidden lg:flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3">
           <div className="h-0.5 w-12 bg-blue-500 rounded-full shadow-sm" />
           <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">
             Elite Registry Protocol
           </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-300">
           © 2026 ENTRYNEX High Fidelity System
        </span>
      </div>
    </div>
  );
};

export default LoginPage;
