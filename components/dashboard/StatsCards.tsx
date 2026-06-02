import { AlertTriangle, ArrowRight, BarChart3, Receipt, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { formatCurrency } from '@/lib/utils';
import type { DashboardStats } from '@/hooks/useDashboard';

interface Props {
  stats: DashboardStats | null;
  isLoading: boolean;
}

export function StatsCards({ stats, isLoading }: Props) {
  const cards = [
    {
      label: 'Ventas del período',
      value: formatCurrency(stats?.totalSales ?? 0),
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Transacciones',
      value: (stats?.transactionCount ?? 0).toString(),
      icon: Receipt,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Ticket promedio',
      value: formatCurrency(stats?.avgTicket ?? 0),
      icon: BarChart3,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Stock bajo',
      value: (stats?.lowStockCount ?? 0).toString(),
      icon: AlertTriangle,
      color: stats?.lowStockCount ? 'text-red-600' : 'text-slate-500',
      bg: stats?.lowStockCount ? 'bg-red-50' : 'bg-slate-50',
      action: stats?.lowStockCount
        ? { href: '/dashboard/productos?lowStock=true', label: 'Ver productos' }
        : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            {card.action && (
              <Link
                href={card.action.href}
                className="flex items-center gap-1 text-xs text-red-600 hover:underline"
              >
                {card.action.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-2">
              <div className="h-7 w-24 animate-pulse rounded bg-slate-100" />
              <div className="h-3.5 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{card.value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{card.label}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
