import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <ShieldAlert className="h-12 w-12 text-amber-500" />
      <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
      <p className="max-w-sm text-sm text-slate-500">
        You don't have permission to view this page. Contact your administrator if you believe this is a mistake.
      </p>
      <Link to="/dashboard">
        <Button className="mt-2">Back to dashboard</Button>
      </Link>
    </div>
  );
}
