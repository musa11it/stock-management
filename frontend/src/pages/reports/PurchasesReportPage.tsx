import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchPurchasesReport, type PurchasesReport } from '@/services/reports.service';
import { getErrorMessage } from '@/lib/apiClient';
import { ReportTabs } from './ReportTabs';

export default function PurchasesReportPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports', 'purchases', dateFrom, dateTo],
    queryFn: () => fetchPurchasesReport({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
  });

  const columns: Column<PurchasesReport['purchases'][number]>[] = [
    { header: 'Purchase #', accessor: (p) => p.purchaseNumber },
    { header: 'Supplier', accessor: (p) => p.supplier },
    { header: 'Status', accessor: (p) => p.status.replace('_', ' ') },
    { header: 'Items', accessor: (p) => p.itemCount },
    { header: 'Total', accessor: (p) => p.total.toLocaleString() },
    { header: 'Date', accessor: (p) => new Date(p.purchaseDate).toLocaleDateString() },
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
            <StatCard label="Total spend" value={data.totalSpend.toLocaleString()} icon={DollarSign} tone="green" />
            <StatCard label="Suppliers" value={String(data.bySupplier.length)} icon={ShoppingCart} tone="brand" />
          </div>
          <Card>
            {data.purchases.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="No purchases in this range" />
            ) : (
              <DataTable columns={columns} data={data.purchases} rowKey={(p) => p.id} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
