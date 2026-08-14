import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPathForRole } from '../../config/roleNavigation';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const PublicLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    closeMenu();
  };

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-slate-50">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between sm:h-18 lg:h-20">
            {/* Brand */}
            <Link
              to="/"
              className="flex items-center gap-2.5 transition hover:opacity-90"
              onClick={closeMenu}
            >
              <img
                src="/logo.png"
                alt="Entrynex"
                className="h-9 w-9 object-contain sm:h-10 sm:w-10"
              />
              <span className="text-lg font-bold tracking-tight text-white sm:text-xl">
                ENTRY<span className="text-blue-400">NEX</span>
              </span>
            </Link>

            {/* Desktop links */}
            <div className="hidden items-center gap-5 sm:flex">
              <Link
                to="/events"
                className="text-sm font-semibold text-slate-300 transition hover:text-white"
              >
                Upcoming Events
              </Link>

              <div className="h-5 w-px bg-slate-700" />

              {user ? (
                <div className="flex items-center gap-4">
                  <Link
                    to={getDashboardPathForRole(user.role)}
                    className="text-sm font-semibold text-blue-400 transition hover:text-blue-300"
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-sm font-semibold text-slate-400 transition hover:text-slate-200"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
                >
                  Partner Sign In
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setIsMenuOpen((v) => !v)}
              className="rounded-xl bg-white/5 p-2 text-white transition hover:bg-white/10 sm:hidden"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="border-t border-white/10 bg-slate-950/98 backdrop-blur-xl sm:hidden">
            <div className="space-y-1 px-4 py-4">
              <Link
                to="/events"
                onClick={closeMenu}
                className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                Upcoming Events
              </Link>

              <div className="my-2 h-px bg-white/10" />

              {user ? (
                <>
                  <Link
                    to={getDashboardPathForRole(user.role)}
                    onClick={closeMenu}
                    className="block rounded-xl px-3 py-3 text-sm font-semibold text-blue-400 transition hover:bg-white/5"
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="mt-2 block w-full rounded-xl bg-blue-600 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
                >
                  Partner Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Content */}
      <main className="flex flex-1 flex-col">{children}</main>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950 text-slate-400">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
              <div className="flex items-center gap-2.5">
                <img
                  src="/logo.png"
                  alt="Entrynex"
                  className="h-8 w-8 object-contain opacity-80"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="leading-tight">
                  <span className="text-base font-bold tracking-tight text-slate-200">
                    ENTRY<span className="text-blue-400">NEX</span>
                  </span>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Event Access Management
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Entrynex. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;