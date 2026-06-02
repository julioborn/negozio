'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, ImagePlus, Loader2, Package, Save, Search, Sparkles, X } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { useCategories } from '@/hooks/useCategories';
import { createClient } from '@/lib/supabase/client';
import { lookupBarcode, type ExternalProductData } from '@/lib/utils/barcode-lookup';
import { newProductSchema, type NewProductFormData } from '@/lib/validations/product';
import { cn } from '@/lib/utils';

const UNIT_OPTIONS = [
  { value: 'unit',  label: 'Unidad' },
  { value: 'kg',    label: 'Kilogramo (kg)' },
  { value: 'liter', label: 'Litro' },
  { value: 'pack',  label: 'Pack / caja' },
  { value: 'gram',  label: 'Gramo' },
] as const;

interface Props {
  establishmentId: string;
  initialBarcode?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  onSave: (data: NewProductFormData) => Promise<void>;
}

export function ProductForm({
  establishmentId,
  initialBarcode = '',
  onSuccess,
  onCancel,
  onSave,
}: Props) {
  const router = useRouter();
  const { categories } = useCategories();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [externalData, setExternalData] = useState<ExternalProductData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NewProductFormData>({
    resolver: zodResolver(newProductSchema),
    defaultValues: {
      barcode: initialBarcode,
      unit_type: 'unit',
      initial_stock: 0,
      stock_min_alert: 5,
    },
  });

  // ── Lookup automático cuando llega un barcode externo ────────
  useEffect(() => {
    if (!initialBarcode) return;
    triggerLookup(initialBarcode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBarcode]);

  async function triggerLookup(barcode: string) {
    if (!barcode) return;
    setLookingUp(true);
    setExternalData(null);
    const result = await lookupBarcode(barcode);
    setLookingUp(false);

    if (!result) return;

    setExternalData(result);
    // Pre-llenar el formulario con los datos encontrados
    setValue('name',     result.name,           { shouldDirty: true });
    if (result.brand)    setValue('brand',       result.brand,          { shouldDirty: true });
    if (result.imageUrl) setValue('image_url',   result.imageUrl,       { shouldDirty: true });
    setImagePreview(result.imageUrl);
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview local inmediato
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload a Supabase Storage
    setUploadingImage(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${establishmentId}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true });

      if (!error) {
        const { data } = supabase.storage.from('product-images').getPublicUrl(path);
        setValue('image_url', data.publicUrl);
      }
    } finally {
      setUploadingImage(false);
    }
  }

  function removeImage() {
    setImagePreview(null);
    setValue('image_url', null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onSubmit(data: NewProductFormData) {
    await onSave(data);
    onSuccess ? onSuccess() : router.push('/dashboard/productos');
  }

  const barcodeValue = watch('barcode');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">

      {/* ── Banner: datos encontrados en Open Food Facts ─────── */}
      {lookingUp && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Buscando en base de datos externa…
        </div>
      )}

      {!lookingUp && externalData && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          <div className="flex-1">
            <p className="font-medium text-green-800">
              Datos encontrados en Open Food Facts
            </p>
            <p className="text-green-600">
              Se prellenó nombre, marca e imagen. Revisá y completá el precio.
            </p>
          </div>
          <a
            href={`https://world.openfoodfacts.org/product/${barcodeValue}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-green-600 hover:text-green-800"
            title="Ver en Open Food Facts"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* ── Identificación ──────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Código de barras *"
          error={errors.barcode?.message}
        >
          {/* Input + botón de búsqueda manual */}
          <div className="flex gap-2">
            <input
              {...register('barcode')}
              placeholder="7790001234567"
              autoComplete="off"
              className={cn(inputClass(!!errors.barcode), 'flex-1')}
            />
            <button
              type="button"
              onClick={() => triggerLookup(barcodeValue ?? '')}
              disabled={lookingUp || !barcodeValue}
              title="Buscar en Open Food Facts"
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white
                         px-3 text-sm text-slate-600 hover:border-blue-400 hover:bg-blue-50
                         hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {lookingUp
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Search className="h-4 w-4" />
              }
            </button>
          </div>
        </Field>

        <Field label="Nombre *" error={errors.name?.message}>
          <input
            {...register('name')}
            placeholder="Leche entera 1L"
            className={inputClass(!!errors.name)}
          />
        </Field>

        <Field label="Marca / empresa" error={errors.brand?.message}>
          <input
            {...register('brand')}
            placeholder="La Serenísima"
            className={inputClass(!!errors.brand)}
          />
        </Field>

        <Field label="Categoría" error={errors.category_id?.message}>
          <select
            {...register('category_id')}
            className={inputClass(!!errors.category_id)}
          >
            <option value="">Sin categoría</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Unidad de medida *" error={errors.unit_type?.message}>
          <select {...register('unit_type')} className={inputClass(!!errors.unit_type)}>
            {UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </section>

      {/* ── Precios ─────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Precios</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Precio de venta *" error={errors.price?.message}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                {...register('price', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className={cn(inputClass(!!errors.price), 'pl-7')}
              />
            </div>
          </Field>

          <Field
            label="Precio de costo"
            hint="Opcional — para calcular margen"
            error={errors.cost_price?.message}
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                {...register('cost_price', { valueAsNumber: true, setValueAs: (v) => (v === '' || isNaN(v) ? null : Number(v)) })}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className={cn(inputClass(!!errors.cost_price), 'pl-7')}
              />
            </div>
          </Field>
        </div>
      </section>

      {/* ── Stock ───────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Stock</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Stock inicial" error={errors.initial_stock?.message}>
            <input
              {...register('initial_stock', { valueAsNumber: true })}
              type="number"
              min="0"
              step="1"
              placeholder="0"
              className={inputClass(!!errors.initial_stock)}
            />
          </Field>

          <Field
            label="Alerta de stock mínimo"
            hint="Se mostrará un aviso cuando el stock baje de este número"
            error={errors.stock_min_alert?.message}
          >
            <input
              {...register('stock_min_alert', { valueAsNumber: true })}
              type="number"
              min="0"
              step="1"
              placeholder="5"
              className={inputClass(!!errors.stock_min_alert)}
            />
          </Field>
        </div>
      </section>

      {/* ── Imagen ──────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Imagen (opcional)</h3>
        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
            {imagePreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute right-1 top-1 rounded-full bg-white/80 p-0.5 text-slate-600 shadow hover:bg-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <Package className="h-8 w-8 text-slate-300" />
            )}
            {uploadingImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            )}
          </div>

          {/* Botón de subida */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="hidden"
              id="product-image-input"
            />
            <label
              htmlFor="product-image-input"
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-blue-400 hover:text-blue-600"
            >
              <ImagePlus className="h-4 w-4" />
              Subir imagen
            </label>
            <p className="mt-1 text-xs text-slate-400">JPG, PNG o WebP · máx 5 MB</p>
          </div>
        </div>
      </section>

      {/* ── Acciones ─────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || uploadingImage}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSubmitting ? 'Guardando…' : 'Guardar producto'}
        </button>
      </div>
    </form>
  );
}

// ─── Helpers de UI ───────────────────────────────────────────
function inputClass(hasError: boolean) {
  return cn(
    'block w-full rounded-lg border px-3 py-2 text-sm text-slate-900',
    'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1',
    'disabled:cursor-not-allowed disabled:bg-slate-50',
    hasError
      ? 'border-red-400 focus:ring-red-400'
      : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
  );
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
