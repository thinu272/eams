import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

import { AuthProvider } from './context/AuthContext';
import { MaintenanceModeProvider } from './context/MaintenanceModeContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <MaintenanceModeProvider>
        <App />
      </MaintenanceModeProvider>
    </AuthProvider>
  </React.StrictMode>
);
