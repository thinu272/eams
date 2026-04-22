import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPathForRole } from '../../config/roleNavigation';

const PublicLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-slate-950 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 group-hover:scale-105 transition-transform">
                <span className="text-white text-xl font-black">E</span>
              </div>
              <span className="font-black text-white text-2xl tracking-tight group-hover:text-blue-400 transition-colors">EAMS</span>
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
                <Link to="/login" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/40">
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
      
      <footer className="bg-slate-950 border-t border-white/10 text-slate-400 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-300 text-lg tracking-tight">EAMS</span>
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
