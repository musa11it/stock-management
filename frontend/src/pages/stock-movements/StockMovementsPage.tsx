import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import * as stockService from '@/services/stock.service';
import { warehouseService } from '@/services/catalog.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { StockMovement, StockMovementType } from '@/types';

const typeTone: Record<StockMovementType, 'green' | 'red' | 'amber' | 'blue' | 'purple'> = {
  PURCHASE: 'green',
  CONSUMPTION: 'amber',
  WASTAGE: 'red',
  SALE: 'blue',
  ADJUSTMENT: 'purple',
  TRANSFER_OUT: 'amber',
  TRANSFER_IN: 'green',
};

export default function StockMovementsPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stock-movements', page, type, warehouseId],
    queryFn: () => stockService.listStockMovements({ page, limit: 20, type: type || undefined, warehouseId: warehouseId || undefined }),
  });

  const { data: warehouses } = useQuery({ queryKey: ['warehouses', 'all'], queryFn: () => warehouseService.list({ limit: 100 }) });

  const columns: Column<StockMovement>[] = [
    { header: 'Date', accessor: (m) => new Date(m.createdAt).toLocaleString() },
    { header: 'Product', accessor: (m) => <span className="font-medium text-slate-900">{m.product.name}</span> },
    { header: 'Warehouse', accessor: (m) => m.warehouse.name },
    { header: 'Type', accessor: (m) => <Badge tone={typeTone[m.type]}>{m.type.replace('_', ' ')}</Badge> },
    {
      header: 'Quantity',
      accessor: (m) => (
        <span className={Number(m.quantity) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
          {Number(m.quantity) >= 0 ? '+' : ''}
          {Number(m.quantity).toLocaleString()} {m.product.unit.abbreviation}
        </span>
      ),
    },
    { header: 'Balance', accessor: (m) => `${Number(m.previousQuantity)} → ${Number(m.newQuantity)}` },
    { header: 'Reason', accessor: (m) => m.reason || <span className="text-slate-400">—</span> },
    { header: 'By', accessor: (m) => `${m.createdBy.firstName} ${m.createdBy.lastName}` },
  ];

  return (
    <div>
      <PageHeader title="Stock Movements" description="Complete, immutable ledger of every inventory change." />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <Select
            className="max-w-[200px]"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            {Object.keys(typeTone).map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </Select>
          <Select
            className="max-w-[220px]"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All warehouses</option>
            {warehouses?.data.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton cols={8} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="No stock movements yet" description="Movements appear here as purchases, sales, and adjustments happen." />
        ) : (
          <>
            <DataTable columns={columns} data={data.data} rowKey={(m) => m.id} />
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
