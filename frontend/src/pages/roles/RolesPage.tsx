import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { listRoles } from '@/services/user.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { RoleName } from '@/types';

const roleTone: Record<RoleName, 'purple' | 'blue' | 'green' | 'slate'> = {
  SUPER_ADMIN: 'purple',
  MANAGER: 'blue',
  STAFF: 'green',
  RETAIL_USER: 'slate',
};

export default function RolesPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['roles'], queryFn: listRoles });

  return (
    <div>
      <PageHeader title="Roles & Permissions" description="System roles and the permissions granted to each." />

      {isLoading ? (
        <Card>
          <TableSkeleton cols={2} />
        </Card>
      ) : isError ? (
        <Card>
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  <CardTitle>
                    <Badge tone={roleTone[role.name]}>{role.name.replace('_', ' ')}</Badge>
                  </CardTitle>
                </div>
                <span className="text-xs text-slate-400">{role._count?.users ?? 0} users</span>
              </CardHeader>
              <CardContent>
                {role.name === 'SUPER_ADMIN' ? (
                  <p className="text-sm text-slate-500">Full, unrestricted access to every module and setting.</p>
                ) : role.permissions.length === 0 ? (
                  <p className="text-sm text-slate-400">No permissions assigned.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions.map((rp) => (
                      <span key={rp.permission.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {rp.permission.key}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
