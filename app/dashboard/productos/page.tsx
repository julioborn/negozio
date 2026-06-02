'use client';

import { useCallback, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, Package, Plus, Sparkles } from 'lucide-react';

import { BarcodeInput } from '@/components/products/BarcodeInput';
import { ProductFilters } from '@/components/products/ProductFilters';
import { ProductTable } from '@/components/products/ProductTable';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import { lookupBarcode, type ExternalProductData } from '@/lib/utils/barcode-lookup';
import type { EstablishmentProductDetail } from '@/types/database';

export default function ProductosPage() {
  const router = useRouter();
  const { user, can } = useAuth();
  const establishmentId = user?.establishment_id ?? null;

  const {
    items, total, page, pageSize, setPage,
    isLoading, error,
    search, setSearch,
    categoryFilter, setCategoryFilter,
    lowStockOnly, setLowStockOnly,
    searchByBarcode,
    updatePrice,
    deleteProduct,
  } = useProducts(establishmentId);

  const [scanSearching, setScanSearching] = useState(false);
  const [foundProduct, setFoundProduct] = useState<EstablishmentProductDetail | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [externalLookup, setExternalLookup] = useState<ExternalProductData | null>(null);
  const [lookingUpExternal, setLookingUpExternal] = useState(false);

  const canEditPrice = can('products.edit');

  const handleBarcodeDetect = useCallback(
    (barcode: string) => {
      if (barcode.length > 20 || barcode.includes(' ')) {
        setSearch(barcode);
        return;
      }

      setScanSearching(true);
      setFoundProduct(null);
      setNotFoundBarcode(null);
      setExternalLookup(null);

      // Envolvemos todo en un bloque async aislado con su propio try/catch
      // para que ningún error llegue al error boundary global
      void (async () => {
        try {
          const result = await searchByBarcode(barcode);
          setScanSearching(false);

          if (result) {
            setFoundProduct(result);
            setSearch(barcode);
          } else {
            setNotFoundBarcode(barcode);
            setLookingUpExternal(true);
            try {
              const ext = await lookupBarcode(barcode);
              setExternalLookup(ext);
            } catch {
              setExternalLookup(null);
            } finally {
              setLookingUpExternal(false);
            }
          }
        } catch {
          setScanSearching(false);
          setNotFoundBarcode(barcode);
        }
      })();
    },
    [searchByBarcode, setSearch]
  );

  // Si no hay establecimiento configurado
  if (!establishmentId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="mb-4 h-12 w-12 text-slate-300" />
        <h2 className="text-lg font-semibold text-slate-700">
          No hay establecimiento configurado
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Completá el setup inicial en Supabase para vincular tu cuenta con un establecimiento.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Productos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Catálogo de productos del establecimiento
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/productos/nuevo')}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo producto
        </button>
      </div>

      {/* ── Scanner de barras ────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Buscar por código
        </p>
        <BarcodeInput
          onDetect={handleBarcodeDetect}
          isSearching={scanSearching}
          placeholder="Código de barras o nombre del producto…"
        />

        {/* Producto encontrado */}
        {foundProduct && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
            <span className="text-green-600">✓</span>
            <div className="flex-1 text-sm">
              <span className="font-medium text-green-800">{foundProduct.name}</span>
              {foundProduct.brand && (
                <span className="ml-1 text-green-600">· {foundProduct.brand}</span>
              )}
            </div>
            <span className="text-sm font-medium text-green-800">
              Stock: {foundProduct.stock}
            </span>
            <button
              onClick={() => setFoundProduct(null)}
              className="text-green-400 hover:text-green-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* Producto NO encontrado → ir a crear */}
        {notFoundBarcode && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-amber-600">⚠</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-800">
                  Código <code className="font-mono font-medium">{notFoundBarcode}</code> no está en tu catálogo.
                </p>
                {/* Resultado del lookup externo */}
                {lookingUpExternal && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Buscando en base de datos externa…
                  </p>
                )}
                {!lookingUpExternal && externalLookup && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-green-700">
                    <Sparkles className="h-3 w-3" />
                    Encontrado en Open Food Facts: <strong>{externalLookup.name}</strong>
                    {externalLookup.brand && ` · ${externalLookup.brand}`}
                    <span className="text-green-600">— se prellenará el formulario</span>
                  </p>
                )}
                {!lookingUpExternal && !externalLookup && (
                  <p className="mt-0.5 text-xs text-amber-500">No encontrado en bases de datos externas.</p>
                )}
              </div>
              <button
                onClick={() =>
                  router.push(
                    `/dashboard/productos/nuevo?barcode=${encodeURIComponent(notFoundBarcode)}`
                  )
                }
                  className="whitespace-nowrap rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                {externalLookup ? '✦ Cargar con datos' : 'Cargar producto'}
              </button>
              <button
                onClick={() => { setNotFoundBarcode(null); setExternalLookup(null); }}
                className="text-amber-400 hover:text-amber-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Filtros ──────────────────────────────────────────── */}
      <ProductFilters
        search={search}
        onSearchChange={setSearch}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        lowStockOnly={lowStockOnly}
        onLowStockChange={setLowStockOnly}
        total={total}
        isLoading={isLoading}
      />

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Tabla ────────────────────────────────────────────── */}
      <ProductTable
        items={items}
        total={total}
        page={page}
        pageSize={pageSize}
        isLoading={isLoading}
        canEditPrice={canEditPrice}
        onPageChange={setPage}
        onPriceSave={updatePrice}
        onDelete={deleteProduct}
      />
    </div>
  );
}
