export const getApiBase = () => {
  // REACT_APP_API_URL should include the /api suffix if set, otherwise fallback to host + port
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL.replace(/\/$/, '');
  const port = process.env.REACT_APP_BACKEND_PORT || '5000';
  return `${window.location.protocol}//${window.location.hostname}:${port}/api`;
};

export const getBackendBase = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '');
  const port = process.env.REACT_APP_BACKEND_PORT || '5000';
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
};

export const getAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${getBackendBase()}${path.startsWith('/') ? path : `/${path}`}`;
};

export const getSocketUrl = () => getBackendBase();
