'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  AlertTriangle, ArrowLeft, Banknote, CheckCircle2, ChevronRight,
  Clock, CreditCard, History, Loader2, MapPin, Minus, Package,
  Plus, Search, ShoppingCart, Truck, X,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useCustomers } from '@/hooks/useCustomers';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { lookupBarcode } from '@/lib/utils/barcode-lookup';
import type {
  Customer, Delivery, DeliveryPaymentMethod,
  EstablishmentProductDetail, TravelStockItem,
} from '@/types/database';

// ─── Types ────────────────────────────────────────────────────
type RepartoView = 'home' | 'scanning' | 'active' | 'nueva-venta' | 'historial';
type VentaStep   = 'cliente' | 'productos' | 'pago';

interface ScanItem {
  product:  EstablishmentProductDetail;
  quantity: number;
}

interface CartItem {
  epId:      string;
  name:      string;
  quantity:  number;
  unitPrice: number;
}

type DeliveryWithCustomer = Delivery & { customer: Customer };

const PAY_OPTS: { method: DeliveryPaymentMethod; label: string; icon: React.ElementType; active: string }[] = [
  { method: 'cash',       label: 'Efectivo',          icon: Banknote,    active: 'border-green-400 bg-green-50 text-green-800' },
  { method: 'transfer',   label: 'Transferencia',     icon: CreditCard,  active: 'border-blue-400 bg-blue-50 text-blue-800'  },
  { method: 'pending_7',  label: 'Pendiente 7 días',  icon: Clock,       active: 'border-amber-400 bg-amber-50 text-amber-800' },
  { method: 'pending_15', label: 'Pendiente 15 días', icon: Clock,       active: 'border-orange-400 bg-orange-50 text-orange-800' },
];

function payLabel(m: DeliveryPaymentMethod | null): string {
  if (m === 'cash')       return 'Efectivo';
  if (m === 'transfer')   return 'Transferencia';
  if (m === 'pending_7')  return 'Pendiente 7 días';
  if (m === 'pending_15') return 'Pendiente 15 días';
  return 'Pendiente';
}

