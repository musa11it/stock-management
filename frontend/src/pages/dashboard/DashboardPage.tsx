import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Package, DollarSign, AlertTriangle, ShoppingCart, Receipt, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { fetchDashboardSummary, fetchNetProfit } from '@/services/dashboard.service';
import { getErrorMessage } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import type { NetProfitPeriod } from '@/types';

const PERIOD_OPTIONS: { value: NetProfitPeriod; label: string }[] = [
  { value: 'TODAY', label: 'Today' },
  { value: 'WEEK', label: 'This Week' },
  { value: 'MONTH', label: 'This Month' },
  { value: 'YEAR', label: 'This Year' },
  { value: 'ALL', label: 'All Time' },
];

export default function DashboardPage() {
  const [netProfitPeriod, setNetProfitPeriod] = useState<NetProfitPeriod>('TODAY');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardSummary,
    refetchInterval: 60_000,
  });

  // A prefix of the ['dashboard'] key, so every existing invalidateQueries({ queryKey: ['dashboard'] })
  // call (sales, wastage, purchases, adjustments, expenses, ...) already refreshes this too -
  // no page had to change to satisfy "update automatically".
  const {
    data: netProfit,
    isLoading: isNetProfitLoading,
    isFetching: isNetProfitFetching,
    isError: isNetProfitError,
    error: netProfitError,
    refetch: refetchNetProfit,
  } = useQuery({
    queryKey: ['dashboard', 'net-profit', netProfitPeriod],
    queryFn: () => fetchNetProfit(netProfitPeriod),
    refetchInterval: 60_000,
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={getErrorMessage(error)} onRetry={refetch} />;

  const chartData = data.salesOverview
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }));

  return (
    <div>
      <PageHeader title="Dashboard" description="A real-time snapshot of your restaurant's inventory and operations." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's profit"
          value={data.todayProfit.profit.toLocaleString()}
          subtext={`Revenue ${data.todayProfit.revenue.toLocaleString()} − Cost ${data.todayProfit.cogs.toLocaleString()}`}
          icon={data.todayProfit.profit >= 0 ? TrendingUp : TrendingDown}
          tone={data.todayProfit.profit >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="Today's sales"
          value={data.todaySales.total.toLocaleString()}
          subtext={`${data.todaySales.count} transactions`}
          icon={Receipt}
          tone="purple"
        />
        <StatCard label="Active products" value={String(data.totalProducts)} icon={Package} tone="brand" />
        <StatCard label="Low stock alerts" value={String(data.lowStockCount)} icon={AlertTriangle} tone="red" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Inventory value" value={data.inventoryValue.toLocaleString()} icon={DollarSign} tone="green" />
        <StatCard
          label="Today's purchases"
          value={data.todayPurchases.total.toLocaleString()}
          subtext={`${data.todayPurchases.count} orders`}
          icon={ShoppingCart}
          tone="brand"
        />
        <StatCard
          label="Today's wastage"
          value={String(data.todayWastage.quantity)}
          subtext={`${data.todayWastage.count} reports`}
          icon={Trash2}
          tone="amber"
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>What today's profit is made of</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4 text-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Revenue</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{data.todayProfit.revenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ingredient cost</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">-{data.todayProfit.cogs.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Profit</p>
              <p className={`mt-1 text-lg font-semibold ${data.todayProfit.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {data.todayProfit.profit.toLocaleString()}
              </p>
            </div>
          </div>

          {data.todayIngredientUsage.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">No completed orders yet today - ingredient usage will appear here.</p>
          ) : (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Ingredients used today, by cost</p>
              <div className="space-y-2">
                {data.todayIngredientUsage.map((row) => (
                  <div key={row.productId} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">
                      {row.productName} <span className="text-slate-400">· {row.quantity.toFixed(2)} {row.unit}</span>
                    </span>
                    <span className="font-medium text-slate-900">{row.cost.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Net Profit</CardTitle>
          <div className="flex flex-wrap justify-end gap-1.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setNetProfitPeriod(opt.value)}
                aria-pressed={netProfitPeriod === opt.value}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  netProfitPeriod === opt.value
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isNetProfitLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="skeleton h-5 w-full" />
              ))}
            </div>
          ) : isNetProfitError || !netProfit ? (
            <ErrorState message={getErrorMessage(netProfitError)} onRetry={refetchNetProfit} />
          ) : (
            <div className={cn('space-y-2 text-sm transition-opacity', isNetProfitFetching && 'opacity-60')}>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Gross profit (revenue − ingredient cost)</span>
                <span className="font-medium text-slate-900">{netProfit.grossProfit.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Wastage / damaged stock</span>
                <span className="font-medium text-red-600">-{netProfit.wastageCost.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Internal consumption</span>
                <span className="font-medium text-red-600">-{netProfit.consumptionCost.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Stock adjustments (decrease)</span>
                <span className="font-medium text-red-600">-{netProfit.adjustmentLossCost.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Stock adjustments (increase)</span>
                <span className="font-medium text-emerald-600">+{netProfit.adjustmentGainValue.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Expenses</span>
                <span className="font-medium text-red-600">-{netProfit.expenseCost.toLocaleString()}</span>
              </div>

              <div
                className={cn(
                  'mt-3 flex flex-col items-start justify-between gap-1 rounded-xl border-t-0 p-4 sm:flex-row sm:items-center',
                  netProfit.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50',
                )}
              >
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Net Profit · {PERIOD_OPTIONS.find((o) => o.value === netProfitPeriod)?.label}
                  </span>
                </div>
                <span className={cn('text-3xl font-bold tracking-tight sm:text-4xl', netProfit.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {netProfit.netProfit.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales overview (last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <EmptyState title="No sales yet" description="Sales from the last 7 days will appear here." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                      formatter={(value) => [Number(value).toLocaleString(), 'Sales']}
                    />
                    <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} fill="url(#salesFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low stock products</CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 space-y-3 overflow-y-auto">
            {data.lowStockProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">All products are well stocked.</p>
            ) : (
              data.lowStockProducts.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{inv.product.name}</p>
                    <p className="text-xs text-slate-400">{inv.warehouse.name}</p>
                  </div>
                  <Badge tone="red">
                    {Number(inv.quantity)} {inv.product.unit.abbreviation}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent stock movements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentStockMovements.length === 0 ? (
            <EmptyState title="No stock movements yet" />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Product</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium">Quantity</th>
                  <th className="px-5 py-2.5 font-medium">By</th>
                  <th className="px-5 py-2.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentStockMovements.map((m) => (
                  <tr key={m.id}>
                    <td className="px-5 py-2.5 font-medium text-slate-800">{m.product.name}</td>
                    <td className="px-5 py-2.5">
                      <Badge tone="slate">{m.type.replace('_', ' ')}</Badge>
                    </td>
                    <td className={`px-5 py-2.5 ${Number(m.quantity) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {Number(m.quantity) >= 0 ? '+' : ''}
                      {Number(m.quantity)} {m.product.unit.abbreviation}
                    </td>
                    <td className="px-5 py-2.5 text-slate-500">
                      {m.createdBy.firstName} {m.createdBy.lastName}
                    </td>
                    <td className="px-5 py-2.5 text-slate-400">{new Date(m.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
