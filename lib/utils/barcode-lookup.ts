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
  // Trabajamos en minúsculas pero CONSERVAMOS espacios para \b
  const q = quantity.toLowerCase().trim();

  // Pack / multi-unidad: "6 x 150 ml", "4x200g", "pack de 6"
  if (/\d+\s*x\s*\d/.test(q) || /pack/.test(q)) return 'pack';

  // Litros — chequeamos antes de 'g' para que 'ml' no quede sin match
  if (/litr[eo]/.test(q)) return 'liter';
  if (/[\d.,]+\s*(ml|cl|dl)\b/.test(q)) return 'liter';
  if (/[\d.,]+\s*l\b/.test(q)) return 'liter';   // "1 l", "1.5 l"

  // Kilogramos
  if (/[\d.,]+\s*kg\b/.test(q) || /\bkilo/.test(q)) return 'kg';

  // Gramos — el más común; si ≥ 1000 g lo mapeamos a kg
  const gramMatch = q.match(/[\d.,]+(?=\s*gr?\b)/);
  if (gramMatch) {
    const grams = parseFloat(gramMatch[0].replace(',', '.'));
    return grams >= 1000 ? 'kg' : 'gram';
  }

  // Unidades explícitas
  if (/\b(unit|unidad|ud\.?|pcs|pieza|each)\b/.test(q)) return 'unit';

  return null;
}

// ─── Función principal ────────────────────────────────────────

export async function lookupBarcode(barcode: string): Promise<ExternalProductData | null> {
  if (!barcode || barcode.length < 6) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const FIELDS = 'product_name,product_name_es,product_name_en,generic_name,generic_name_es,brands,image_front_url,quantity';

    // Intentar primero con world (cubre todos los países incluyendo Argentina)
    let res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=${FIELDS}`,
      { signal: controller.signal, cache: 'no-store', headers: { 'User-Agent': 'Negozio-POS/1.0' } }
    );

    // Fallback: endpoint v0 (estructura diferente, a veces tiene más datos)
    if (!res.ok || res.status === 404) {
      res = await fetch(
        `https://world.openfoodfacts.org/cgi/get_product.pl?code=${encodeURIComponent(barcode)}&json=1&fields=${FIELDS}`,
        { signal: controller.signal, cache: 'no-store', headers: { 'User-Agent': 'Negozio-POS/1.0' } }
      );
    }

    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = await res.json();
    if ((data.status !== 1 && data.status !== '1') || !data.product) return null;

    const p = data.product;
    const name = (
      p.product_name_es ||
      p.product_name ||
      p.product_name_en ||
      p.generic_name_es ||
      p.generic_name ||
      ''
    ).trim();
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
