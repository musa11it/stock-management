import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchSalesReport, type SalesReport } from '@/services/reports.service';
import { getErrorMessage } from '@/lib/apiClient';
import { ReportTabs } from './ReportTabs';

export default function SalesReportPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports', 'sales', dateFrom, dateTo],
    queryFn: () => fetchSalesReport({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
  });

  const columns: Column<SalesReport['sales'][number]>[] = [
    { header: 'Sale #', accessor: (s) => s.saleNumber },
    { header: 'Items', accessor: (s) => s.itemCount },
    { header: 'Total', accessor: (s) => s.total.toLocaleString() },
    { header: 'Payment', accessor: (s) => s.paymentMethod.replace('_', ' ') },
    { header: 'Date', accessor: (s) => new Date(s.createdAt).toLocaleString() },
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
          <TableSkeleton cols={5} />
        </Card>
      ) : isError || !data ? (
        <Card>
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total revenue" value={data.totalRevenue.toLocaleString()} icon={DollarSign} tone="green" />
            <StatCard label="Ingredient cost" value={data.cogs.toLocaleString()} icon={DollarSign} tone="amber" />
            <StatCard
              label="Profit"
              value={data.profit.toLocaleString()}
              icon={data.profit >= 0 ? TrendingUp : TrendingDown}
              tone={data.profit >= 0 ? 'green' : 'red'}
            />
            <StatCard label="Payment methods used" value={String(data.byPaymentMethod.length)} icon={Receipt} tone="brand" />
          </div>

          {data.ingredientUsage.length > 0 && (
            <Card className="mb-4">
              <div className="border-b border-slate-100 px-5 py-3">
                <p className="text-sm font-semibold text-slate-900">Ingredients used in this range</p>
              </div>
              <div className="space-y-2 p-5">
                {data.ingredientUsage.map((row) => (
                  <div key={row.productId} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">
                      {row.productName} <span className="text-slate-400">· {row.quantity.toFixed(2)} {row.unit}</span>
                    </span>
                    <span className="font-medium text-slate-900">{row.cost.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            {data.sales.length === 0 ? (
              <EmptyState icon={Receipt} title="No sales in this range" />
            ) : (
              <DataTable columns={columns} data={data.sales} rowKey={(s) => s.id} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
