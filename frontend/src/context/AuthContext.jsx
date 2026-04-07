import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { getCanonicalRole, hasAnyRole } from '../utils/rbac';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('eams_token');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser({
        ...data.data.user,
        rbacRole: getCanonicalRole(data.data.user?.role),
      });
    } catch {
      localStorage.removeItem('eams_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('eams_token', data.token);
    const nextUser = {
      ...data.data.user,
      rbacRole: getCanonicalRole(data.data.user?.role),
    };
    setUser(nextUser);
    return nextUser;
  };

  const logout = () => {
    localStorage.removeItem('eams_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, loadUser,
      isAdmin: hasAnyRole(user?.role, ['SUPER_ADMIN']),
      isOrganiser: hasAnyRole(user?.role, ['ORGANISER']),
      isSubOrg: hasAnyRole(user?.role, ['SUB_ORGANISER']),
      isStaff: hasAnyRole(user?.role, ['STAFF']),
      isAuditor: hasAnyRole(user?.role, ['AUDITOR']),
      canManageEvent: hasAnyRole(user?.role, ['SUPER_ADMIN', 'ORGANISER']),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
