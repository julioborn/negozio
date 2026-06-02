/**
 * Búsqueda externa de productos por código de barras.
 * API: Open Food Facts (gratis, sin API key, buena cobertura en Argentina).
 *
 * Formatos de barcode que detecta html5-qrcode:
 *   EAN-13 (13 dígitos) — consumo masivo Argentina/mundo
 *   EAN-8  (8 dígitos)  — envases pequeños
 *   UPC-A  (12 dígitos) — productos importados de EE.UU.
 *   Code-128             — logística / industrial
 *   QR Code              — cualquier QR estándar
 */

import type { UnitType } from '@/types/database';

export interface ExternalProductData {
  name:      string;
  brand:     string | null;
  imageUrl:  string | null;
  quantity:  string | null;   // ej: "500 g", "1 L", "6 x 150 ml"
  unitType:  UnitType | null; // mapeado a nuestros tipos
  source:    'open_food_facts';
}

// ─── Mapeo de unidades de OFF → nuestros UnitType ────────────

function parseUnitType(quantity: string | null | undefined): UnitType | null {
  if (!quantity) return null;
  const q = quantity.toLowerCase().replace(/\s+/g, '');

  if (/\d+\s*x\s*/.test(q))       return 'pack';   // "6 x 150ml", "4 x 200g"
  if (/kg|kilo/.test(q))          return 'kg';
  if (/\d+(ml|cl|dl|l|lt|ltr|litro)/.test(q)) return 'liter';
  if (/\d+\s*g(r|rs|ramos)?/.test(q)) {
    // Si es más de 1000g lo reportamos como kg, si no como gram
    const match = q.match(/(\d+(?:[.,]\d+)?)\s*g/);
    if (match) {
      const grams = parseFloat(match[1]!.replace(',', '.'));
      return grams >= 1000 ? 'kg' : 'gram';
    }
    return 'gram';
  }
  if (/unidad|unit|pcs|pieza|ud/.test(q)) return 'unit';

  return null;
}

// ─── Función principal ────────────────────────────────────────

export async function lookupBarcode(barcode: string): Promise<ExternalProductData | null> {
  if (!barcode || barcode.length < 6) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
        `?fields=product_name,product_name_es,brands,image_front_url,image_url,quantity`,
      {
        signal: controller.signal,
        cache:  'no-store',
        headers: { 'User-Agent': 'Negozio-POS/1.0 (contacto@negozio.app)' },
      }
    );

    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const name = (p.product_name_es || p.product_name || '').trim();
    if (!name) return null;

    const quantity = (p.quantity as string | null)?.trim() || null;

    return {
      name,
      brand:    p.brands ? (p.brands as string).split(',')[0]?.trim() || null : null,
      imageUrl: (p.image_front_url || p.image_url || null) as string | null,
      quantity,
      unitType: parseUnitType(quantity),
      source:   'open_food_facts',
    };
  } catch {
    return null;
  }
}
