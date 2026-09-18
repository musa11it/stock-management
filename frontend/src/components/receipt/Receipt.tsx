import { Download, Printer } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { personLabel } from '@/lib/roleLabel';
import type { Sale, SaleStatus } from '@/types';

const statusLabel: Record<SaleStatus, string> = { PENDING: 'Pending', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const statusTone: Record<SaleStatus, 'amber' | 'green' | 'red'> = { PENDING: 'amber', COMPLETED: 'green', CANCELLED: 'red' };

function customerLabel(sale: Sale): string | null {
  return sale.customerName || (sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : null);
}

/** The receipt itself - identical for staff and customers since Sale/SaleItem never carry cost, supplier, or inventory data to begin with. */
export function ReceiptContent({ sale }: { sale: Sale }) {
  const customer = customerLabel(sale);

  return (
    <div id="receipt-print-area" className="bg-white p-2 text-sm text-slate-900 print:p-8">
      <div className="mb-4 text-center">
        <p className="text-lg font-bold tracking-tight">Restaurant Stock</p>
        <p className="text-xs text-slate-500">Restaurant Stock Management System</p>
      </div>

      <div className="mb-4 space-y-1 border-y border-dashed border-slate-300 py-3 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Receipt #</span>
          <span className="font-medium">{sale.saleNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Date</span>
          <span>{new Date(sale.createdAt).toLocaleString()}</span>
        </div>
        {customer && (
          <div className="flex justify-between">
            <span className="text-slate-500">Customer</span>
            <span>{customer}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Payment method</span>
          <span>{sale.paymentMethod.replace('_', ' ')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Status</span>
          <Badge tone={statusTone[sale.status]}>{statusLabel[sale.status]}</Badge>
        </div>
      </div>

      <table className="mb-4 w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-1 font-medium">Item</th>
            <th className="py-1 text-center font-medium">Qty</th>
            <th className="py-1 text-right font-medium">Unit price</th>
            <th className="py-1 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id} className="border-b border-slate-100">
              <td className="py-1.5 pr-2">{item.menuItem.name}</td>
              <td className="py-1.5 text-center">{item.quantity}</td>
              <td className="py-1.5 text-right">{Number(item.unitPrice).toLocaleString()}</td>
              <td className="py-1.5 text-right">{Number(item.total).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-1 border-t border-slate-200 pt-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Subtotal</span>
          <span>{Number(sale.subtotal).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Tax</span>
          <span>{Number(sale.tax).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Discount</span>
          <span>-{Number(sale.discount).toLocaleString()}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-semibold text-slate-900">
          <span>Total</span>
          <span>{Number(sale.total).toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3 text-xs text-slate-500">
        <p>Ordered by: {personLabel(sale.createdBy)}</p>
        <p>Confirmed by: {sale.confirmedBy ? personLabel(sale.confirmedBy) : 'Not yet confirmed'}</p>
      </div>

      <p className="mt-5 text-center text-[11px] text-slate-400">Thank you for your order!</p>
    </div>
  );
}

function buildReceiptHtml(sale: Sale): string {
  const customer = customerLabel(sale);
  const rows = sale.items
    .map(
      (item) => `<tr>
        <td>${item.menuItem.name}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${Number(item.unitPrice).toLocaleString()}</td>
        <td style="text-align:right">${Number(item.total).toLocaleString()}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt ${sale.saleNumber}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 24px auto; color: #0f172a; font-size: 13px; }
  h1 { font-size: 18px; text-align: center; margin-bottom: 2px; }
  .subtitle { text-align: center; color: #64748b; font-size: 11px; margin-bottom: 16px; }
  .meta { border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 12px 0; margin-bottom: 16px; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .label { color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { text-align: left; color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 4px 0; font-weight: 500; }
  td { padding: 5px 0; border-bottom: 1px solid #f1f5f9; }
  .totals { border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .total-row { display: flex; justify-content: space-between; font-weight: 600; font-size: 14px; border-top: 1px solid #e2e8f0; margin-top: 4px; padding-top: 6px; }
  .footer { border-top: 1px dashed #cbd5e1; margin-top: 16px; padding-top: 10px; color: #64748b; font-size: 11px; }
  .thanks { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 18px; }
</style>
</head>
<body>
  <h1>Restaurant Stock</h1>
  <p class="subtitle">Restaurant Stock Management System</p>
  <div class="meta">
    <div class="row"><span class="label">Receipt #</span><span>${sale.saleNumber}</span></div>
    <div class="row"><span class="label">Date</span><span>${new Date(sale.createdAt).toLocaleString()}</span></div>
    ${customer ? `<div class="row"><span class="label">Customer</span><span>${customer}</span></div>` : ''}
    <div class="row"><span class="label">Payment method</span><span>${sale.paymentMethod.replace('_', ' ')}</span></div>
    <div class="row"><span class="label">Status</span><span>${statusLabel[sale.status]}</span></div>
  </div>
  <table>
    <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span class="label">Subtotal</span><span>${Number(sale.subtotal).toLocaleString()}</span></div>
    <div class="row"><span class="label">Tax</span><span>${Number(sale.tax).toLocaleString()}</span></div>
    <div class="row"><span class="label">Discount</span><span>-${Number(sale.discount).toLocaleString()}</span></div>
    <div class="total-row"><span>Total</span><span>${Number(sale.total).toLocaleString()}</span></div>
  </div>
  <div class="footer">
    <p>Ordered by: ${personLabel(sale.createdBy)}</p>
    <p>Confirmed by: ${sale.confirmedBy ? personLabel(sale.confirmedBy) : 'Not yet confirmed'}</p>
  </div>
  <p class="thanks">Thank you for your order!</p>
</body>
</html>`;
}

function downloadReceipt(sale: Sale) {
  const html = buildReceiptHtml(sale);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `receipt-${sale.saleNumber}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** View/Print/Download receipt modal - reused by both the staff Sales screen and a customer's own order detail page. */
export function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Receipt"
      footer={
        <>
          <Button variant="outline" onClick={() => downloadReceipt(sale)}>
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <ReceiptContent sale={sale} />
    </Modal>
  );
}
