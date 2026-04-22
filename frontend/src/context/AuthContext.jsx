import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { getCanonicalRole, hasRolePower, ROLES } from '../utils/rbac';

const AuthContext = createContext(null);
const USER_STORAGE_KEY = 'eams_user';

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      rbacRole: getCanonicalRole(parsed?.role),
    };
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('eams_token');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      const userData = data.data.user;
      const nextUser = {
        ...userData,
        rbacRole: getCanonicalRole(userData?.role),
      };
      setUser(nextUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    } catch (error) {
      if (error?.response?.status === 401) {
        localStorage.removeItem('eams_token');
        localStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
      } else {
        const storedUser = readStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('eams_token', data.token);
    const userData = data.data.user;
    const nextUser = {
      ...userData,
      rbacRole: getCanonicalRole(userData?.role),
    };
    setUser(nextUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    return nextUser;
  };

  const logout = () => {
    localStorage.removeItem('eams_token');
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  };

  /**
   * Permission Helper: can('SCAN_TICKET')
   * Checks both Role hierarchy and explicit permission overrides
   */
  const can = (permission) => {
    if (!user) return false;
    
    // Core Role Authorization
    if (hasRolePower(user.role, ROLES.MAIN_ADMIN)) return true;
    if (hasRolePower(user.role, ROLES.MAIN_ORGANISER)) return true;

    // Explicit JSON override check
    return !!(user.permissions && user.permissions[permission]);
  };

  return (
    <AuthContext.Provider value={{
      user, 
      loading, 
      login, 
      logout, 
      loadUser,
      can,
      isAdmin: hasRolePower(user?.role, ROLES.MAIN_ADMIN),
      isOrganiser: hasRolePower(user?.role, ROLES.MAIN_ORGANISER),
      isSubOrg: hasRolePower(user?.role, ROLES.SUB_ORGANISER),
      isStaff: hasRolePower(user?.role, ROLES.STAFF),
      isAuditor: hasRolePower(user?.role, ROLES.AUDITOR),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
