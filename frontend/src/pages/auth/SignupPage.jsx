import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { getDashboardPathForRole } from '../../config/roleNavigation';
import { 
  UserIcon,
  EnvelopeIcon, 
  PhoneIcon,
  LockClosedIcon,
  UserPlusIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

const SignupPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    password: '', 
    confirmPassword: '',
    role: 'Attendee' 
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role) {
      navigate(getDashboardPathForRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Security codes do not match');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: form.role
      });

      navigate('/signup-success');
    } catch (err) {
      const message = err.response?.data?.message || 'Authorization matrix conflict';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 font-sans selection:bg-blue-500/30 flex items-center justify-center p-6 sm:p-12">
      {/* Premium Gradient Background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/30" />

      <div className="relative z-10 w-full max-w-[540px] animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
        {/* Branding Section */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-brand-main/10 mb-6 border border-brand-main/20 shadow-sm backdrop-blur-md">
             <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" onError={(e) => e.target.style.display='none'} />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-2">
             Elite <span className="text-brand-main">Recruitment</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">
            Initialize System Authority
          </p>
        </div>

        {/* Signup Card (Light Glass) */}
        <div className="group relative rounded-[2.5rem] border border-white/60 bg-white/80 p-10 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] transition-all duration-500 hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identity Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Identity Name</label>
              <div className="relative group/field">
                <UserIcon className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within/field:text-blue-600 transition-colors" />
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex. Adrian Perera"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-4 pl-14 pr-6 text-sm font-semibold text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">E-Mail</label>
                <div className="relative group/field">
                  <EnvelopeIcon className="absolute left-5 top-1/2 h-5 w-4 -translate-y-1/2 text-slate-400 group-focus-within/field:text-blue-600 transition-colors" />
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="name@agency.com"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-4 pl-14 pr-5 text-sm font-semibold text-slate-900 placeholder:text-sm placeholder:font-medium placeholder:text-slate-400 transition-all focus:border-blue-500/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-sm"
                  />
                </div>
              </div>

              {/* Mobile */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Mobile Access</label>
                <div className="relative group/field">
                  <PhoneIcon className="absolute left-5 top-1/2 h-5 w-4 -translate-y-1/2 text-slate-400 group-focus-within/field:text-blue-600 transition-colors" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+1234567890"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-4 pl-14 pr-5 text-sm font-semibold text-slate-900 placeholder:text-sm placeholder:font-medium placeholder:text-slate-400 transition-all focus:border-blue-500/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Security Code</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 char"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-4 px-6 text-xs font-semibold text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Confirm Code</label>
                <input
                  type="password"
                  required
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Repeat code"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-4 px-6 text-xs font-semibold text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-sm"
                />
              </div>
            </div>

            {/* Public Registration Info */}
            <div className="pt-2 text-center">
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] italic">
                 Standard Attendee Operational Level
               </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-2xl bg-brand-dark py-5 text-[11px] font-black uppercase tracking-[0.3em] text-white shadow-[0_10px_25px_-5px_rgba(10,17,40,0.3)] transition-all duration-300 hover:bg-brand-main hover:shadow-[0_15px_30px_-5px_rgba(38,132,255,0.4)] disabled:opacity-50 active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
              
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
                  Initialising Profile...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Initialize Authority
                  <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Already cleared?{' '}
            <Link to="/login" className="text-brand-main hover:text-brand-accent transition-colors font-black">
              Access Portal
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center opacity-30">
           <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 italic">ENTRYNEX Elite Network Authorized Personnel Only</span>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
