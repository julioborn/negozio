import { z } from 'zod';

import type { PaymentMethod, SaleChannel } from '@/types/database';

export const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1, 'La cantidad debe ser mayor a 0'),
  unit_price: z.number().min(0),
  discount: z.number().min(0).max(100).default(0),
});

export const saleSchema = z.object({
  channel: z.enum(['local', 'mercadolibre', 'instagram', 'whatsapp', 'other'] as [
    SaleChannel,
    ...SaleChannel[],
  ]),
  customer_name: z.string().max(200).optional(),
  customer_phone: z.string().max(20).optional(),
  discount: z.number().min(0).max(100).default(0),
  payment_method: z.enum(['cash', 'card', 'transfer', 'mercadopago', 'other'] as [
    PaymentMethod,
    ...PaymentMethod[],
  ]),
  notes: z.string().max(1000).optional(),
  items: z.array(saleItemSchema).min(1, 'La venta debe tener al menos un producto'),
});

export type SaleFormData = z.infer<typeof saleSchema>;
export type SaleItemFormData = z.infer<typeof saleItemSchema>;
