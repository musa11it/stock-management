import { Download, Printer } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { personLabel } from '@/lib/roleLabel';
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

function recipientLabel(expense: Expense): string {
  if (expense.recipientUser) return personLabel(expense.recipientUser) ?? '—';
  return expense.recipientName || '—';
}

/** No cost price, supplier, or inventory data appears here - Expense only ever carries category, recipient, amount, and who paid it. */
export function ExpenseReceiptContent({ expense }: { expense: Expense }) {
  return (
    <div id="receipt-print-area" className="bg-white p-2 text-sm text-slate-900 print:p-8">
      <div className="mb-4 text-center">
        <p className="text-lg font-bold tracking-tight">Restaurant Stock</p>
        <p className="text-xs text-slate-500">Restaurant Stock Management System</p>
        <p className="mt-1 text-sm font-medium text-slate-700">Payment Receipt</p>
      </div>

      <div className="mb-4 space-y-1 border-y border-dashed border-slate-300 py-3 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Reference #</span>
          <span className="font-medium">{expense.expenseNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Date</span>
          <span>{new Date(expense.createdAt).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Category</span>
          <span>{categoryLabel[expense.category]}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Paid to</span>
          <span>{recipientLabel(expense)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Status</span>
          <Badge tone="green">Paid</Badge>
        </div>
      </div>

      {expense.description && (
        <div className="mb-4 text-xs">
          <p className="text-slate-500">Description</p>
          <p className="mt-0.5 text-slate-700">{expense.description}</p>
        </div>
      )}

      <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
        <span>Amount</span>
        <span>{Number(expense.amount).toLocaleString()}</span>
      </div>

      <div className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3 text-xs text-slate-500">
        <p>Paid by: {personLabel(expense.createdBy)}</p>
      </div>

      <p className="mt-5 text-center text-[11px] text-slate-400">This is an internal payment record.</p>
    </div>
  );
}

function buildExpenseReceiptHtml(expense: Expense): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Payment Receipt ${expense.expenseNumber}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 24px auto; color: #0f172a; font-size: 13px; }
  h1 { font-size: 18px; text-align: center; margin-bottom: 2px; }
  .subtitle { text-align: center; color: #64748b; font-size: 11px; margin-bottom: 2px; }
  .kind { text-align: center; font-weight: 600; margin-bottom: 16px; }
  .meta { border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 12px 0; margin-bottom: 16px; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .label { color: #64748b; }
  .desc { margin-bottom: 16px; font-size: 12px; }
  .amount-row { display: flex; justify-content: space-between; font-weight: 600; font-size: 16px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .footer { border-top: 1px dashed #cbd5e1; margin-top: 16px; padding-top: 10px; color: #64748b; font-size: 11px; }
  .thanks { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 18px; }
</style>
</head>
<body>
  <h1>Restaurant Stock</h1>
  <p class="subtitle">Restaurant Stock Management System</p>
  <p class="kind">Payment Receipt</p>
  <div class="meta">
    <div class="row"><span class="label">Reference #</span><span>${expense.expenseNumber}</span></div>
    <div class="row"><span class="label">Date</span><span>${new Date(expense.createdAt).toLocaleString()}</span></div>
    <div class="row"><span class="label">Category</span><span>${categoryLabel[expense.category]}</span></div>
    <div class="row"><span class="label">Paid to</span><span>${recipientLabel(expense)}</span></div>
    <div class="row"><span class="label">Status</span><span>Paid</span></div>
  </div>
  ${expense.description ? `<div class="desc"><span class="label">Description</span><br>${expense.description}</div>` : ''}
  <div class="amount-row"><span>Amount</span><span>${Number(expense.amount).toLocaleString()}</span></div>
  <div class="footer">
    <p>Paid by: ${personLabel(expense.createdBy)}</p>
  </div>
  <p class="thanks">This is an internal payment record.</p>
</body>
</html>`;
}

function downloadExpenseReceipt(expense: Expense) {
  const html = buildExpenseReceiptHtml(expense);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payment-receipt-${expense.expenseNumber}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** View/Print/Download receipt modal for an expense payment - same mechanism as the sales Receipt (shared #receipt-print-area print CSS), separate markup since the data shape differs. */
export function ExpenseReceiptModal({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Payment Receipt"
      footer={
        <>
          <Button variant="outline" onClick={() => downloadExpenseReceipt(expense)}>
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <ExpenseReceiptContent expense={expense} />
    </Modal>
  );
}
