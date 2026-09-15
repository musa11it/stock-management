import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { fetchWastageReport, type WastageReport } from '@/services/reports.service';
import { getErrorMessage } from '@/lib/apiClient';
import { ReportTabs } from './ReportTabs';

export default function WastageReportPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports', 'wastage', dateFrom, dateTo],
    queryFn: () => fetchWastageReport({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
  });

  const columns: Column<WastageReport['wastages'][number]>[] = [
    { header: 'Report #', accessor: (w) => w.wastageNumber },
    { header: 'Warehouse', accessor: (w) => w.warehouse },
    { header: 'Reason', accessor: (w) => w.reason },
    { header: 'Items', accessor: (w) => w.itemCount },
    { header: 'Status', accessor: (w) => <Badge tone={w.status === 'APPROVED' ? 'green' : w.status === 'REJECTED' ? 'red' : 'amber'}>{w.status}</Badge> },
    { header: 'Date', accessor: (w) => new Date(w.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <PageHeader title="Reports" description="Inventory, purchases, sales, and wastage insights." />
      <ReportTabs />

      <div className="mb-4 flex gap-3">
        <Input type="date" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {isLoading ? (
        <Card>
          <TableSkeleton cols={6} />
        </Card>
      ) : isError || !data ? (
        <Card>
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <StatCard label="Total wastage value" value={data.totalValue.toLocaleString()} icon={DollarSign} tone="red" />
            <StatCard label="Reports in range" value={String(data.wastages.length)} icon={Trash2} tone="amber" />
          </div>
          <Card>
            {data.wastages.length === 0 ? (
              <EmptyState icon={Trash2} title="No wastage in this range" />
            ) : (
              <DataTable columns={columns} data={data.wastages} rowKey={(w) => w.id} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
