import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

const tabs = [
  { label: 'Inventory', to: '/reports/inventory' },
  { label: 'Purchases', to: '/reports/purchases' },
  { label: 'Sales', to: '/reports/sales' },
  { label: 'Wastage', to: '/reports/wastage' },
];

export function ReportTabs() {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              'shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
