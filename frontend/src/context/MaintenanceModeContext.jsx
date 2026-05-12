import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getPublicConfig } from '../api/events';
import io from 'socket.io-client';

const MaintenanceContext = createContext();

export const useMaintenanceMode = () => {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error('useMaintenanceMode must be used within MaintenanceModeProvider');
  }
  return context;
};

export const MaintenanceModeProvider = ({ children }) => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch initial maintenance mode status
  const fetchMaintenanceStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getPublicConfig();
      if (response?.success && response?.data) {
        setMaintenanceMode(response.data.maintenanceMode || false);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch maintenance status:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize socket connection and listen for maintenance mode changes
  useEffect(() => {
    fetchMaintenanceStatus();

    // Connect to WebSocket
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Listen for maintenance mode changes
    const handleMaintenanceModeChanged = (data) => {
      console.log('Maintenance mode changed:', data);
      setMaintenanceMode(data.maintenanceMode);
    };

    socket.on('system:maintenance-mode-changed', handleMaintenanceModeChanged);

    // Cleanup on unmount
    return () => {
      socket.off('system:maintenance-mode-changed', handleMaintenanceModeChanged);
      socket.disconnect();
    };
  }, [fetchMaintenanceStatus]);

  const value = {
    maintenanceMode,
    loading,
    error,
    refetch: fetchMaintenanceStatus,
  };

  return (
    <MaintenanceContext.Provider value={value}>
      {children}
    </MaintenanceContext.Provider>
  );
};

export default MaintenanceContext;
