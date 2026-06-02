'use client';

import { AlertTriangle, ChevronDown } from 'lucide-react';

import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  categoryFilter: string | null;
  onCategoryChange: (id: string | null) => void;
  lowStockOnly: boolean;
  onLowStockChange: (v: boolean) => void;
  total: number;
  isLoading: boolean;
}

export function ProductFilters({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  lowStockOnly,
  onLowStockChange,
  total,
  isLoading,
}: Props) {
  const { categories } = useCategories();

  return (
    <div className="flex flex-wrap items-center gap-3">

      {/* Selector de categoría */}
      <div className="relative">
        <select
          value={categoryFilter ?? ''}
          onChange={(e) => onCategoryChange(e.target.value || null)}
          className="
            appearance-none rounded-lg border border-slate-300 bg-white
            py-2 pl-3 pr-8 text-sm text-slate-700
            focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500
          "
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {/* Toggle stock bajo */}
      <button
        onClick={() => onLowStockChange(!lowStockOnly)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
          lowStockOnly
            ? 'border-red-300 bg-red-50 text-red-700'
            : 'border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-600'
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Stock bajo
      </button>

      {/* Contador de resultados */}
      {!isLoading && (
        <span className="ml-auto text-sm text-slate-500">
          {total === 0
            ? 'Sin resultados'
            : total === 1
            ? '1 producto'
            : `${total} productos`}
        </span>
      )}
    </div>
  );
}
