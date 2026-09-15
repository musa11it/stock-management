import { useQuery } from '@tanstack/react-query';
import { BarChart3, DollarSign, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { fetchStockReport, type StockReportRow } from '@/services/reports.service';
import { getErrorMessage } from '@/lib/apiClient';
import { ReportTabs } from './ReportTabs';

export default function InventoryReportPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['reports', 'stock'], queryFn: fetchStockReport });

  const columns: Column<StockReportRow>[] = [
    { header: 'Product', accessor: (r) => <span className="font-medium text-slate-900">{r.productName}</span> },
    { header: 'SKU', accessor: (r) => r.sku },
    { header: 'Category', accessor: (r) => r.category },
    { header: 'Warehouse', accessor: (r) => r.warehouse },
    { header: 'Quantity', accessor: (r) => `${r.quantity} ${r.unit}` },
    { header: 'Value', accessor: (r) => r.value.toLocaleString() },
    { header: 'Status', accessor: (r) => <Badge tone={r.isLowStock ? 'red' : 'green'}>{r.isLowStock ? 'Low stock' : 'OK'}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Reports" description="Inventory, purchases, sales, and wastage insights." />
      <ReportTabs />

      {isLoading ? (
        <Card>
          <TableSkeleton cols={7} />
        </Card>
      ) : isError || !data ? (
        <Card>
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <StatCard label="Total inventory value" value={data.totalValue.toLocaleString()} icon={DollarSign} tone="green" />
            <StatCard label="Low stock items" value={String(data.lowStockCount)} icon={AlertTriangle} tone="red" />
          </div>
          <Card>
            {data.rows.length === 0 ? (
              <EmptyState icon={BarChart3} title="No inventory data" />
            ) : (
              <DataTable columns={columns} data={data.rows} rowKey={(r) => `${r.productId}-${r.warehouse}`} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
