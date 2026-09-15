import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { listMyOrders } from '@/services/order.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { Sale, SaleStatus } from '@/types';

const statusTone: Record<SaleStatus, 'amber' | 'green' | 'red'> = { PENDING: 'amber', COMPLETED: 'green', CANCELLED: 'red' };
const statusLabel: Record<SaleStatus, string> = { PENDING: 'Preparing', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-orders', page, status],
    queryFn: () => listMyOrders({ page, limit: 15, status: (status || undefined) as SaleStatus | undefined }),
    refetchInterval: 8000,
  });

  const columns: Column<Sale>[] = [
    { header: 'Order #', accessor: (s) => <span className="font-medium text-slate-900">{s.saleNumber}</span> },
    { header: 'Items', accessor: (s) => s.items.reduce((sum, i) => sum + i.quantity, 0) },
    { header: 'Total', accessor: (s) => Number(s.total).toLocaleString() },
    { header: 'Placed', accessor: (s) => new Date(s.createdAt).toLocaleString() },
    { header: 'Status', accessor: (s) => <Badge tone={statusTone[s.status]}>{statusLabel[s.status]}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="My Orders" description="Track the status of orders you've placed." />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <Select
            className="max-w-[200px]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All orders</option>
            <option value="PENDING">Preparing</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton cols={5} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={Receipt} title="No orders yet" description="Orders you place from the menu will show up here." />
        ) : (
          <>
            <DataTable columns={columns} data={data.data} rowKey={(s) => s.id} onRowClick={(s) => navigate(`/orders/${s.id}`)} />
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
