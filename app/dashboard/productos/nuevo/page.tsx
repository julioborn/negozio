'use client';

import { Suspense } from 'react';

import { useSearchParams, useRouter } from 'next/navigation';

import { ArrowLeft, Loader2 } from 'lucide-react';

import { ProductForm } from '@/components/products/ProductForm';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';

// Componente inner que usa useSearchParams — debe estar dentro de <Suspense>
function NuevoProductoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBarcode = searchParams.get('barcode') ?? '';

  const { user } = useAuth();
  const establishmentId = user?.establishment_id ?? null;
  const { createProduct } = useProducts(establishmentId);

  if (!establishmentId) {
    return (
      <p className="text-sm text-slate-500">No hay establecimiento configurado.</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a productos
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">Nuevo producto</h1>
          {initialBarcode && (
            <p className="mt-1 text-sm text-slate-500">
              Código de barras:{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                {initialBarcode}
              </code>
            </p>
          )}
        </div>

        <ProductForm
          establishmentId={establishmentId}
          initialBarcode={initialBarcode}
          onSave={createProduct}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}

export default function NuevoProductoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <NuevoProductoContent />
    </Suspense>
  );
}
