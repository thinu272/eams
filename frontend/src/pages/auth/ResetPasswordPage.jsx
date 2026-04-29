import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  LockClosedIcon, 
  ChevronRightIcon,
  BoltIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match.');
    }
    setLoading(true);
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/reset-password/${token}`, { password });
      if (response.data.success) {
        toast.success('Access Restored — Password Updated Successfully');
        navigate('/login');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Token invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 font-sans selection:bg-blue-500/30 flex items-center justify-center p-6 sm:p-12">
      {/* Premium Daylight Stadium Background */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1504450758481-7338eba7524a?q=80&w=2805&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.95) contrast(1.05)',
        }}
      >
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white/80" />
      </div>

      <div className="relative z-10 w-full max-w-[480px] animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
        {/* Branding Section */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-blue-500/10 mb-6 border border-blue-500/20 shadow-sm backdrop-blur-md">
             <BoltIcon className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-2">
             Security <span className="text-blue-600">Override</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">
            Cryptographic Key Regeneration
          </p>
        </div>

        {/* Card */}
        <div className="group relative rounded-[2.5rem] border border-white/60 bg-white/80 p-10 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] transition-all duration-500 hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          
          <form onSubmit={handleSubmit} className="space-y-7">
            <p className="text-sm font-semibold text-slate-600 leading-relaxed text-center px-4">
              Enter your new cryptographic access key below to finalize the restoration process.
            </p>

            {/* New Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">New Access Key</label>
              <div className="relative group/field">
                <LockClosedIcon className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within/field:text-blue-600 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Confirm Access Key</label>
              <div className="relative group/field">
                <LockClosedIcon className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within/field:text-blue-600 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-5 pl-14 pr-6 text-sm font-semibold text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-2xl bg-blue-600 py-5 text-[11px] font-black uppercase tracking-[0.3em] text-white shadow-[0_10px_25px_-5px_rgba(37,99,235,0.3)] transition-all duration-300 hover:bg-blue-500 hover:shadow-[0_15px_30px_-5px_rgba(37,99,235,0.4)] disabled:opacity-50 active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
              
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
                  Updating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Finalize Overwrite
                  <ChevronRightIcon className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-10 flex items-center gap-5">
             <div className="h-[1px] flex-1 bg-slate-200" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Validation</span>
             <div className="h-[1px] flex-1 bg-slate-200" />
          </div>

          <div className="mt-8 text-center">
            <Link to="/login" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors">
              Abort and Return to Gateway
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
