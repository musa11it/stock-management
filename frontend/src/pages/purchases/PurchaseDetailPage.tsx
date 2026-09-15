import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, PackageCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Can } from '@/components/common/Can';
import { purchaseCrud, receivePurchase } from '@/services/purchase.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { Purchase, PurchaseStatus } from '@/types';

const statusTone: Record<PurchaseStatus, 'slate' | 'amber' | 'green' | 'blue' | 'red'> = {
  DRAFT: 'slate',
  PENDING: 'amber',
  RECEIVED: 'green',
  PARTIALLY_RECEIVED: 'blue',
  CANCELLED: 'red',
};

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);

  const { data: purchase, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['purchases', id],
    queryFn: () => purchaseCrud.get(id!),
    enabled: !!id,
  });

  const receiveMutation = useMutation({
    mutationFn: (items: { productId: string; receivedQty: number }[]) => receivePurchase(id!, items),
    onSuccess: (updated) => {
      const fullyReceived = updated.status === 'RECEIVED';
      toast.success(fullyReceived ? 'Purchase fully received and stock updated' : 'Partial delivery recorded and stock updated');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsReceiveOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !purchase) return <ErrorState message={getErrorMessage(error)} onRetry={refetch} />;

  const canReceive = purchase.status === 'PENDING' || purchase.status === 'PARTIALLY_RECEIVED';

  return (
    <div>
      <button onClick={() => navigate('/purchases')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to purchases
      </button>

      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{purchase.purchaseNumber}</h1>
            <Badge tone={statusTone[purchase.status]}>{purchase.status.replace('_', ' ')}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {purchase.supplier.name} · {new Date(purchase.purchaseDate).toLocaleDateString()}
          </p>
        </div>
        {canReceive && (
          <Can permission="purchases.receive">
            <Button onClick={() => setIsReceiveOpen(true)}>
              <PackageCheck className="h-4 w-4" /> Receive Stock
            </Button>
          </Can>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Product</th>
                  <th className="px-5 py-2.5 font-medium">Ordered</th>
                  <th className="px-5 py-2.5 font-medium">Received</th>
                  <th className="px-5 py-2.5 font-medium">Unit cost</th>
                  <th className="px-5 py-2.5 font-medium">Value received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchase.items.map((item) => {
                  const short = Number(item.receivedQty) > 0 && Number(item.receivedQty) < Number(item.quantity) && purchase.status !== 'PENDING';
                  return (
                    <tr key={item.id}>
                      <td className="px-5 py-3 font-medium text-slate-900">{item.product.name}</td>
                      <td className="px-5 py-3">
                        {Number(item.quantity)} {item.product.unit.abbreviation}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={Number(item.receivedQty) >= Number(item.quantity) ? 'green' : Number(item.receivedQty) > 0 ? 'blue' : 'slate'}>
                          {Number(item.receivedQty)} {item.product.unit.abbreviation}
                        </Badge>
                        {short && (
                          <span className="ml-2 text-xs text-amber-600">
                            {(Number(item.quantity) - Number(item.receivedQty)).toLocaleString()} short
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">{Number(item.unitCost).toLocaleString()}</td>
                      <td className="px-5 py-3">{(Number(item.receivedQty) * Number(item.unitCost)).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {purchase.status === 'PARTIALLY_RECEIVED' && (
              <p className="mb-1 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                Only partially received - totals below reflect what's arrived so far, not the original order.
              </p>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Subtotal (received)</span>
              <span>{Number(purchase.subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span>{Number(purchase.tax).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span>-{Number(purchase.discount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
              <span>Total (received)</span>
              <span>{Number(purchase.total).toLocaleString()}</span>
            </div>
            {purchase.status === 'PARTIALLY_RECEIVED' && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Originally ordered</span>
                <span>
                  {purchase.items
                    .reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitCost), 0)
                    .toLocaleString()}
                </span>
              </div>
            )}
            <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <p>Warehouse: {purchase.warehouse.name}</p>
              <p>
                Created by {purchase.createdBy.firstName} {purchase.createdBy.lastName}
              </p>
              {purchase.invoiceNumber && <p>Invoice #{purchase.invoiceNumber}</p>}
              {purchase.notes && <p>Notes: {purchase.notes}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {isReceiveOpen && (
        <ReceiveModal
          purchase={purchase}
          isSubmitting={receiveMutation.isPending}
          onClose={() => setIsReceiveOpen(false)}
          onSubmit={(items) => receiveMutation.mutate(items)}
        />
      )}
    </div>
  );
}

function ReceiveModal({
  purchase,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  purchase: Purchase;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (items: { productId: string; receivedQty: number }[]) => void;
}) {
  const outstanding = useMemo(
    () => purchase.items.filter((item) => Number(item.receivedQty) < Number(item.quantity)),
    [purchase.items],
  );

  const remainingOf = (item: (typeof outstanding)[number]) => Number(item.quantity) - Number(item.receivedQty);

  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(outstanding.map((item) => [item.productId, String(remainingOf(item))])),
  );

  const setAllToRemaining = () => {
    setQuantities(Object.fromEntries(outstanding.map((item) => [item.productId, String(remainingOf(item))])));
  };

  const setAllToZero = () => {
    setQuantities(Object.fromEntries(outstanding.map((item) => [item.productId, '0'])));
  };

  const handleSubmit = () => {
    const items = outstanding
      .map((item) => ({ productId: item.productId, receivedQty: Number(quantities[item.productId]) || 0 }))
      .filter((entry) => entry.receivedQty > 0);

    if (items.length === 0) {
      toast.error('Enter at least one quantity to receive');
      return;
    }
    for (const item of outstanding) {
      const entered = Number(quantities[item.productId]) || 0;
      if (entered < 0 || entered > remainingOf(item)) {
        toast.error(`${item.product.name}: enter a quantity between 0 and ${remainingOf(item)}`);
        return;
      }
    }
    onSubmit(items);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Receive stock"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            Confirm receipt
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-500">
        Enter what actually arrived. If the supplier delivered less than ordered, reduce the quantity below - the
        difference stays outstanding so you can receive it later.
      </p>
      <div className="mb-3 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={setAllToRemaining}>
          Received in full
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={setAllToZero}>
          Clear all
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">Ordered</th>
              <th className="px-4 py-2.5 font-medium">Already received</th>
              <th className="px-4 py-2.5 font-medium">Remaining</th>
              <th className="px-4 py-2.5 font-medium">Receiving now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {outstanding.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{item.product.name}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {Number(item.quantity)} {item.product.unit.abbreviation}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {Number(item.receivedQty)} {item.product.unit.abbreviation}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {remainingOf(item)} {item.product.unit.abbreviation}
                </td>
                <td className="px-4 py-2.5">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={remainingOf(item)}
                    className="w-28"
                    value={quantities[item.productId] ?? ''}
                    onChange={(e) => setQuantities((prev) => ({ ...prev, [item.productId]: e.target.value }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
