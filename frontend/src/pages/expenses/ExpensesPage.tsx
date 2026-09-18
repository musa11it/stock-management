import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { formResolver } from '@/lib/zodForm';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Wallet, FileText } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Can } from '@/components/common/Can';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { expenseCrud } from '@/services/expense.service';
import { userService } from '@/services/user.service';
import { getErrorMessage } from '@/lib/apiClient';
import { personLabel } from '@/lib/roleLabel';
import { ExpenseReceiptModal } from '@/components/receipt/ExpenseReceipt';
import type { Expense, ExpenseCategory } from '@/types';

const categories: { value: ExpenseCategory; label: string }[] = [
  { value: 'SALARY', label: 'Salary / Staff Payment' },
  { value: 'ELECTRICITY', label: 'Electricity' },
  { value: 'WATER', label: 'Water' },
  { value: 'RENT', label: 'Rent' },
  { value: 'TAX', label: 'Tax' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'INTERNET', label: 'Internet' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'OTHER', label: 'Other' },
];
const categoryLabel = Object.fromEntries(categories.map((c) => [c.value, c.label])) as Record<ExpenseCategory, string>;

const schema = z
  .object({
    category: z.enum(['SALARY', 'ELECTRICITY', 'WATER', 'RENT', 'TAX', 'TRANSPORT', 'MAINTENANCE', 'INTERNET', 'MARKETING', 'OTHER']),
    recipientUserId: z.string().optional(),
    recipientName: z.string().max(200).optional(),
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    description: z.string().max(1000).optional(),
  })
  .refine((v) => v.category !== 'SALARY' || !!v.recipientUserId, {
    message: 'Select who receives this payment',
    path: ['recipientUserId'],
  })
  .refine((v) => v.category === 'SALARY' || !!v.recipientName?.trim(), {
    message: 'Enter who or what this expense was paid to',
    path: ['recipientName'],
  });
type FormValues = z.infer<typeof schema>;

function recipientDisplay(expense: Expense): string {
  if (expense.recipientUser) return personLabel(expense.recipientUser) ?? '—';
  return expense.recipientName || '—';
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<Expense | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['expenses', page, category],
    queryFn: () => expenseCrud.list({ page, limit: 15, category: category || undefined }),
  });

  // Reuses the existing user directory - no separate/duplicate worker list.
  const { data: users } = useQuery({ queryKey: ['users', 'all'], queryFn: () => userService.list({ limit: 200 }) });
  const workers = useMemo(
    () => (users?.data ?? []).filter((u) => (u.role.name === 'STAFF' || u.role.name === 'MANAGER') && u.status === 'ACTIVE'),
    [users],
  );

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => expenseCrud.create(values),
    onSuccess: () => {
      toast.success('Expense recorded and paid successfully');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsCreateOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const columns: Column<Expense>[] = [
    { header: 'Reference #', accessor: (e) => <span className="font-medium text-slate-900">{e.expenseNumber}</span> },
    { header: 'Category', accessor: (e) => <Badge tone="slate">{categoryLabel[e.category]}</Badge> },
    { header: 'Paid to', accessor: (e) => recipientDisplay(e) },
    { header: 'Amount', accessor: (e) => Number(e.amount).toLocaleString() },
    { header: 'Paid by', accessor: (e) => personLabel(e.createdBy) },
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
      <PageHeader
        title="Expenses"
        description="Salaries, rent, utilities, and other business expenses - paid and recorded here."
        action={
          <Can permission="expenses.create">
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Expense
            </Button>
          </Can>
        }
      />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <Select
            className="max-w-[240px]"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton cols={8} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={Wallet} title="No expenses recorded" description="Record an expense to keep the books accurate." />
        ) : (
          <>
            <DataTable columns={columns} data={data.data} rowKey={(e) => e.id} />
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      {isCreateOpen && (
        <CreateExpenseModal
          workers={workers}
          isSubmitting={createMutation.isPending}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      )}

      {receiptTarget && <ExpenseReceiptModal expense={receiptTarget} onClose={() => setReceiptTarget(null)} />}
    </div>
  );
}

function CreateExpenseModal({
  workers,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  workers: { id: string; firstName: string; lastName: string; role: { name: string } }[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: formResolver(schema), defaultValues: { category: 'SALARY' } });
  const category = watch('category');
  const isSalary = category === 'SALARY';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="New expense"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="expense-form" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
            Record payment
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Select label="Category" error={errors.category?.message} {...register('category')}>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>

        {isSalary ? (
          <Select label="Pay to (staff or manager)" error={errors.recipientUserId?.message} {...register('recipientUserId')}>
            <option value="">Select worker</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.firstName} {w.lastName} ({w.role.name === 'MANAGER' ? 'Manager' : 'Staff'})
              </option>
            ))}
          </Select>
        ) : (
          <Input
            label="Paid to / expense name"
            placeholder="e.g. City Power Co., Landlord, Vendor name"
            error={errors.recipientName?.message}
            {...register('recipientName')}
          />
        )}

        <Input label="Amount" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
        <Textarea label="Description / reference (optional)" rows={2} {...register('description')} />
      </form>
    </Modal>
  );
}