// ─── NumPad — entrada de precio sin teclado del sistema ───────
function NumPad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫'] as const;
  return (
    <div className="mt-1 grid grid-cols-3 gap-1.5">
      {keys.map(k => (
        <button
          key={k}
          type="button"
          onClick={() => {
            if (k === '⌫') { onChange(value.slice(0, -1)); return; }
            if (k === '.' && value.includes('.')) return;
            if (k !== '.' && value === '0') { onChange(k); return; }
            onChange(value + k);
          }}
          className="flex h-11 items-center justify-center rounded-xl bg-slate-100
                     text-lg font-bold text-slate-700 active:bg-slate-300 select-none"
        >
          {k}
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function RepartoPage() {
  const { user }         = useAuth();
  const establishmentId  = user?.establishment_id ?? null;
  const supabase         = useMemo(() => createClient(), []);
  const { customers, isLoading: customersLoading } = useCustomers(establishmentId);

  // ── View state ──────────────────────────────────────────────
  const [view,         setView]         = useState<RepartoView>('home');
  const [initializing, setInitializing] = useState(true);
  const [activeTsId,   setActiveTsId]   = useState<string | null>(null);
  const [tsItems,      setTsItems]      = useState<TravelStockItem[]>([]);

  // ── Scanning ────────────────────────────────────────────────
  type ScanMode = 'idle' | 'local' | 'external' | 'manual';
  const [scanCart,         setScanCart]         = useState<ScanItem[]>([]);
  const [barcodeInput,     setBarcodeInput]     = useState('');
  const [scanning,         setScanning]         = useState(false);
  const [scanMode,         setScanMode]         = useState<ScanMode>('idle');
  const [scannedProduct,   setScannedProduct]   = useState<EstablishmentProductDetail | null>(null);
  const [externalInfo,     setExternalInfo]     = useState<{ barcode: string; name: string; brand: string | null; quantity: string | null; unitType: string | null } | null>(null);
  const [scanQty,          setScanQty]          = useState(1);
  const [scanPrice,        setScanPrice]        = useState('');
  const [scanLocalPrice,   setScanLocalPrice]   = useState('');
  const [scanManualName,   setScanManualName]   = useState('');
  const [scanNetContent,   setScanNetContent]   = useState('');
  const [scanError,        setScanError]        = useState<string | null>(null);
  const [creating,         setCreating]         = useState(false);
  const [creatingProduct,  setCreatingProduct]  = useState(false);
  const [scannerFocused,   setScannerFocused]   = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // ── Nueva venta ─────────────────────────────────────────────
  const [ventaStep,        setVentaStep]        = useState<VentaStep>('cliente');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart,             setCart]             = useState<CartItem[]>([]);
  const [payMethod,        setPayMethod]        = useState<DeliveryPaymentMethod>('cash');
  const [ventaError,       setVentaError]       = useState<string | null>(null);
  const [isConfirming,     setIsConfirming]     = useState(false);
  const [lastVenta,        setLastVenta]        = useState<{ customer: Customer; total: number; method: DeliveryPaymentMethod } | null>(null);
  const [customerSearch,   setCustomerSearch]   = useState('');

  // ── Historial ───────────────────────────────────────────────
  const [historial,        setHistorial]        = useState<DeliveryWithCustomer[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [markingPaid,      setMarkingPaid]      = useState<string | null>(null);

  // ── Helpers ─────────────────────────────────────────────────
  const fetchTsItems = useCallback(async (tsId: string): Promise<TravelStockItem[]> => {
    const { data } = await supabase
      .from('travel_stock_items')
      .select('*')
      .eq('travel_stock_id', tsId);
    return (data as TravelStockItem[]) ?? [];
  }, [supabase]);

  // ── Check for active reparto on mount ───────────────────────
  useEffect(() => {
    if (!user || !establishmentId) {
      if (user && !establishmentId) setInitializing(false);
      return;
    }
    let cancelled = false;
    async function check() {
      const { data } = await supabase
        .from('travel_stocks')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('status', 'active')
        .eq('assigned_to', user!.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (cancelled) return;
      if (data && data.length > 0) {
        const ts = data[0];
        setActiveTsId(ts.id);
        const items = await fetchTsItems(ts.id);
        if (!cancelled) { setTsItems(items); setView('active'); }
      }
      if (!cancelled) setInitializing(false);
    }
    check();
    return () => { cancelled = true; };
  }, [user, establishmentId, supabase, fetchTsItems]);

  // ── Barcode scan ─────────────────────────────────────────────
  async function handleBarcodeScan(code: string) {
    if (!code.trim() || !establishmentId) return;
    setScanError(null);
    setScanning(true);
    setBarcodeInput('');

    // 1. Buscar en la base local
    const { data: local } = await supabase
      .from('establishment_products_detail')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('barcode', code.trim())
      .maybeSingle();

    if (local) {
      setScannedProduct(local as EstablishmentProductDetail);
      setScanMode('local');
      setScanQty(1);
      setScanLocalPrice(String(local.price));
      setScanNetContent(local.net_content ?? '');
      setScanning(false);
      return;
    }

    // 2. No está local → buscar en Open Food Facts
    const external = await lookupBarcode(code.trim());
    setScanning(false);

    if (external) {
      setExternalInfo({ barcode: code.trim(), name: external.name, brand: external.brand, quantity: external.quantity, unitType: external.unitType });
      setScanNetContent(external.quantity ?? '');
      setScanMode('external');
    } else {
      // 3. No encontrado en ningún lado → entrada manual
      setExternalInfo({ barcode: code.trim(), name: '', brand: null, quantity: null, unitType: null });
      setScanNetContent('');
      setScanMode('manual');
    }
    setScanQty(1);
    setScanPrice('');
    setScanManualName('');
  }

  function cancelScanDialog() {
    setScanMode('idle');
    setScannedProduct(null);
    setExternalInfo(null);
    setScanQty(1);
    setScanPrice('');
    setScanLocalPrice('');
    setScanManualName('');
    setScanNetContent('');
    setTimeout(() => barcodeRef.current?.focus(), 100);
  }

  // Confirmar producto que ya estaba en la base local
  async function confirmLocalItem() {
    if (!scannedProduct || scanQty < 1) return;
    const newPrice = parseFloat(scanLocalPrice.replace(',', '.'));
    const effectivePrice = (!isNaN(newPrice) && newPrice > 0) ? newPrice : scannedProduct.price;

    // Guardar el último precio en DB si cambió
    if (!isNaN(newPrice) && newPrice > 0 && newPrice !== scannedProduct.price) {
      await supabase
        .from('establishment_products')
        .update({ price: newPrice })
        .eq('id', scannedProduct.id);
    }

    // Guardar net_content si cambió
    const nc = scanNetContent.trim() || null;
    if (nc !== (scannedProduct.net_content ?? null)) {
      await supabase
        .from('products')
        .update({ net_content: nc })
        .eq('id', scannedProduct.product_id);
    }

    const productWithPrice = { ...scannedProduct, price: effectivePrice };
    setScanCart(prev => {
      const ex = prev.find(i => i.product.id === scannedProduct.id);
      if (ex) return prev.map(i => i.product.id === scannedProduct.id ? { ...i, quantity: i.quantity + scanQty } : i);
      return [...prev, { product: productWithPrice, quantity: scanQty }];
    });
    cancelScanDialog();
  }

  // Crear producto nuevo (desde OPF o manual) y agregarlo al carrito
  async function confirmNewProduct() {
    const price = parseFloat(scanPrice.replace(',', '.'));
    const name  = scanMode === 'manual' ? scanManualName.trim() : (externalInfo?.name ?? '');
    if (!externalInfo?.barcode || !name || isNaN(price) || price <= 0 || scanQty < 1) return;

    const netContent = scanNetContent.trim() || null;

    setCreatingProduct(true);
    setScanError(null);
    try {
      // Upsert en catálogo global — guarda net_content y unit_type de OPF
      const { data: prod, error: pErr } = await supabase
        .from('products')
        .upsert(
          {
            barcode:     externalInfo.barcode,
            name,
            brand:       externalInfo.brand || null,
            unit_type:   (externalInfo?.unitType as string) || 'unit',
            net_content: netContent,
            created_by:  user!.id,
          },
          { onConflict: 'barcode', ignoreDuplicates: false }
        )
        .select('id')
        .single();
      if (pErr || !prod) throw new Error('Error al guardar el producto');

      // Upsert en establishment_products
      const { data: ep, error: epErr } = await supabase
        .from('establishment_products')
        .upsert(
          { establishment_id: establishmentId!, product_id: prod.id, price, stock: 0, stock_min_alert: 5 },
          { onConflict: 'establishment_id,product_id' }
        )
        .select('id')
        .single();
      if (epErr || !ep) throw new Error('Error al vincular el producto');

      // Leer la vista con todos los campos que necesita ScanItem
      const { data: detail } = await supabase
        .from('establishment_products_detail')
        .select('*')
        .eq('id', ep.id)
        .single();
      if (!detail) throw new Error('No se pudo leer el producto creado');

      const product = detail as EstablishmentProductDetail;
      setScanCart(prev => {
        const ex = prev.find(i => i.product.id === product.id);
        if (ex) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + scanQty } : i);
        return [...prev, { product, quantity: scanQty }];
      });
      cancelScanDialog();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Error al crear producto');
    } finally {
      setCreatingProduct(false);
    }
  }

  // ── Create reparto ───────────────────────────────────────────
  async function handleCreateReparto() {
    if (!establishmentId || !user || scanCart.length === 0) return;
    setCreating(true);
    setScanError(null);
    try {
      const { data, error } = await supabase.rpc('create_reparto_stock', {
        p_establishment_id: establishmentId,
        p_assigned_to:      user.id,
        p_created_by:       user.id,
        p_items: scanCart.map(i => ({
          ep_id:      i.product.id,
          name:       i.product.name,
          quantity:   i.quantity,
          unit_price: i.product.price,
        })),
      });
      if (error) throw new Error(error.message);
      const tsId = (data as { travel_stock_id: string }).travel_stock_id;
      setActiveTsId(tsId);
      const items = await fetchTsItems(tsId);
      setTsItems(items);
      setScanCart([]);
      setView('active');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Error al iniciar el reparto');
    } finally {
      setCreating(false);
    }
  }

  // ── Close reparto ────────────────────────────────────────────
  async function handleCloseReparto() {
    if (!activeTsId) return;
    if (!confirm('¿Cerrar el reparto del día? Los productos no vendidos quedarán solo como registro.')) return;
    const { error } = await supabase.rpc('close_reparto', { p_travel_stock_id: activeTsId });
    if (error) { alert(error.message); return; }
    setActiveTsId(null);
    setTsItems([]);
    setLastVenta(null);
    setView('home');
  }

  // ── Nueva venta ─────────────────────────────────────────────
  function startNuevaVenta() {
    setSelectedCustomer(null);
    setCart([]);
    setPayMethod('cash');
    setVentaError(null);
    setVentaStep('cliente');
    setCustomerSearch('');
    setView('nueva-venta');
  }

  function addToCart(item: TravelStockItem) {
    const remaining = item.quantity_assigned - item.quantity_sold;
    if (remaining <= 0) return;
    setCart(prev => {
      const ex = prev.find(c => c.epId === item.establishment_product_id);
      if (ex) return prev.map(c => c.epId === item.establishment_product_id
        ? { ...c, quantity: Math.min(c.quantity + 1, remaining) } : c);
      return [...prev, { epId: item.establishment_product_id, name: item.product_name, quantity: 1, unitPrice: item.unit_price }];
    });
  }

  function updateCartQty(epId: string, qty: number) {
    if (qty < 1) { setCart(prev => prev.filter(c => c.epId !== epId)); return; }
    setCart(prev => prev.map(c => c.epId === epId ? { ...c, quantity: qty } : c));
  }

  async function handleConfirmVenta() {
    if (!selectedCustomer || cart.length === 0 || !activeTsId || !establishmentId || !user) return;
    setVentaError(null);
    setIsConfirming(true);
    const payStatus = (payMethod === 'cash' || payMethod === 'transfer') ? 'paid' : 'pending';
    try {
      const { error } = await supabase.rpc('create_delivery', {
        p_establishment_id: establishmentId,
        p_travel_stock_id:  activeTsId,
        p_customer_id:      selectedCustomer.id,
        p_sold_by:          user.id,
        p_payment_status:   payStatus,
        p_notes:            null,
        p_payment_method:   payMethod,
        p_items: cart.map(i => ({
          ep_id:      i.epId,
          name:       i.name,
          quantity:   i.quantity,
          unit_price: i.unitPrice,
        })),
      });
      if (error) throw new Error(error.message);

      const total = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
      setLastVenta({ customer: selectedCustomer, total, method: payMethod });
      const updated = await fetchTsItems(activeTsId);
      setTsItems(updated);
      setView('active');
    } catch (err) {
      setVentaError(err instanceof Error ? err.message : 'Error al registrar la venta');
    } finally {
      setIsConfirming(false);
    }
  }

  // ── Historial ────────────────────────────────────────────────
  const loadHistorial = useCallback(async () => {
    if (!establishmentId) return;
    setHistorialLoading(true);
    let query = supabase
      .from('deliveries')
      .select('*, customer:customers(*)')
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false });

    if (activeTsId) {
      query = query.eq('travel_stock_id', activeTsId);
    } else {
      query = query.limit(50);
    }

    const { data } = await query;
    setHistorial((data ?? []) as DeliveryWithCustomer[]);
    setHistorialLoading(false);
  }, [supabase, establishmentId, activeTsId]);

  async function handleMarkPaid(deliveryId: string) {
    setMarkingPaid(deliveryId);
    try {
      const { error } = await supabase.rpc('mark_delivery_paid', { p_delivery_id: deliveryId });
      if (error) throw new Error(error.message);
      setHistorial(prev => prev.map(d =>
        d.id === deliveryId
          ? { ...d, payment_status: 'paid' as const, paid_at: new Date().toISOString() }
          : d
      ));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setMarkingPaid(null);
    }
  }

  // ── Customer grouping ────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.locality ?? '').toLowerCase().includes(q) ||
      (c.barrio   ?? '').toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const groupedCustomers = useMemo(() => {
    const map = new Map<string, Customer[]>();
    for (const c of filteredCustomers) {
      const key = c.locality || 'Sin localidad';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredCustomers]);

  // ── Cart total ───────────────────────────────────────────────
  const cartTotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

  // ─────────────────────────────────────────────────────────────
  if (initializing) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-700" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // HOME
  // ─────────────────────────────────────────────────────────────
  if (view === 'home') {
    return (
      <div className="mx-auto max-w-md p-5 pt-10">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100">
            <Truck className="h-8 w-8 text-primary-700" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Reparto</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hola, {user?.full_name?.split(' ')[0]} 👋
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {scanCart.length > 0 ? (
            /* ── Borrador guardado ── */
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-600">
                Carga en borrador
              </p>
              <p className="text-lg font-black text-amber-900">
                {scanCart.length} producto{scanCart.length !== 1 ? 's' : ''}
                <span className="ml-2 text-sm font-semibold text-amber-600">
                  ({scanCart.reduce((s, i) => s + i.quantity, 0)} unidades)
                </span>
              </p>
              <p className="mb-4 mt-0.5 text-xs text-amber-500">
                Volviste al inicio sin confirmar la carga
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setScanError(null); setView('scanning'); }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl
                             bg-amber-600 py-3 text-sm font-bold text-white
                             transition-transform active:scale-[0.97]"
                >
                  <Truck className="h-4 w-4" />
                  Continuar carga
                </button>
                <button
                  onClick={() => { setScanCart([]); setScanError(null); setView('scanning'); }}
                  className="rounded-xl border-2 border-amber-200 bg-white px-4 py-3
                             text-sm font-semibold text-amber-700
                             transition-transform active:scale-[0.97]"
                >
                  Nueva
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setScanCart([]); setScanError(null); setView('scanning'); }}
              className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl
                         bg-primary-700 text-white shadow-lg transition-transform active:scale-[0.97]"
            >
              <Truck className="h-7 w-7" />
              <span className="text-xl font-black">Iniciar Reparto</span>
            </button>
          )}

          <button
            onClick={async () => { setView('historial'); await loadHistorial(); }}
            className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl border-2
                       border-slate-200 bg-white text-slate-700 transition-transform active:scale-[0.97]"
          >
            <History className="h-5 w-5 text-slate-400" />
            <span className="text-base font-semibold">Historial de repartos</span>
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SCANNING — Carga de camioneta
  // ─────────────────────────────────────────────────────────────
  if (view === 'scanning') {
    return (
      <div className="mx-auto max-w-md p-4 pb-32">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => setView('home')}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900">Cargar camioneta</h1>
            <p className="text-xs text-slate-500">Escaneá los productos que llevás hoy</p>
          </div>
        </div>

        {/* Barcode input */}
        <div className="mb-4">
          {/* Indicador de estado del scanner */}
          {scanMode === 'idle' && (
            <button
              onClick={() => barcodeRef.current?.focus()}
              className={`mb-2 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-colors ${
                scannerFocused
                  ? 'bg-green-50 text-green-700'
                  : 'bg-amber-50 text-amber-700 animate-pulse'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${scannerFocused ? 'bg-green-500' : 'bg-amber-500'}`} />
              {scannerFocused ? 'Escáner activo — listo para leer' : 'Tocá aquí para activar el escáner'}
            </button>
          )}
          <div className="relative">
            <input
              ref={barcodeRef}
              autoFocus
              disabled={scanMode !== 'idle' || scanning}
              value={barcodeInput}
              onChange={e => {
                const val = e.target.value;
                // Algunos scanners mandan \n o \r dentro del value en lugar de Enter key
                if (val.includes('\n') || val.includes('\r')) {
                  const clean = val.replace(/[\r\n]/g, '').trim();
                  if (clean) handleBarcodeScan(clean);
                  return;
                }
                setBarcodeInput(val);
              }}
              onKeyDown={e => {
                // Enter y Tab son los terminadores más comunes de scanners
                if ((e.key === 'Enter' || e.key === 'Tab') && scanMode === 'idle') {
                  e.preventDefault();
                  // Leer directo del DOM para evitar el closure stale del estado
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) handleBarcodeScan(val);
                }
              }}
              onFocus={() => setScannerFocused(true)}
              onBlur={() => {
                setScannerFocused(false);
                // Auto-refocus si no hay diálogo abierto
                if (scanMode === 'idle' && !scanning) {
                  setTimeout(() => barcodeRef.current?.focus(), 150);
                }
              }}
              placeholder="Escaneá con la pistola lectora…"
              className="block w-full rounded-2xl border-2 bg-white
                         px-4 py-4 text-base focus:outline-none
                         disabled:bg-slate-50 disabled:text-slate-400
                         border-primary-300 focus:border-primary-700"
            />
            {scanning && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="h-5 w-5 animate-spin text-primary-700" />
              </div>
            )}
          </div>
          {scanError && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />{scanError}
            </p>
          )}
        </div>

        {/* ── Modo LOCAL: producto ya estaba en el sistema ── */}
        {scanMode === 'local' && scannedProduct && (
          <div className="mb-4 rounded-2xl border-2 border-primary-200 bg-primary-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-500 mb-1">Producto encontrado</p>
            <p className="font-bold text-primary-900">{scannedProduct.name}</p>
            {scannedProduct.brand && <p className="text-xs text-primary-500">{scannedProduct.brand}</p>}
            <div className="mt-2 mb-3 space-y-2">
              <div>
                <label className="text-xs font-medium text-primary-600">Contenido del envase</label>
                <input
                  inputMode="text"
                  value={scanNetContent}
                  onChange={e => setScanNetContent(e.target.value)}
                  placeholder="Ej: 500 g, 1 L, 6 x 330 ml"
                  className="block w-full rounded-xl border border-primary-200 bg-white px-3 py-2 focus:border-primary-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-primary-600">Precio de venta ($)</label>
                <div className="flex items-center rounded-xl border border-primary-200 bg-white px-3 py-2 text-base font-semibold min-h-[42px]">
                  {scanLocalPrice || <span className="text-slate-400">0</span>}
                </div>
                <NumPad value={scanLocalPrice} onChange={setScanLocalPrice} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setScanQty(q => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-lg font-black">{scanQty}</span>
                <button onClick={() => setScanQty(q => q + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-700 text-white">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={confirmLocalItem}
                disabled={!scanLocalPrice || parseFloat(scanLocalPrice) <= 0}
                className="flex-1 rounded-xl bg-primary-700 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                Agregar ({scanQty})
              </button>
              <button onClick={cancelScanDialog}
                className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-400 hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Modo EXTERNAL: encontrado en Open Food Facts ── */}
        {scanMode === 'external' && externalInfo && (
          <div className="mb-4 rounded-2xl border-2 border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 mb-1">Encontrado en Open Food Facts</p>
            <div className="mb-3 space-y-2">
              <div>
                <label className="text-xs text-blue-600">Nombre</label>
                <input
                  value={externalInfo.name}
                  onChange={e => setExternalInfo(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  className="block w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold focus:border-primary-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-blue-600">Contenido del envase</label>
                <input
                  inputMode="text"
                  value={scanNetContent}
                  onChange={e => setScanNetContent(e.target.value)}
                  placeholder="Ej: 500 g, 1 L, 6 x 330 ml"
                  className="block w-full rounded-xl border border-blue-200 bg-white px-3 py-2 focus:border-primary-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-blue-600">Precio de venta ($)</label>
                <div className="flex items-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-base font-semibold min-h-[42px]">
                  {scanPrice || <span className="text-slate-400">0</span>}
                </div>
                <NumPad value={scanPrice} onChange={setScanPrice} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setScanQty(q => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-lg font-black">{scanQty}</span>
                <button onClick={() => setScanQty(q => q + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-700 text-white">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={confirmNewProduct}
                disabled={creatingProduct || !scanPrice || !externalInfo.name.trim()}
                className="flex-1 rounded-xl bg-primary-700 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {creatingProduct ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : `Agregar (${scanQty})`}
              </button>
              <button onClick={cancelScanDialog}
                className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-400 hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Modo MANUAL: no encontrado en ningún lado ── */}
        {scanMode === 'manual' && (
          <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1">No encontrado — ingresar manualmente</p>
            <div className="mb-3 space-y-2">
              <div>
                <label className="text-xs text-amber-700">Nombre del producto</label>
                <input
                  autoFocus
                  value={scanManualName}
                  onChange={e => setScanManualName(e.target.value)}
                  placeholder="Ej: Gaseosa Cola"
                  className="block w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold focus:border-primary-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-amber-700">Contenido del envase (opcional)</label>
                <input
                  inputMode="text"
                  value={scanNetContent}
                  onChange={e => setScanNetContent(e.target.value)}
                  placeholder="Ej: 2 L, 500 g, 6 x 330 ml"
                  className="block w-full rounded-xl border border-amber-200 bg-white px-3 py-2 focus:border-primary-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-amber-700">Precio de venta ($)</label>
                <div className="flex items-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-base font-semibold min-h-[42px]">
                  {scanPrice || <span className="text-slate-400">0</span>}
                </div>
                <NumPad value={scanPrice} onChange={setScanPrice} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setScanQty(q => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-lg font-black">{scanQty}</span>
                <button onClick={() => setScanQty(q => q + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-700 text-white">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={confirmNewProduct}
                disabled={creatingProduct || !scanPrice || !scanManualName.trim()}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {creatingProduct ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : `Agregar (${scanQty})`}
              </button>
              <button onClick={cancelScanDialog}
                className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-400 hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Lista de productos cargados */}
        {scanCart.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {scanCart.length} producto{scanCart.length !== 1 ? 's' : ''} cargado{scanCart.length !== 1 ? 's' : ''}
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {scanCart.map((item, i) => (
                <div
                  key={item.product.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.product.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatCurrency(item.product.price)} c/u
                      {item.product.net_content ? ` · ${item.product.net_content}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScanCart(prev =>
                        prev.map(p => p.product.id === item.product.id
                          ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p)
                      )}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                    <button
                      onClick={() => setScanCart(prev =>
                        prev.map(p => p.product.id === item.product.id
                          ? { ...p, quantity: p.quantity + 1 } : p)
                      )}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-700 text-white"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => setScanCart(prev => prev.filter(p => p.product.id !== item.product.id))}
                    className="text-slate-300 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botón iniciar ruta */}
        {scanCart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-slate-100 bg-white/95 p-4 backdrop-blur-sm">
            <div className="mx-auto max-w-md">
              <button
                onClick={handleCreateReparto}
                disabled={creating}
                className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl
                           bg-green-600 text-xl font-black text-white
                           transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                {creating
                  ? <Loader2 className="h-6 w-6 animate-spin" />
                  : <Truck className="h-6 w-6" />
                }
                {creating ? 'Iniciando reparto…' : 'Iniciar ruta'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ACTIVE — En ruta
  // ─────────────────────────────────────────────────────────────
  if (view === 'active') {
    const totalCargados  = tsItems.reduce((s, i) => s + i.quantity_assigned, 0);
    const totalVendidos  = tsItems.reduce((s, i) => s + i.quantity_sold,     0);
    const totalRestantes = totalCargados - totalVendidos;

    return (
      <div className="mx-auto max-w-md p-4 pt-6">
        {/* Status header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-slate-900">En ruta</h1>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              ● Activo
            </span>
          </div>

          {/* Resumen stock */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Cargados',  value: totalCargados,  color: 'text-slate-900' },
              { label: 'Vendidos',  value: totalVendidos,  color: 'text-green-700' },
              { label: 'Restantes', value: totalRestantes, color: 'text-slate-900' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3 text-center">
                <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Última venta */}
        {lastVenta && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-green-900">{lastVenta.customer.name}</p>
              <p className="text-xs text-green-700">
                {formatCurrency(lastVenta.total)} · {payLabel(lastVenta.method)}
              </p>
            </div>
            <button onClick={() => setLastVenta(null)} className="text-green-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Acciones principales */}
        <div className="flex flex-col gap-3">
          <button
            onClick={startNuevaVenta}
            className="flex h-20 w-full items-center justify-center gap-3 rounded-2xl
                       bg-primary-700 text-white shadow-lg transition-transform active:scale-[0.97]"
          >
            <ShoppingCart className="h-7 w-7" />
            <span className="text-xl font-black">Nueva Venta</span>
          </button>

          <button
            onClick={async () => { setView('historial'); await loadHistorial(); }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl
                       border-2 border-slate-200 bg-white text-slate-700
                       transition-transform active:scale-[0.97]"
          >
            <History className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-semibold">Ver ventas del día</span>
          </button>

          <button
            onClick={handleCloseReparto}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl
                       border-2 border-red-200 bg-red-50 text-red-700
                       transition-transform active:scale-[0.97]"
          >
            <X className="h-5 w-5" />
            <span className="text-sm font-semibold">Cerrar reparto del día</span>
          </button>
        </div>

        {/* Stock en camioneta */}
        {tsItems.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Stock en camioneta
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {tsItems.map((item, i) => {
                const remaining = item.quantity_assigned - item.quantity_sold;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}
                  >
                    <p className="text-sm text-slate-800">{item.product_name}</p>
                    <div className="flex gap-4 text-xs tabular-nums">
                      <span className="text-slate-400">vendidos: {item.quantity_sold}</span>
                      <span className={remaining === 0 ? 'text-slate-400' : 'font-bold text-slate-900'}>
                        quedan: {remaining}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // NUEVA VENTA — Sub-step: CLIENTE
  // ─────────────────────────────────────────────────────────────
  if (view === 'nueva-venta' && ventaStep === 'cliente') {
    return (
      <div className="mx-auto max-w-md p-4 pb-6">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => setView('active')} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-black text-slate-900">¿A quién le entregás?</h1>
        </div>

        {/* Buscador */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className="block w-full rounded-xl border border-slate-200 py-3 pl-9 pr-4
                       text-sm focus:border-primary-700 focus:outline-none"
          />
        </div>

        {customersLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groupedCustomers.map(([locality, group]) => (
              <div key={locality}>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{locality}</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {group.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomer(c); setVentaStep('productos'); }}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left
                                  hover:bg-slate-50 active:bg-primary-50
                                  ${i > 0 ? 'border-t border-slate-50' : ''}`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                        {c.barrio && <p className="text-xs text-slate-400">{c.barrio}</p>}
                        {c.total_debt > 0 && (
                          <p className="text-xs font-medium text-red-600">
                            Debe: {formatCurrency(c.total_debt)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {groupedCustomers.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">No se encontraron clientes</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // NUEVA VENTA — Sub-step: PRODUCTOS
  // ─────────────────────────────────────────────────────────────
  if (view === 'nueva-venta' && ventaStep === 'productos') {
    return (
      <div className="mx-auto max-w-md p-4 pb-36">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => setVentaStep('cliente')} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900">{selectedCustomer?.name}</h1>
            <p className="text-xs text-slate-500">Seleccioná los productos</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {tsItems.map(item => {
            const remaining = item.quantity_assigned - item.quantity_sold;
            const inCart    = cart.find(c => c.epId === item.establishment_product_id);
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 bg-white ${
                  remaining <= 0
                    ? 'border-slate-100 opacity-40'
                    : inCart
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-slate-200'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                  <p className="text-xs text-slate-400">
                    {formatCurrency(item.unit_price)} · quedan {remaining}
                  </p>
                </div>

                {remaining > 0 && (
                  <div className="flex items-center gap-2">
                    {inCart ? (
                      <>
                        <button
                          onClick={() => updateCartQty(item.establishment_product_id, inCart.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-base font-black tabular-nums">{inCart.quantity}</span>
                        <button
                          onClick={() => updateCartQty(item.establishment_product_id, Math.min(inCart.quantity + 1, remaining))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-700 text-white"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-700 text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-slate-100 bg-white/95 p-4 backdrop-blur-sm">
            <div className="mx-auto max-w-md">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-500">{cart.length} producto{cart.length !== 1 ? 's' : ''}</span>
                <span className="font-black text-slate-900">{formatCurrency(cartTotal)}</span>
              </div>
              <button
                onClick={() => setVentaStep('pago')}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl
                           bg-primary-700 text-base font-black text-white
                           transition-transform active:scale-[0.97]"
              >
                Elegir forma de pago
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // NUEVA VENTA — Sub-step: PAGO
  // ─────────────────────────────────────────────────────────────
  if (view === 'nueva-venta' && ventaStep === 'pago') {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => setVentaStep('productos')} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900">¿Cómo pagó?</h1>
            <p className="text-xs text-slate-500">
              {selectedCustomer?.name} · {formatCurrency(cartTotal)}
            </p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          {PAY_OPTS.map(({ method, label, icon: Icon, active }) => (
            <button
              key={method}
              onClick={() => setPayMethod(method)}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 py-6
                          transition-all active:scale-[0.97] ${
                payMethod === method ? active : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-center text-sm font-bold leading-tight">{label}</span>
            </button>
          ))}
        </div>

        {ventaError && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />{ventaError}
          </div>
        )}

        <button
          onClick={handleConfirmVenta}
          disabled={isConfirming}
          className={`flex h-16 w-full items-center justify-center gap-3 rounded-2xl
                      text-xl font-black text-white
                      transition-transform active:scale-[0.97] disabled:opacity-50 ${
            payMethod === 'cash'     ? 'bg-green-600' :
            payMethod === 'transfer' ? 'bg-blue-600'  :
                                       'bg-amber-500'
          }`}
        >
          {isConfirming
            ? <Loader2 className="h-6 w-6 animate-spin" />
            : <CheckCircle2 className="h-6 w-6" />
          }
          {isConfirming ? 'Registrando…' : 'Confirmar venta'}
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // HISTORIAL
  // ─────────────────────────────────────────────────────────────
  if (view === 'historial') {
    const paid    = historial.filter(d => d.payment_status === 'paid');
    const pending = historial.filter(d => d.payment_status === 'pending');
    const totalPaid    = paid.reduce((s, d)    => s + Number(d.total_amount), 0);
    const totalPending = pending.reduce((s, d) => s + Number(d.total_amount), 0);

    return (
      <div className="mx-auto max-w-md p-4 pb-8">
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => setView(activeTsId ? 'active' : 'home')}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-black text-slate-900">
            {activeTsId ? 'Ventas del día' : 'Historial de repartos'}
          </h1>
        </div>

        {/* Resumen */}
        {historial.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
              <p className="text-lg font-black text-green-800 tabular-nums">{formatCurrency(totalPaid)}</p>
              <p className="text-xs text-green-600">{paid.length} cobrada{paid.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-lg font-black text-amber-800 tabular-nums">{formatCurrency(totalPending)}</p>
              <p className="text-xs text-amber-600">{pending.length} pendiente{pending.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        )}

        {historialLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : historial.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Package className="h-12 w-12 text-slate-200" />
            <p className="text-sm text-slate-400">No hay ventas registradas aún</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {historial.map(d => (
              <div
                key={d.id}
                className={`rounded-xl border-2 p-4 ${
                  d.payment_status === 'paid'
                    ? 'border-green-200 bg-green-50'
                    : 'border-amber-200 bg-amber-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{d.customer?.name}</p>
                    <p className="text-sm font-bold text-slate-700 tabular-nums">
                      {formatCurrency(Number(d.total_amount))}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {new Date(d.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {payLabel(d.payment_method)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {d.payment_status === 'pending' ? (
                      <button
                        onClick={() => handleMarkPaid(d.id)}
                        disabled={markingPaid === d.id}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5
                                   text-xs font-bold text-white disabled:opacity-50"
                      >
                        {markingPaid === d.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <CheckCircle2 className="h-3 w-3" />
                        }
                        Cobrar
                      </button>
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}
