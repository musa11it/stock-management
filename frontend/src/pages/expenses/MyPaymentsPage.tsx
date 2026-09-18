import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, FileText } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { listMyExpenses } from '@/services/expense.service';
import { getErrorMessage } from '@/lib/apiClient';
import { ExpenseReceiptModal } from '@/components/receipt/ExpenseReceipt';
import type { Expense, ExpenseCategory } from '@/types';

const categoryLabel: Record<ExpenseCategory, string> = {
  SALARY: 'Salary / Staff Payment',
  ELECTRICITY: 'Electricity',
  WATER: 'Water',
  RENT: 'Rent',
  TAX: 'Tax',
  TRANSPORT: 'Transport',
  MAINTENANCE: 'Maintenance',
  INTERNET: 'Internet',
  MARKETING: 'Marketing',
  OTHER: 'Other',
};

export default function MyPaymentsPage() {
  const [page, setPage] = useState(1);
  const [receiptTarget, setReceiptTarget] = useState<Expense | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['expenses', 'my', page],
    queryFn: () => listMyExpenses({ page, limit: 15 }),
  });

  const columns: Column<Expense>[] = [
    { header: 'Reference #', accessor: (e) => <span className="font-medium text-slate-900">{e.expenseNumber}</span> },
    { header: 'Category', accessor: (e) => <Badge tone="slate">{categoryLabel[e.category]}</Badge> },
    { header: 'Amount', accessor: (e) => Number(e.amount).toLocaleString() },
    { header: 'Date', accessor: (e) => new Date(e.createdAt).toLocaleString() },
    { header: 'Status', accessor: () => <Badge tone="green">Paid</Badge> },
    {
      header: '',
      accessor: (e) => (
        <div className="flex justify-end">
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              setReceiptTarget(e);
            }}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            title="View receipt"
          >
            <FileText className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="My Payments" description="Payments the restaurant has made out to you." />

      <Card>
        {isLoading ? (
          <TableSkeleton cols={6} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments yet" description="Payments made out to you will show up here." />
        ) : (
          <>
            <DataTable columns={columns} data={data.data} rowKey={(e) => e.id} />
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      {receiptTarget && <ExpenseReceiptModal expense={receiptTarget} onClose={() => setReceiptTarget(null)} />}
    </div>
  );
}
