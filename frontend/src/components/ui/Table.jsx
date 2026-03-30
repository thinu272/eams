import React from 'react';

export const Table = ({ children, className = '' }) => (
  <div className={`overflow-x-auto rounded-lg border border-gray-200 ${className}`}>
    <table className="min-w-full divide-y divide-gray-200">{children}</table>
  </div>
);
export const Th = ({ children, className = '' }) => (
  <th className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 ${className}`}>{children}</th>
);
export const Td = ({ children, className = '' }) => (
  <td className={`px-4 py-3 text-sm text-gray-700 ${className}`}>{children}</td>
);
export const Tr = ({ children, className = '', onClick }) => (
  <tr className={`border-t border-gray-100 ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${className}`} onClick={onClick}>{children}</tr>
);
