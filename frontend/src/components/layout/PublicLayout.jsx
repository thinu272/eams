import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPathForRole } from '../../config/roleNavigation';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const PublicLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col w-full overflow-x-hidden max-w-full">
      <nav className="bg-brand-dark/95 backdrop-blur-md border-b border-white/5 sticky top-0 z-50 shadow-2xl shadow-brand-dark/20 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex items-center gap-3 group px-4 py-2 rounded-2xl hover:bg-white/5 transition-all duration-300">
              <div className="relative">
                <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain group-hover:rotate-12 transition-transform duration-500 drop-shadow-[0_0_15px_rgba(38,132,255,0.4)]" onError={(e) => e.target.style.display='none'} />
                <div className="absolute inset-0 bg-brand-main blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-black text-white text-2xl tracking-tighter group-hover:text-brand-main transition-colors flex items-center">
                  ENTRY<span className="text-brand-main">NEX</span>
                </span>
                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 group-hover:text-slate-400 transition-colors">
                  High Fidelity Access
                </span>
              </div>
            </Link>
            
            <div className="flex items-center gap-4">
              <Link to="/events" className="hidden sm:block text-sm font-bold text-slate-300 hover:text-white transition-colors">
                Upcoming Matches
              </Link>
              
              <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>

              <div className="hidden sm:flex items-center gap-6">
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

              {/* Mobile Menu Button */}
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="sm:hidden p-2 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors"
              >
                {isMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div className="sm:hidden border-t border-white/10 bg-brand-dark/95 backdrop-blur-xl animate-in slide-in-from-top duration-300">
            <div className="px-4 py-6 space-y-4">
              <Link 
                to="/events" 
                onClick={() => setIsMenuOpen(false)}
                className="block text-lg font-black uppercase tracking-widest text-slate-300 hover:text-white"
              >
                Upcoming Matches
              </Link>
              <div className="h-px bg-white/5 w-full" />
              {user ? (
                <div className="space-y-4">
                  <Link 
                    to={getDashboardPathForRole(user.role)} 
                    onClick={() => setIsMenuOpen(false)}
                    className="block text-lg font-black uppercase tracking-widest text-blue-400"
                  >
                    Dashboard
                  </Link>
                  <button 
                    onClick={() => { logout(); navigate('/'); setIsMenuOpen(false); }} 
                    className="block text-lg font-black uppercase tracking-widest text-slate-400 w-full text-left"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <Link 
                  to="/login" 
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full bg-brand-main text-white px-6 py-4 rounded-2xl text-center font-black uppercase tracking-widest shadow-lg shadow-brand-main/40"
                >
                  Partner Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
      
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      
      <footer className="bg-brand-dark border-t border-white/10 text-slate-400 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain opacity-80" onError={(e) => e.target.style.display='none'} />
              <div className="flex flex-col leading-none">
                <span className="font-black text-slate-200 text-lg tracking-tighter flex items-center">
                  ENTRY<span className="text-brand-main">NEX</span>
                </span>
                <span className="text-[6px] font-black uppercase tracking-[0.2em] text-slate-600">
                  Precision Registry
                </span>
              </div>
              <span className="h-4 w-px bg-slate-800 ml-2 hidden sm:block"></span>
              <span className="text-xs hidden sm:block text-slate-500 font-bold uppercase tracking-widest ml-2">Event Access Management</span>
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
