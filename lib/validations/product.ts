import { z } from 'zod';

// Nota: los inputs numéricos del formulario usan { valueAsNumber: true }
// en react-hook-form, por lo que llegan como number, no string.
// Usamos z.number() (sin coerce) para que los tipos de input y output coincidan,
// condición necesaria para que @hookform/resolvers v5 + Zod v4 sean compatibles.

export const newProductSchema = z.object({
  barcode: z
    .string()
    .min(1, 'El código de barras es requerido')
    .max(50, 'Máximo 50 caracteres'),

  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(200, 'Máximo 200 caracteres'),

  brand: z.string().max(100, 'Máximo 100 caracteres').optional(),

  net_content: z.string().max(50).optional(),   // ej: "475 g", "1 L"

  category_id: z.string().uuid('Categoría inválida').nullable().optional(),

  unit_type: z.enum(['unit', 'kg', 'liter', 'pack', 'gram']),

  price: z
    .number({ error: 'Ingresá un precio válido' })
    .min(0.01, 'El precio debe ser mayor a 0'),

  cost_price: z
    .number({ error: 'Ingresá un precio válido' })
    .min(0, 'El costo no puede ser negativo')
    .nullable()
    .optional(),

  initial_stock: z
    .number({ error: 'Ingresá una cantidad válida' })
    .int('Debe ser un número entero')
    .min(0, 'No puede ser negativo')
    .optional(),

  stock_min_alert: z
    .number({ error: 'Ingresá una cantidad válida' })
    .int('Debe ser un número entero')
    .min(0, 'No puede ser negativo')
    .optional(),

  image_url: z.string().url().nullable().optional(),
});

export const inlinePriceSchema = z.object({
  price: z
    .number({ error: 'Precio inválido' })
    .min(0.01, 'El precio debe ser mayor a 0'),
});

export const stockUpdateSchema = z.object({
  establishment_product_id: z.string().uuid(),
  quantity: z.number({ error: 'Cantidad inválida' }).int('Debe ser un número entero'),
  notes: z.string().max(500).optional(),
});

export type NewProductFormData = z.infer<typeof newProductSchema>;
export type InlinePriceFormData = z.infer<typeof inlinePriceSchema>;
export type StockUpdateFormData = z.infer<typeof stockUpdateSchema>;
