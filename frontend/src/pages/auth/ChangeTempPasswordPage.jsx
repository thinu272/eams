import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { getApiBase } from '../../utils/backend';
import toast from 'react-hot-toast';
import { 
  LockClosedIcon, 
  ChevronRightIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

const ChangeTempPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Extract tempToken from location state
  const tempToken = location.state?.tempToken;

  useEffect(() => {
    if (!tempToken) {
      toast.error('Session expired. Please log in again.');
      navigate('/login');
    }
  }, [tempToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      return toast.error('Password must be at least 8 characters long.');
    }
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match.');
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${getApiBase()}/auth/change-temp-password`, { 
        tempToken, 
        newPassword: password 
      });
      
      if (response.data.success) {
        toast.success('Security Update Complete | You can now log in');
        navigate('/login');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!tempToken) return null;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 font-sans selection:bg-blue-500/30 flex items-center justify-center p-6 sm:p-12">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/30" />
      
      <div className="relative z-10 w-full max-w-[480px] animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-blue-600/10 mb-6 border border-blue-600/20 shadow-sm backdrop-blur-md">
             <KeyIcon className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-2">
             Security <span className="text-blue-600">Update</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">
            Mandatory Access Key Rotation
          </p>
        </div>

        <div className="group relative rounded-[2.5rem] border border-white/60 bg-white/80 p-10 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] transition-all duration-500 hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          
          <form onSubmit={handleSubmit} className="space-y-7">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-blue-50/50 border border-blue-100 mb-2">
              <ShieldCheckIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] font-semibold text-blue-900 leading-relaxed">
                You are currently using a temporary access key. For your security, you must define a new permanent password before proceeding.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">New Permanent Key</label>
              <div className="relative group/field">
                <LockClosedIcon className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within/field:text-blue-600 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Confirm New Key</label>
              <div className="relative group/field">
                <LockClosedIcon className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within/field:text-blue-600 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
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
                  Updating Security...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Update and Login
                  <ChevronRightIcon className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link to="/login" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors">
              Return to Gateway
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangeTempPasswordPage;
