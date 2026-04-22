import React from 'react';
import { NavLink } from 'react-router-dom';

const BottomNav = ({ items = [] }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/90 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-3 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (
                `flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-xs font-medium transition ` +
                (isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')
              )}
              end={item.end}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;

