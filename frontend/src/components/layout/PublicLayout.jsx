import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPathForRole } from '../../config/roleNavigation';

const PublicLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-brand-dark border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain group-hover:scale-105 transition-transform" onError={(e) => e.target.style.display='none'} />
              <span className="font-black text-white text-2xl tracking-tight group-hover:text-brand-main transition-colors">ENTRYNEX</span>
            </Link>
            
            <div className="flex items-center gap-6">
              <Link to="/events" className="hidden sm:block text-sm font-bold text-slate-300 hover:text-white transition-colors">
                Upcoming Matches
              </Link>
              
              <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>

              {user ? (
                <div className="flex items-center gap-4">
                  <Link to={getDashboardPathForRole(user.role)} className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors">
                    Dashboard
                  </Link>
                  <button onClick={() => { logout(); navigate('/'); }} className="text-sm font-bold text-slate-400 hover:text-slate-200 transition-colors">
                    Logout
                  </button>
                </div>
              ) : (
                <Link to="/login" className="bg-brand-main text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-accent transition-colors shadow-lg shadow-brand-main/40">
                  Partner Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>
      
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      
      <footer className="bg-brand-dark border-t border-white/10 text-slate-400 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" onError={(e) => e.target.style.display='none'} />
              <span className="font-black text-slate-300 text-lg tracking-tight">ENTRYNEX</span>
              <span className="text-sm">| Event Access Management System</span>
            </div>
            <div className="text-sm font-medium">
              &copy; {new Date().getFullYear()} All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
