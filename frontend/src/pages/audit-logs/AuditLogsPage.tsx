import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { listAuditLogs } from '@/services/auditLog.service';
import { getErrorMessage } from '@/lib/apiClient';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { AuditLog } from '@/types';

function actionTone(action: string): 'green' | 'red' | 'amber' | 'blue' {
  if (action.includes('DELETE') || action.includes('REJECT') || action.includes('CANCEL')) return 'red';
  if (action.includes('CREATE') || action.includes('APPROV') || action.includes('RECEIVE')) return 'green';
  if (action.includes('UPDATE') || action.includes('ADJUST')) return 'blue';
  return 'amber';
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const debouncedEntity = useDebouncedValue(entity, 400);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audit-logs', page, debouncedEntity],
    queryFn: () => listAuditLogs({ page, limit: 20, entity: debouncedEntity || undefined }),
  });

  const columns: Column<AuditLog>[] = [
    { header: 'Date', accessor: (l) => new Date(l.createdAt).toLocaleString() },
    { header: 'Action', accessor: (l) => <Badge tone={actionTone(l.action)}>{l.action.replace(/_/g, ' ')}</Badge> },
    { header: 'Entity', accessor: (l) => l.entity },
    { header: 'User', accessor: (l) => (l.user ? `${l.user.firstName} ${l.user.lastName}` : <span className="text-slate-400">System</span>) },
    { header: 'IP address', accessor: (l) => l.ipAddress || <span className="text-slate-400">—</span> },
  ];

  return (
    <div>
      <PageHeader title="Audit Logs" description="A complete, tamper-evident record of every sensitive action taken in the system." />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <Input
            className="max-w-xs"
            placeholder="Filter by entity (e.g. Product)"
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {isLoading ? (
          <TableSkeleton cols={5} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No audit log entries" description="Actions taken across the system will appear here." />
        ) : (
          <>
            <DataTable columns={columns} data={data.data} rowKey={(l) => l.id} />
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
