import React from 'react';

const colors = {
  blue: 'bg-blue-100 text-blue-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  sky: 'bg-sky-100 text-sky-800',
  green: 'bg-emerald-100 text-emerald-800',
  yellow: 'bg-amber-100 text-amber-800',
  orange: 'bg-orange-100 text-orange-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  purple: 'bg-purple-100 text-purple-800',
  gray: 'bg-gray-100 text-gray-700',
};

const Badge = ({ color = 'gray', children, className = '' }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]} ${className}`}>
    {children}
  </span>
);

export default Badge;
