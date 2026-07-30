import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPathForRole } from '../../config/roleNavigation';
import api from '../../api/client';
import toast from 'react-hot-toast';
import {
  EnvelopeIcon,
  ArrowRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const SignupSuccessPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user?.role) {
      navigate(getDashboardPathForRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  const handleResendVerification = async () => {
    const email = prompt('Please enter your email to resend verification:');
    if (!email) return;
    try {
      await api.post('/auth/resend-verification', { email });
      toast.success('Verification email resent successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend verification email');
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
            System Authority Initialized
          </p>
        </div>

        {/* Success Card */}
        <div className="group relative rounded-[2.5rem] border border-white/60 bg-white/80 p-10 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] transition-all duration-500 hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.12)]">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-main/20 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-brand-main p-4 rounded-full">
                <EnvelopeIcon className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>

          {/* Success Message */}
          <div className="text-center space-y-4 mb-8">
            <h2 className="text-2xl font-black text-slate-900">
              Account Created Successfully
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We've sent a verification email to your registered email address.
            </p>
            <p className="text-sm font-semibold text-slate-700">
              Please verify your email before logging in.
            </p>
            <p className="text-xs text-slate-500">
              If you don't see the email, please check your Spam/Junk folder.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={handleResendVerification}
              className="group relative w-full overflow-hidden rounded-2xl bg-brand-main py-4 text-[11px] font-black uppercase tracking-[0.3em] text-white shadow-[0_10px_25px_-5px_rgba(38,132,255,0.3)] transition-all duration-300 hover:bg-brand-dark hover:shadow-[0_15px_30px_-5px_rgba(10,17,40,0.4)] active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
              <span className="flex items-center justify-center gap-2">
                <ArrowPathIcon className="h-4 w-4" />
                Resend Verification Email
              </span>
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-main transition-colors duration-200"
              >
                Already verified?
                <span className="text-brand-main font-bold">Back to Login</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center opacity-30">
           <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 italic">ENTRYNEX Elite Network Authorized Personnel Only</span>
        </div>
      </div>
    </div>
  );
};

export default SignupSuccessPage;
