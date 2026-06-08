import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { getApiBase } from '../../utils/backend';
import toast from 'react-hot-toast';
import { 
  EnvelopeIcon, 
  ChevronRightIcon,
  BoltIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${getApiBase()}/auth/forgot-password`, { email });
      if (response.data.success) {
        toast.success('Reset link dispatched to your email.');
        setSubmitted(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to process request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 font-sans selection:bg-blue-500/30 flex items-center justify-center p-6 sm:p-12">
      {/* Premium Gradient Background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/30" />

      <div className="relative z-10 w-full max-w-[480px] animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
        {/* Branding Section */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-blue-500/10 mb-6 border border-blue-500/20 shadow-sm backdrop-blur-md">
             <BoltIcon className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-2">
             Access <span className="text-blue-600">Recovery</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">
            Identity Restoration Protocol
          </p>
        </div>

        {/* Card */}
        <div className="group relative rounded-[2.5rem] border border-white/60 bg-white/80 p-10 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] transition-all duration-500 hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-7">
              <p className="text-sm font-semibold text-slate-600 leading-relaxed text-center px-4">
                Enter your verified email address to receive a secure access restoration link.
              </p>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Verification Email</label>
                <div className="relative group/field">
                  <EnvelopeIcon className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within/field:text-blue-600 transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="identity@stadium.entrynex.com"
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
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Send Restoration Link
                    <ChevronRightIcon className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
                  </span>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-6 py-4">
              <div className="mx-auto h-16 w-16 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
                <EnvelopeIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Link Dispatched</h3>
                <p className="text-sm font-semibold text-slate-500 leading-relaxed">
                  A secure access link has been sent to <span className="text-blue-600">{email}</span>. Please check your inbox and spam folder.
                </p>
              </div>
              <button 
                onClick={() => setSubmitted(false)}
                className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-500 transition-colors"
              >
                Use different email
              </button>
            </div>
          )}

          <div className="mt-10 flex items-center gap-5">
             <div className="h-[1px] flex-1 bg-slate-200" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Navigation</span>
             <div className="h-[1px] flex-1 bg-slate-200" />
          </div>

          <div className="mt-8 text-center">
            <Link to="/login" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors">
              <ArrowLeftIcon className="h-3 w-3" />
              Return to Gateway
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
