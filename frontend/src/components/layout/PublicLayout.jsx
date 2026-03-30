import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PublicLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dashboardPath = {
    main_admin: '/admin/dashboard', main_organiser: '/organiser/dashboard',
    sub_organiser: '/suborg/dashboard', staff: '/entry', volunteer: '/entry', auditor: '/auditor/dashboard',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">E</span>
              </div>
              <span className="font-bold text-gray-900 text-lg">EAMS</span>
            </Link>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link to={dashboardPath[user.role] || '/login'} className="text-sm font-medium text-blue-600 hover:text-blue-700">Dashboard</Link>
                  <button onClick={() => { logout(); navigate('/'); }} className="text-sm text-gray-500 hover:text-gray-700">Logout</button>
                </>
              ) : (
                <Link to="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Sign In</Link>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
      <footer className="bg-gray-900 text-gray-400 text-center py-8 text-sm mt-16">
        <p>&copy; {new Date().getFullYear()} EAMS — Event Access Management System</p>
      </footer>
    </div>
  );
};

export default PublicLayout;
