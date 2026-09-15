import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <p className="text-6xl font-bold text-slate-200">404</p>
      <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="text-sm text-slate-500">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/dashboard">
        <Button className="mt-2">Back to dashboard</Button>
      </Link>
    </div>
  );
}
