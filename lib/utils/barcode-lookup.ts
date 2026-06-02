/**
 * Búsqueda externa de productos por código de barras.
 * Usa Open Food Facts (gratis, sin API key, buena cobertura en Argentina).
 * Docs: https://wiki.openfoodfacts.org/API
 */

export interface ExternalProductData {
  name:     string;
  brand:    string | null;
  imageUrl: string | null;
  source:   'open_food_facts';
}

/**
 * Busca un producto por código de barras en Open Food Facts.
 * Retorna null si no se encuentra o si la API falla.
 * Timeout de 6 segundos para no bloquear al usuario.
 */
export async function lookupBarcode(barcode: string): Promise<ExternalProductData | null> {
  if (!barcode || barcode.length < 6) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
      `?fields=product_name,product_name_es,brands,image_front_url,image_url`,
      {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          // Identificar la app según las guías de OFF
          'User-Agent': 'Negozio-POS/1.0 (contacto@negozio.app)',
        },
      }
    );

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();

    // status 1 = producto encontrado
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;

    // Preferir nombre en español si existe
    const name = (p.product_name_es || p.product_name || '').trim();
    if (!name) return null;

    return {
      name,
      brand:    p.brands ? p.brands.split(',')[0]?.trim() || null : null,
      imageUrl: p.image_front_url || p.image_url || null,
      source:   'open_food_facts',
    };
  } catch {
    // Timeout, red caída, etc. — no interrumpir el flujo del usuario
    return null;
  }
}
