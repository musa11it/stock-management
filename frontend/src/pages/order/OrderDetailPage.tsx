import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, XCircle, ChefHat, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { getMyOrder } from '@/services/order.service';
import { getErrorMessage } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import { personLabel } from '@/lib/roleLabel';
import { ReceiptModal } from '@/components/receipt/Receipt';
import type { SaleStatus } from '@/types';

const statusTone: Record<SaleStatus, 'amber' | 'green' | 'red'> = { PENDING: 'amber', COMPLETED: 'green', CANCELLED: 'red' };
const statusLabel: Record<SaleStatus, string> = { PENDING: 'Preparing', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showReceipt, setShowReceipt] = useState(false);

  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-orders', id],
    queryFn: () => getMyOrder(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !order) return <ErrorState message={getErrorMessage(error)} onRetry={refetch} />;

  return (
    <div>
      <button onClick={() => navigate('/orders')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to my orders
      </button>

      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{order.saleNumber}</h1>
            <Badge tone={statusTone[order.status]}>{statusLabel[order.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">Placed {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        {order.status === 'COMPLETED' && (
          <Button variant="outline" size="sm" onClick={() => setShowReceipt(true)}>
            <FileText className="h-4 w-4" /> View Receipt
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderStatusTracker status={order.status} />
          </CardContent>
          <CardHeader className="border-t border-slate-100">
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Item</th>
                  <th className="px-5 py-2.5 font-medium">Qty</th>
                  <th className="px-5 py-2.5 font-medium">Price</th>
                  <th className="px-5 py-2.5 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3 font-medium text-slate-900">{item.menuItem.name}</td>
                    <td className="px-5 py-3">{item.quantity}</td>
                    <td className="px-5 py-3">{Number(item.unitPrice).toLocaleString()}</td>
                    <td className="px-5 py-3">{Number(item.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{Number(order.subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span>{Number(order.tax).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span>-{Number(order.discount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
              <span>Total</span>
              <span>{Number(order.total).toLocaleString()}</span>
            </div>
            <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <p>Payment: {order.paymentMethod.replace('_', ' ')}</p>
              <p>Ordered by: {personLabel(order.createdBy)}</p>
              <p>Confirmed by: {order.confirmedBy ? personLabel(order.confirmedBy) : 'Not yet confirmed'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {showReceipt && <ReceiptModal sale={order} onClose={() => setShowReceipt(false)} />}
    </div>
  );
}

function OrderStatusTracker({ status }: { status: SaleStatus }) {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-700">
        <XCircle className="h-6 w-6" />
        <div>
          <p className="font-medium">Order cancelled</p>
          <p className="text-sm text-red-600">Any stock reserved for this order has been released.</p>
        </div>
      </div>
    );
  }

  const steps = [
    { key: 'placed', label: 'Order placed', icon: CheckCircle2, done: true },
    { key: 'preparing', label: 'Preparing', icon: ChefHat, done: true },
    { key: 'ready', label: 'Ready / Completed', icon: CheckCircle2, done: status === 'COMPLETED' },
  ];

  return (
    <div className="flex items-center">
      {steps.map((step, index) => (
        <div key={step.key} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border-2',
                step.done ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-300',
              )}
            >
              {step.done ? <step.icon className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </div>
            <span className={cn('text-xs font-medium', step.done ? 'text-slate-900' : 'text-slate-400')}>{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <div className={cn('mx-2 h-0.5 flex-1', steps[index + 1].done ? 'bg-brand-600' : 'bg-slate-200')} />
          )}
        </div>
      ))}
    </div>
  );
}
