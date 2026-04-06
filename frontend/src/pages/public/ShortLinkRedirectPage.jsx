import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveShortLink } from '../../api/shortLinks';

const ShortLinkRedirectPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Resolving link...');

  useEffect(() => {
    resolveShortLink(code)
      .then((res) => {
        const targetPath = res.data?.data?.targetPath;
        if (targetPath) {
          navigate(targetPath, { replace: true });
        } else {
          setMessage('This short link is invalid.');
        }
      })
      .catch(() => setMessage('This short link is invalid or expired.'));
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm max-w-sm w-full text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
};

export default ShortLinkRedirectPage;
