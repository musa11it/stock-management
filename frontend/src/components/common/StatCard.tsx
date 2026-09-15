import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'brand' | 'green' | 'amber' | 'red' | 'purple';
  subtext?: string;
}

const toneClasses = {
  brand: 'bg-brand-50 text-brand-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
};

export function StatCard({ label, value, icon: Icon, tone = 'brand', subtext }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
