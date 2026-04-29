import React from 'react';
import PublicLayout from '../../components/layout/PublicLayout';

const MaintenancePage = () => {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
        <div className="flex justify-center mb-8">
          <div className="h-20 w-20 rounded-3xl bg-amber-100 flex items-center justify-center">
            <svg className="h-10 w-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
        </div>
        <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-600">
          System Update
        </p>
        <h1 className="mt-6 text-5xl font-black text-slate-950 uppercase tracking-tight">Scheduled Maintenance</h1>
        <p className="mt-6 text-lg text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
          The ENTRYNEX platform is currently undergoing scheduled maintenance or system updates. <br />         We'll be back online shortly to serve you better.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="px-6 py-3 rounded-2xl bg-slate-100 border border-slate-200 flex items-center gap-3">
             <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
             <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">Status: Undergoing Updates</span>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default MaintenancePage;
