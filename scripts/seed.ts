#!/usr/bin/env tsx
/**
 * Script de datos de prueba — Negozio
 *
 * Uso:
 *   npx tsx scripts/seed.ts
 *
 * Requisitos previos:
 *   1. Tener .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 *   2. Haber ejecutado en Supabase SQL Editor (en orden):
 *      - supabase/setup.sql
 *      - supabase/products_setup.sql
 *      - supabase/stock_setup.sql
 *      - supabase/sales_setup.sql
 *      - supabase/external_sales_setup.sql
 *      - supabase/dashboard_setup.sql
 *      - supabase/triggers_setup.sql
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Datos del seed ───────────────────────────────────────────

const DEMO_USERS = [
  { email: 'owner@demo.com',    password: 'demo1234', full_name: 'Julio Born',         role: 'owner'    },
  { email: 'caja@demo.com',     password: 'demo1234', full_name: 'María López',        role: 'cashier'  },
  { email: 'empleado@demo.com', password: 'demo1234', full_name: 'Carlos Rodríguez',   role: 'employee' },
];

interface ProductSeed {
  barcode: string; name: string; brand: string; category: string;
  unit: string; price: number; cost: number; stock: number; minAlert: number;
}

const PRODUCTS: ProductSeed[] = [
  // Almacén
  { barcode: '7790580001230', name: 'Arroz largo fino 1kg',   brand: 'Gallo',          category: 'almacen',   unit: 'kg',    price: 320,  cost: 220, stock: 50, minAlert: 10 },
  { barcode: '7790001123456', name: 'Fideos tallarines 500g', brand: 'Matarazzo',      category: 'almacen',   unit: 'pack',  price: 280,  cost: 190, stock: 40, minAlert: 8  },
  { barcode: '7793940001104', name: 'Aceite girasol 900ml',   brand: 'Cocinero',       category: 'almacen',   unit: 'liter', price: 850,  cost: 620, stock: 30, minAlert: 5  },
  { barcode: '7790580234567', name: 'Azúcar 1kg',             brand: 'Ledesma',        category: 'almacen',   unit: 'kg',    price: 290,  cost: 195, stock: 45, minAlert: 10 },
  { barcode: '7790001345678', name: 'Harina 000 1kg',         brand: 'Cañuelas',       category: 'almacen',   unit: 'kg',    price: 350,  cost: 240, stock: 35, minAlert: 8  },
  // Bebidas
  { barcode: '7790895001234', name: 'Gaseosa Cola 2.25L',     brand: 'Coca-Cola',      category: 'bebidas',   unit: 'liter', price: 980,  cost: 700, stock: 60, minAlert: 12 },
  { barcode: '7790230001123', name: 'Agua mineral 2L',        brand: 'Villavicencio',  category: 'bebidas',   unit: 'liter', price: 420,  cost: 290, stock: 80, minAlert: 15 },
  { barcode: '7790440001234', name: 'Cerveza 473ml',          brand: 'Quilmes',        category: 'bebidas',   unit: 'unit',  price: 380,  cost: 260, stock: 100,minAlert: 20 },
  { barcode: '7790555001234', name: 'Jugo naranja 1L',        brand: 'Cepita',         category: 'bebidas',   unit: 'liter', price: 520,  cost: 360, stock: 35, minAlert: 8  },
  // Lácteos
  { barcode: '7790660001234', name: 'Leche entera 1L',        brand: 'La Serenísima',  category: 'lacteos',   unit: 'liter', price: 420,  cost: 295, stock: 90, minAlert: 20 },
  { barcode: '7790770001234', name: 'Yogur natural 200g',     brand: 'Danone',         category: 'lacteos',   unit: 'unit',  price: 280,  cost: 195, stock: 30, minAlert: 8  },
  { barcode: '7790880001234', name: 'Queso cremoso 200g',     brand: 'La Paulina',     category: 'lacteos',   unit: 'unit',  price: 650,  cost: 450, stock: 20, minAlert: 5  },
  // Limpieza
  { barcode: '7790990001234', name: 'Jabón en polvo 500g',    brand: 'Drive',          category: 'limpieza',  unit: 'pack',  price: 640,  cost: 440, stock: 25, minAlert: 5  },
  { barcode: '7791000001234', name: 'Lavandina 1L',           brand: 'Ayudín',         category: 'limpieza',  unit: 'liter', price: 380,  cost: 260, stock: 40, minAlert: 8  },
  { barcode: '7791100001234', name: 'Desengrasante 500ml',    brand: 'Magistral',      category: 'limpieza',  unit: 'liter', price: 480,  cost: 330, stock: 20, minAlert: 5  },
  // Higiene
  { barcode: '7791200001234', name: 'Shampoo 400ml',          brand: 'Pantene',        category: 'higiene',   unit: 'unit',  price: 920,  cost: 640, stock: 15, minAlert: 3  },
  { barcode: '7791300001234', name: 'Jabón de tocador 125g',  brand: 'Palmolive',      category: 'higiene',   unit: 'unit',  price: 180,  cost: 120, stock: 50, minAlert: 10 },
  { barcode: '7791400001234', name: 'Papel higiénico x4',     brand: 'Elite',          category: 'higiene',   unit: 'pack',  price: 520,  cost: 360, stock: 40, minAlert: 8  },
  // Golosinas
  { barcode: '7791500001234', name: 'Alfajor triple',         brand: 'Havanna',        category: 'golosinas', unit: 'unit',  price: 280,  cost: 190, stock: 60, minAlert: 12 },
  { barcode: '7791600001234', name: 'Chicles x10',            brand: 'Beldent',        category: 'golosinas', unit: 'pack',  price: 150,  cost: 100, stock: 80, minAlert: 15 },
];

// ─── Helpers ──────────────────────────────────────────────────

function log(msg: string)  { console.log(`  ${msg}`); }
function ok(msg: string)   { console.log(`  ✓ ${msg}`); }
function skip(msg: string) { console.log(`  → ${msg} (ya existe)`); }
function err(msg: string)  { console.error(`  ✗ ${msg}`); }

async function getOrCreateUser(userData: typeof DEMO_USERS[0]) {
  const { data: list } = await sb.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === userData.email);
  if (existing) {
    skip(`Usuario ${userData.email}`);
    return existing.id;
  }
  const { data, error } = await sb.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true,
  });
  if (error) { err(`Crear usuario ${userData.email}: ${error.message}`); return null; }
  ok(`Usuario ${userData.email} creado`);
  return data.user.id;
}

// ─── Main ─────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱  Iniciando seed de Negozio…\n');

  // ── 1. Usuarios ──────────────────────────────────────────
  console.log('👤  Usuarios');
  const userIds: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const id = await getOrCreateUser(u);
    if (id) userIds[u.role] = id;
  }

  const ownerId = userIds['owner'];
  if (!ownerId) { err('No se pudo obtener el owner. Abortando.'); process.exit(1); }

  // ── 2. Establecimiento ────────────────────────────────────
  console.log('\n🏪  Establecimiento');
  const { data: estExisting } = await sb
    .from('establishments')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle();

  let establishmentId: string;
  if (estExisting) {
    skip('Super Demo');
    establishmentId = estExisting.id;
  } else {
    const { data: est, error: estErr } = await sb
      .from('establishments')
      .insert({ name: 'Super Demo', owner_id: ownerId })
      .select('id')
      .single();
    if (estErr) { err(`Establecimiento: ${estErr.message}`); process.exit(1); }
    ok('Establecimiento "Super Demo" creado');
    establishmentId = est.id;
  }

  // ── 3. Perfiles ───────────────────────────────────────────
  console.log('\n👥  Perfiles');
  for (const u of DEMO_USERS) {
    const uid = userIds[u.role];
    if (!uid) continue;
    const { error: pErr } = await sb.from('profiles').upsert({
      id:               uid,
      email:            u.email,
      full_name:        u.full_name,
      role:             u.role,
      establishment_id: u.role === 'owner' ? establishmentId : establishmentId,
      is_active:        true,
    }, { onConflict: 'id' });
    if (pErr) err(`Perfil ${u.email}: ${pErr.message}`);
    else ok(`Perfil ${u.full_name} (${u.role})`);
  }

  // ── 4. Categorías (ya deben existir del products_setup.sql) ─
  console.log('\n📦  Categorías');
  const { data: cats } = await sb.from('product_categories').select('id, slug');
  if (!cats?.length) {
    err('No hay categorías. Ejecutá products_setup.sql primero.');
    process.exit(1);
  }
  const catMap = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
  ok(`${cats.length} categorías encontradas`);

  // ── 5. Productos ─────────────────────────────────────────
  console.log('\n🛒  Productos');
  const epIds: string[] = [];

  for (const p of PRODUCTS) {
    const categoryId = catMap[p.category] ?? null;

    // Upsert en products (catálogo global)
    const { data: prod, error: pErr } = await sb
      .from('products')
      .upsert(
        { barcode: p.barcode, name: p.name, brand: p.brand, category_id: categoryId,
          unit_type: p.unit, created_by: ownerId },
        { onConflict: 'barcode', ignoreDuplicates: false }
      )
      .select('id')
      .single();
    if (pErr) { err(`Producto ${p.name}: ${pErr.message}`); continue; }

    // Upsert en establishment_products
    const { data: ep, error: epErr } = await sb
      .from('establishment_products')
      .upsert(
        { establishment_id: establishmentId, product_id: prod.id,
          price: p.price, cost_price: p.cost, stock: p.stock, stock_min_alert: p.minAlert },
        { onConflict: 'establishment_id,product_id', ignoreDuplicates: false }
      )
      .select('id')
      .single();
    if (epErr) { err(`EstablishmentProduct ${p.name}: ${epErr.message}`); continue; }

    epIds.push(ep.id);
    ok(`${p.name}`);
  }

  // ── 6. Movimientos de stock de prueba ─────────────────────
  console.log('\n📊  Movimientos de stock');
  const movs = [
    { epId: epIds[0], qty: 50,  type: 'in',  reason: 'supplier',  prev: 50,  next: 100 },
    { epId: epIds[5], qty: 120, type: 'in',  reason: 'supplier',  prev: 60,  next: 180 },
    { epId: epIds[9], qty: 100, type: 'in',  reason: 'supplier',  prev: 90,  next: 190 },
    { epId: epIds[0], qty: 5,   type: 'out', reason: 'sale',       prev: 100, next: 95  },
    { epId: epIds[5], qty: 10,  type: 'out', reason: 'sale',       prev: 180, next: 170 },
  ] as const;

  for (const m of movs) {
    if (!m.epId) continue;
    const { error: mErr } = await sb.from('stock_movements').insert({
      establishment_product_id: m.epId,
      type: m.type, reason: m.reason,
      quantity: m.qty, previous_stock: m.prev, new_stock: m.next,
      created_by: ownerId,
    });
    if (mErr) err(`Movimiento: ${mErr.message}`);
    else ok(`Movimiento ${m.type}/${m.reason} qty=${m.qty}`);
  }

  // ── 7. Ventas de prueba ───────────────────────────────────
  console.log('\n💰  Ventas');
  const cashierId = userIds['cashier'] ?? ownerId;

  const salesData = [
    {
      sale_number: 'V-20250601-0001',
      payment_method: 'cash',
      subtotal: 1720, discount_pct: 0, total: 1720,
      amount_paid: 2000, change_given: 280,
      items: [
        { ep_id: epIds[0], name: 'Arroz largo fino 1kg',  barcode: '7790580001230', qty: 2, price: 320, disc: 0, sub: 640  },
        { ep_id: epIds[9], name: 'Leche entera 1L',        barcode: '7790660001234', qty: 2, price: 420, disc: 0, sub: 840  },
        { ep_id: epIds[5], name: 'Gaseosa Cola 2.25L',     barcode: '7790895001234', qty: 1, price: 980, disc: 10, sub: 882 },
      ],
    },
    {
      sale_number: 'V-20250601-0002',
      payment_method: 'card',
      subtotal: 1100, discount_pct: 0, total: 1100,
      amount_paid: null, change_given: null,
      items: [
        { ep_id: epIds[15], name: 'Shampoo 400ml',          barcode: '7791200001234', qty: 1, price: 920, disc: 0, sub: 920  },
        { ep_id: epIds[16], name: 'Jabón de tocador 125g',  barcode: '7791300001234', qty: 1, price: 180, disc: 0, sub: 180  },
      ],
    },
    {
      sale_number: 'V-20250601-0003',
      payment_method: 'transfer',
      subtotal: 430, discount_pct: 5, total: 408.5,
      amount_paid: null, change_given: null,
      items: [
        { ep_id: epIds[18], name: 'Alfajor triple',   barcode: '7791500001234', qty: 1, price: 280, disc: 0, sub: 280  },
        { ep_id: epIds[19], name: 'Chicles x10',      barcode: '7791600001234', qty: 1, price: 150, disc: 0, sub: 150  },
      ],
    },
  ];

  for (const sale of salesData) {
    // Verificar si ya existe
    const { data: existingSale } = await sb
      .from('sales')
      .select('id')
      .eq('establishment_id', establishmentId)
      .eq('sale_number', sale.sale_number)
      .maybeSingle();

    if (existingSale) { skip(`Venta ${sale.sale_number}`); continue; }

    const { data: newSale, error: sErr } = await sb
      .from('sales')
      .insert({
        establishment_id: establishmentId,
        cashier_id:       cashierId,
        sale_number:      sale.sale_number,
        channel:          'local',
        status:           'completed',
        payment_method:   sale.payment_method,
        subtotal:         sale.subtotal,
        discount_pct:     sale.discount_pct,
        total:            sale.total,
        amount_paid:      sale.amount_paid,
        change_given:     sale.change_given,
      })
      .select('id')
      .single();

    if (sErr) { err(`Venta ${sale.sale_number}: ${sErr.message}`); continue; }
    ok(`Venta ${sale.sale_number} (${sale.payment_method}) $${sale.total}`);

    // Items de la venta
    for (const item of sale.items) {
      if (!item.ep_id) continue;
      await sb.from('sale_items').insert({
        sale_id:                  newSale.id,
        establishment_product_id: item.ep_id,
        product_name:             item.name,
        product_barcode:          item.barcode,
        quantity:                 item.qty,
        unit_price:               item.price,
        discount_pct:             item.disc,
        subtotal:                 item.sub,
      });
    }
  }

  // ── 8. Proveedor de ejemplo ───────────────────────────────
  console.log('\n🚚  Proveedor');
  const { data: suppExisting } = await sb
    .from('suppliers')
    .select('id')
    .eq('establishment_id', establishmentId)
    .eq('name', 'Distribuidora Norte')
    .maybeSingle();

  if (suppExisting) {
    skip('Distribuidora Norte');
  } else {
    const { error: suppErr } = await sb.from('suppliers').insert({
      establishment_id: establishmentId,
      name: 'Distribuidora Norte',
      contact_name: 'Roberto Pérez',
      phone: '011-4555-1234',
      email: 'ventas@disnorte.com',
    });
    if (suppErr) err(`Proveedor: ${suppErr.message}`);
    else ok('Distribuidora Norte');
  }

  // ─── Resumen ──────────────────────────────────────────────
  console.log('\n✅  Seed completado!\n');
  console.log('   Credenciales de prueba:');
  console.log('   ┌────────────────────────┬──────────────┬────────────┐');
  console.log('   │ Email                  │ Contraseña   │ Rol        │');
  console.log('   ├────────────────────────┼──────────────┼────────────┤');
  console.log('   │ owner@demo.com         │ demo1234     │ owner      │');
  console.log('   │ caja@demo.com          │ demo1234     │ cashier    │');
  console.log('   │ empleado@demo.com      │ demo1234     │ employee   │');
  console.log('   └────────────────────────┴──────────────┴────────────┘\n');
}

seed().catch((e) => {
  console.error('\n❌  Error fatal:', e);
  process.exit(1);
});
