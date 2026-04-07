export const ROLE_ALIASES = {
  SUPER_ADMIN: ['main_admin', 'super_admin'],
  ADMIN: ['main_admin', 'super_admin'],
  MAIN_ADMIN: ['main_admin', 'super_admin'],
  ORGANISER: ['main_organiser'],
  MAIN_ORGANISER: ['main_organiser'],
  SUB_ORGANISER: ['sub_organiser'],
  STAFF: ['staff', 'volunteer'],
  VOLUNTEER: ['volunteer'],
  AUDITOR: ['auditor'],
};

const normalizeRoleName = (role) => String(role || '').trim();

export const expandRoles = (roles = []) => {
  const values = Array.isArray(roles) ? roles : [roles];
  const expanded = new Set();

  values.forEach((role) => {
    const normalized = normalizeRoleName(role);
    if (!normalized) return;

    const upper = normalized.toUpperCase();
    if (ROLE_ALIASES[upper]) {
      ROLE_ALIASES[upper].forEach((mappedRole) => expanded.add(mappedRole));
      return;
    }

    expanded.add(normalized.toLowerCase());
  });

  return Array.from(expanded);
};

export const hasAnyRole = (userRole, allowedRoles = []) => {
  const expanded = expandRoles(allowedRoles);
  return expanded.includes(normalizeRoleName(userRole).toLowerCase());
};

export const getCanonicalRole = (userRole) => {
  const normalized = normalizeRoleName(userRole).toLowerCase();

  if (normalized === 'main_admin') return 'SUPER_ADMIN';
  if (normalized === 'main_organiser') return 'ORGANISER';
  if (normalized === 'sub_organiser') return 'SUB_ORGANISER';
  if (normalized === 'staff' || normalized === 'volunteer') return 'STAFF';
  if (normalized === 'auditor') return 'AUDITOR';
  if (normalized === 'buyer') return 'BUYER';

  return normalized.toUpperCase();
};
