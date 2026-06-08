import React, { useEffect } from 'react';

const Modal = ({ open, onClose, title, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return undefined;

    const body = document.body;
    const lockCount = Number(body.dataset.modalLockCount || '0');
    body.dataset.modalLockCount = String(lockCount + 1);

    // Lock scroll once, even if multiple modals are opened.
    if (lockCount === 0) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      body.dataset.modalScrollY = String(scrollY);
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    }

    return () => {
      const nextCount = Math.max(Number(body.dataset.modalLockCount || '1') - 1, 0);
      body.dataset.modalLockCount = String(nextCount);

      if (nextCount === 0) {
        const scrollY = Number(body.dataset.modalScrollY || '0');
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.width = '';
        body.style.overflow = '';
        delete body.dataset.modalScrollY;
        window.scrollTo(0, scrollY);
      }
    };
  }, [open]);

  if (!open) return null;
  
  const sizes = { 
    sm: 'max-w-md', 
    md: 'max-w-lg', 
    lg: 'max-w-2xl', 
    xl: 'max-w-4xl' 
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      <div className="relative flex min-h-full items-center justify-center p-4 sm:p-6">
        {/* Modal Container */}
        <div className={`relative bg-white rounded-[28px] shadow-2xl w-full ${sizes[size]} animate-in fade-in zoom-in duration-200`}>
          
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
              <button 
                onClick={onClose} 
                className="p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          )}

          {/* Body */}
          <div className="p-8">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
