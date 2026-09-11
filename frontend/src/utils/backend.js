export const getApiBase = () => {
  // REACT_APP_API_URL should include the /api suffix if set, otherwise fallback to host + port
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL.replace(/\/$/, '');
  const port = process.env.REACT_APP_BACKEND_PORT || '5000';
  const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
  return `${window.location.protocol}//${host}:${port}/api`;
};

export const getBackendBase = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '');
  const port = process.env.REACT_APP_BACKEND_PORT || '5000';
  const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
  return `${window.location.protocol}//${host}:${port}`;
};

export const getAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${getBackendBase()}${path.startsWith('/') ? path : `/${path}`}`;
};

export const getSocketUrl = () => getBackendBase();
