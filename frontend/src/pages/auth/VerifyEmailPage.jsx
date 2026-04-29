import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/client';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const VerifyEmailPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await api.get(`/auth/verify-email/${token}`);
        if (response.data.success) {
          setStatus('success');
          setMessage(response.data.message);
          toast.success('Email verified! You can now log in.');
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Verification failed.');
        }
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'The verification link is invalid or has expired.');
      }
    };

    if (token) {
      verifyEmail();
    }
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-white p-10 shadow-2xl ring-1 ring-slate-200">
        <div className="text-center">
          {status === 'verifying' && (
            <>
              <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              <h2 className="mt-6 text-3xl font-extrabold text-slate-900">Verifying Email...</h2>
              <p className="mt-2 text-sm text-slate-600">Please wait while we confirm your account.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircleIcon className="mx-auto h-20 w-20 text-green-500" />
              <h2 className="mt-6 text-3xl font-extrabold text-slate-900">Email Verified!</h2>
              <p className="mt-2 text-sm text-slate-600">{message}</p>
              <div className="mt-8">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-500/25 active:scale-95"
                >
                  Go to Login
                </Link>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircleIcon className="mx-auto h-20 w-20 text-red-500" />
              <h2 className="mt-6 text-3xl font-extrabold text-slate-900">Verification Failed</h2>
              <p className="mt-2 text-sm text-slate-600">{message}</p>
              <div className="mt-8 space-y-4">
                <Link
                  to="/signup"
                  className="block w-full rounded-2xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95"
                >
                  Back to Signup
                </Link>
                <Link
                  to="/login"
                  className="block w-full text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  Try Logging In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
