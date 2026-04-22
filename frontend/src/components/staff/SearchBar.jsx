import React from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';

const SearchBar = ({ value, onChange, placeholder = 'Search by name or phone', autoFocus = false }) => (
  <div className="relative">
    <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-base font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
    />
  </div>
);

export default SearchBar;
