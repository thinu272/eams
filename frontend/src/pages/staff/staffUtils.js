export const buildAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const baseUrl = process.env.REACT_APP_API_URL?.replace(/\/api$/, '') || 'http://localhost:5000';
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

export const parseScannedValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw);
    return parsed.attendeeToken || parsed.token || parsed.qrToken || raw;
  } catch {
    return raw;
  }
};

export const playFeedbackTone = (success) => {
  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = success ? 880 : 240;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.22);
  } catch {
    // Ignore browsers that require explicit audio permissions.
  }
};

export const triggerHaptic = (success) => {
  if (typeof navigator?.vibrate !== 'function') return;
  navigator.vibrate(success ? [60] : [120, 40, 120]);
};

export const getAssignedGateLabel = (user) => (user?.assignedGates || []).filter(Boolean).join(', ') || 'Any gate';
export const getAssignedZones = (user) => Array.from(new Set([
  ...((user?.assignedZones || []).filter(Boolean)),
  ...((user?.responsibilities?.zoneIds || []).filter(Boolean)),
]));
export const getAssignedZoneLabel = (user) => getAssignedZones(user).join(', ') || 'Any zone';
