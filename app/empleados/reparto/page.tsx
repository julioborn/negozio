'use client';

import { Suspense } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import {
  AlertTriangle, ArrowLeft, Banknote, Camera, Check, CheckCircle2, ChevronDown,
  ChevronRight, Clock, CreditCard, History, Loader2, MapPin, Minus, Package,
  Pencil, Plus, Search, ShoppingCart, Truck, UserPlus, X,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useCustomers } from '@/hooks/useCustomers';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { ContentInput, KeyboardInput, NumPad } from '@/components/ui/SoftKeyboard';
import dynamic from 'next/dynamic';
const CameraScanner = dynamic(() => import('@/components/ui/CameraScanner'), { ssr: false });
import { lookupBarcode } from '@/lib/utils/barcode-lookup';
import type {
  Customer, Delivery, DeliveryItem, DeliveryPaymentMethod,
  EstablishmentProductDetail, TravelStockItem,
} from '@/types/database';

// ─── Types ────────────────────────────────────────────────────
type RepartoView = 'home' | 'scanning' | 'agregar-stock' | 'active' | 'nueva-venta' | 'historial' | 'cierre-reparto';
type VentaStep   = 'cliente' | 'nuevo-cliente' | 'productos' | 'pago';

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

// ─── Parsea "500 g", "1.5 L" → { qty, unit } ─────────────────
function parseNetContent(s: string | null): { qty: string; unit: string } {
  if (!s) return { qty: '', unit: '' };
  const m = s.trim().match(/^([\d.,]+)\s*([a-zA-Z]+)/);
  const [, rawQty, rawUnit] = m ?? [];
  if (!rawQty || !rawUnit) return { qty: '', unit: '' };
  const qty = rawQty.replace(',', '.');
  const raw = rawUnit.toLowerCase();
  const MAP: Record<string, string> = {
    g: 'g', gr: 'g', gramo: 'g', gramos: 'g', gram: 'g', grams: 'g',
    kg: 'kg', kilo: 'kg', kilos: 'kg',
    mg: 'mg',
    ml: 'ml',
    l: 'L', lt: 'L', lts: 'L', litro: 'L', litros: 'L', liter: 'L', liters: 'L',
    cl: 'cl',
    cc: 'cc',
    un: 'un', unidad: 'un', unidades: 'un', unit: 'un', units: 'un',
  };
  return { qty, unit: MAP[raw] ?? rawUnit };
}

// ─── QtyControl — +/- con hold-repeat y botón Agregar abajo ──
function QtyControl({
  value, onChange, onConfirm, onCancel,
  confirmLabel, confirmDisabled = false, confirming = false,
  confirmBg = 'bg-primary-700',
}: {
  value: number;
  onChange: (updater: (prev: number) => number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
  confirming?: boolean;
  confirmBg?: string;
}) {
  const holdTimer    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  function startHold(delta: number) {
    onChange(prev => Math.max(1, prev + delta));
    holdTimer.current = setTimeout(() => {
      holdInterval.current = setInterval(() => {
        onChange(prev => Math.max(1, prev + delta));
      }, 80);
    }, 350);
  }

  function stopHold() {
    if (holdTimer.current)    clearTimeout(holdTimer.current);
    if (holdInterval.current) clearInterval(holdInterval.current);
  }

  return (
    <div className="mt-4 select-none">
      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onPointerDown={() => startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onContextMenu={e => e.preventDefault()}
          className="flex h-16 w-16 items-center justify-center rounded-2xl border-2
                     border-slate-200 bg-white text-slate-700 active:bg-slate-100 select-none"
        >
          <Minus className="h-7 w-7" />
        </button>
        <span className="w-24 text-center text-6xl font-black tabular-nums text-slate-900">
          {value}
        </span>
        <button
          type="button"
          onPointerDown={() => startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onContextMenu={e => e.preventDefault()}
          className="flex h-16 w-16 items-center justify-center rounded-2xl
                     bg-primary-700 text-white active:bg-primary-800 select-none"
        >
          <Plus className="h-7 w-7" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled || confirming}
          className={`flex-1 rounded-xl ${confirmBg} py-3.5 text-sm font-bold text-white disabled:opacity-50`}
        >
          {confirming
            ? <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            : confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 bg-white p-3.5 text-slate-400 hover:text-red-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
function RepartoPage() {
  const { user }         = useAuth();
  const establishmentId  = user?.establishment_id ?? null;
  const supabase         = useMemo(() => createClient(), []);
  const { customers, isLoading: customersLoading } = useCustomers(establishmentId);

  const searchParams   = useSearchParams();
  const tsParam        = searchParams.get('ts');

  // ── View state ──────────────────────────────────────────────
  const [view,         setView]         = useState<RepartoView>('home');
  const [initializing, setInitializing] = useState(true);
  const [activeTsId,   setActiveTsId]   = useState<string | null>(null);
  const [tsItems,      setTsItems]      = useState<TravelStockItem[]>([]);

  // ── Scanning ────────────────────────────────────────────────
  type ScanMode = 'idle' | 'local' | 'external' | 'manual';
  const [scanCart,         setScanCart]         = useState<ScanItem[]>([]);
  const draftKey = establishmentId ? `reparto-draft-${establishmentId}` : null;
  const [barcodeInput,     setBarcodeInput]     = useState('');
  const [scanning,         setScanning]         = useState(false);
  const [scanMode,         setScanMode]         = useState<ScanMode>('idle');
  const [scannedProduct,   setScannedProduct]   = useState<EstablishmentProductDetail | null>(null);
  const [externalInfo,     setExternalInfo]     = useState<{ barcode: string; name: string; brand: string | null; quantity: string | null; unitType: string | null } | null>(null);
  const [scanQty,          setScanQty]          = useState(1);
  const [scanPrice,        setScanPrice]        = useState('');
  const [scanLocalPrice,   setScanLocalPrice]   = useState('');
  const [scanManualName,   setScanManualName]   = useState('');
  const [netQty,           setNetQty]           = useState('');
  const [netUnit,          setNetUnit]          = useState('');
  const [scanError,        setScanError]        = useState<string | null>(null);
  const [creating,         setCreating]         = useState(false);
  const [creatingProduct,  setCreatingProduct]  = useState(false);
  const [scannerFocused,   setScannerFocused]   = useState(false);
  const [cameraOpen,       setCameraOpen]       = useState(false);
  const [epProducts,       setEpProducts]       = useState<EstablishmentProductDetail[]>([]);
  const [productSearch,    setProductSearch]    = useState('');
  const [loadingProds,     setLoadingProds]     = useState(false);
  const [productListOpen,  setProductListOpen]  = useState(false);
  const [productPage,      setProductPage]      = useState(0);
  const [scanCartOpen,     setScanCartOpen]     = useState(true);
  const PRODS_PER_PAGE = 8;
  const barcodeRef       = useRef<HTMLInputElement>(null);
  // GPS tracking
  const gpsWatchRef      = useRef<number | null>(null);
  const currentPosRef    = useRef<{ lat: number; lng: number } | null>(null);
  const lastSavedPosRef  = useRef<{ lat: number; lng: number } | null>(null);
  const lastSavedTimeRef = useRef<number>(0);

  // ── Nueva venta ─────────────────────────────────────────────
  const [ventaStep,           setVentaStep]           = useState<VentaStep>('cliente');
  const [selectedCustomer,   setSelectedCustomer]    = useState<Customer | null>(null);
  const [cart,               setCart]               = useState<CartItem[]>([]);
  const [payMethod,          setPayMethod]           = useState<DeliveryPaymentMethod>('cash');
  const [ventaError,         setVentaError]          = useState<string | null>(null);
  const [isConfirming,       setIsConfirming]        = useState(false);
  const [lastVenta,          setLastVenta]           = useState<{ customer: Customer; total: number; method: DeliveryPaymentMethod } | null>(null);
  const [customerSearch,     setCustomerSearch]      = useState('');
  const [ventaProductSearch, setVentaProductSearch]  = useState('');
  const [ventaProductPage,   setVentaProductPage]    = useState(0);

  // ── Historial ───────────────────────────────────────────────
  const [historial,            setHistorial]            = useState<DeliveryWithCustomer[]>([]);
  const [historialLoading,     setHistorialLoading]     = useState(false);
  const [markingPaid,          setMarkingPaid]           = useState<string | null>(null);
  const [confirmPaidId,        setConfirmPaidId]         = useState<string | null>(null);
  const [historialProfiles,    setHistorialProfiles]     = useState<{ id: string; full_name: string }[]>([]);
  const [expandedDeliveries,   setExpandedDeliveries]   = useState<Set<string>>(new Set());

  interface RepartoGroup {
    tsId:       string;
    date:       string;
    status:     string;
    deliveries: DeliveryWithCustomer[];
  }
  const [repartoGroups, setRepartoGroups] = useState<RepartoGroup[]>([]);

  // ── Repartos disponibles (para unirse) ──────────────────────
  interface AvailableReparto {
    id:            string;
    created_at:    string;
    assigned_to:   string;
    assigned_name: string;
  }
  const [availableRepartos, setAvailableRepartos] = useState<AvailableReparto[]>([]);

  // ── Nuevo cliente ────────────────────────────────────────────
  const [newClientName,     setNewClientName]     = useState('');
  const [newClientLocality, setNewClientLocality] = useState('');
  const [newClientBarrio,   setNewClientBarrio]   = useState('');
  const [newClientPhone,    setNewClientPhone]    = useState('');
  const [savingClient,      setSavingClient]      = useState(false);

  // ── Edición de precio en reparto activo ──────────────────────
  const [editPriceItem,  setEditPriceItem]  = useState<{ itemId: string; epId: string | null; value: string } | null>(null);
  const [savingItemPrice, setSavingItemPrice] = useState(false);

  // ── Cierre del reparto ────────────────────────────────────────
  interface DeliveryFull extends DeliveryWithCustomer { items: DeliveryItem[]; }
  const [cierreDeliveries, setCierreDeliveries] = useState<DeliveryFull[]>([]);
  const [cierreLoading,    setCierreLoading]    = useState(false);
  const [cierreClosing,    setCierreClosing]    = useState(false);

  // ── Persistencia del borrador de carga en localStorage ────────
  // Restaura al montar (solo si no hay reparto activo)
  useEffect(() => {
    if (!draftKey || activeTsId) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const items = JSON.parse(saved) as ScanItem[];
        if (items.length > 0) setScanCart(items);
      }
    } catch { /* dato corrupto — ignorar */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Auto-guarda cada vez que cambia el carrito
  useEffect(() => {
    if (!draftKey) return;
    if (scanCart.length > 0) {
      localStorage.setItem(draftKey, JSON.stringify(scanCart));
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [scanCart, draftKey]);

  // ── GPS tracking — corre durante todo el reparto activo ───────
  // Guarda en DB cuando el dispositivo se movió > 15m O pasaron > 10s
  useEffect(() => {
    if (!activeTsId || !navigator.geolocation) {
      if (gpsWatchRef.current != null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
      return;
    }

    // Distancia en metros entre dos coordenadas (Haversine simplificado)
    function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
      const R = 6371000;
      const dLat = (b.lat - a.lat) * Math.PI / 180;
      const dLng = (b.lng - a.lng) * Math.PI / 180;
      const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.asin(Math.sqrt(h));
    }

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      async pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        currentPosRef.current = { lat, lng };

        const now      = Date.now();
        const elapsed  = now - lastSavedTimeRef.current;
        const moved    = lastSavedPosRef.current
          ? metersBetween(lastSavedPosRef.current, { lat, lng })
          : Infinity;

        // Guardar si se movió más de 15m O pasaron más de 10s desde el último punto
        if (moved > 15 || elapsed > 10000) {
          lastSavedTimeRef.current = now;
          lastSavedPosRef.current  = { lat, lng };
          await supabase.from('reparto_waypoints').insert({
            travel_stock_id: activeTsId,
            lat, lng,
            type: 'route',
          });
        }
      },
      err => console.warn('GPS:', err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => {
      if (gpsWatchRef.current != null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
  }, [activeTsId, supabase]);

  // ── Carga productos existentes al entrar a la vista scanning / agregar-stock ─
  useEffect(() => {
    if ((view !== 'scanning' && view !== 'agregar-stock') || !establishmentId) return;
    setLoadingProds(true);
    supabase
      .from('establishment_products_detail')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('name')
      .then(({ data }) => {
        setEpProducts((data as EstablishmentProductDetail[]) ?? []);
        setLoadingProds(false);
      });
  }, [view, establishmentId, supabase]);

  // Reset página al buscar
  useEffect(() => { setProductPage(0); }, [productSearch]);

  // ── Helpers ─────────────────────────────────────────────────
  const fetchTsItems = useCallback(async (tsId: string): Promise<TravelStockItem[]> => {
    const { data } = await supabase
      .from('travel_stock_items')
      .select('*')
      .eq('travel_stock_id', tsId);
    return (data as TravelStockItem[]) ?? [];
  }, [supabase]);

  // ── Check for active repartos on mount ──────────────────────
  useEffect(() => {
    if (!user || !establishmentId) {
      if (user && !establishmentId) setInitializing(false);
      return;
    }
    let cancelled = false;
    async function check() {
      // Traer TODOS los repartos activos del establecimiento
      const { data: repartos } = await supabase
        .from('travel_stocks')
        .select('id, created_at, assigned_to')
        .eq('establishment_id', establishmentId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (repartos && repartos.length > 0) {
        // Nombres de los asignados
        const ids = Array.from(new Set(repartos.map(r => r.assigned_to as string)));
        const { data: profs } = await supabase
          .from('profiles').select('id, full_name').in('id', ids);
        if (cancelled) return;

        const nameMap = new Map((profs ?? []).map(p => [p.id as string, p.full_name as string]));
        setAvailableRepartos(repartos.map(r => ({
          id:            r.id as string,
          created_at:    r.created_at as string,
          assigned_to:   r.assigned_to as string,
          assigned_name: nameMap.get(r.assigned_to as string) ?? 'Usuario',
        })));

        // Si el usuario tiene su propio reparto, ir directo al activo
        const mine = repartos.find(r => r.assigned_to === user!.id);
        if (mine) {
          const items = await fetchTsItems(mine.id as string);
          if (!cancelled) {
            setActiveTsId(mine.id as string);
            setTsItems(items);
            setView('active');
          }
          if (!cancelled) setInitializing(false);
          return;
        }

        // Si viene con ?ts=<id> desde el dashboard del dueño, auto-unirse
        if (tsParam) {
          const target = repartos.find(r => r.id === tsParam);
          if (target) {
            const items = await fetchTsItems(target.id as string);
            if (!cancelled) {
              setActiveTsId(target.id as string);
              setTsItems(items);
              setView('active');
            }
            if (!cancelled) setInitializing(false);
            return;
          }
        }
      }

      if (!cancelled) setInitializing(false);
    }
    check();
    return () => { cancelled = true; };
  }, [user, establishmentId, supabase, fetchTsItems, tsParam]);

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
      const lp = parseNetContent(local.net_content ?? '');
      setNetQty(lp.qty); setNetUnit(lp.unit);
      setScanning(false);
      return;
    }

    // 2. No está local → buscar en Open Food Facts
    const external = await lookupBarcode(code.trim());
    setScanning(false);

    if (external) {
      setExternalInfo({ barcode: code.trim(), name: external.name, brand: external.brand, quantity: external.quantity, unitType: external.unitType });
      const ep = parseNetContent(external.quantity);
      setNetQty(ep.qty); setNetUnit(ep.unit);
      setScanMode('external');
    } else {
      // 3. No encontrado en ningún lado → entrada manual
      setExternalInfo({ barcode: code.trim(), name: '', brand: null, quantity: null, unitType: null });
      setNetQty(''); setNetUnit('');
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
    setNetQty(''); setNetUnit('');
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
    const nc = netQty.trim() ? `${netQty.trim()} ${netUnit}`.trim() : null;
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

    const netContent = netQty.trim() ? `${netQty.trim()} ${netUnit}`.trim() : null;

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

  // ── Unirse al reparto de un colega ──────────────────────────
  async function joinReparto(tsId: string) {
    const items = await fetchTsItems(tsId);
    setActiveTsId(tsId);
    setTsItems(items);
    setView('active');
  }

  // ── Add stock to an already-active reparto ───────────────────
  async function handleAddStockToReparto() {
    if (!activeTsId || scanCart.length === 0) return;
    setCreating(true);
    setScanError(null);
    try {
      for (const item of scanCart) {
        const existing = tsItems.find(i => i.establishment_product_id === item.product.id);
        if (existing) {
          await supabase.from('travel_stock_items')
            .update({ quantity_assigned: existing.quantity_assigned + item.quantity })
            .eq('id', existing.id);
        } else {
          await supabase.from('travel_stock_items').insert({
            travel_stock_id:          activeTsId,
            establishment_product_id: item.product.id,
            product_name:             item.product.name,
            quantity_assigned:        item.quantity,
            quantity_sold:            0,
            unit_price:               item.product.price,
          });
        }
      }
      const updated = await fetchTsItems(activeTsId);
      setTsItems(updated);
      setScanCart([]);
      setView('active');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Error al agregar productos');
    } finally {
      setCreating(false);
    }
  }

  // ── Close reparto ────────────────────────────────────────────
  async function saveItemPrice() {
    if (!editPriceItem) return;
    const price = parseFloat(editPriceItem.value.replace(',', '.'));
    if (isNaN(price) || price <= 0) return;
    setSavingItemPrice(true);
    await supabase.from('travel_stock_items').update({ unit_price: price }).eq('id', editPriceItem.itemId);
    if (editPriceItem.epId) {
      await supabase.from('establishment_products').update({ price }).eq('id', editPriceItem.epId);
    }
    setTsItems(prev => prev.map(it => it.id === editPriceItem.itemId ? { ...it, unit_price: price } : it));
    setSavingItemPrice(false);
    setEditPriceItem(null);
  }

  async function handleCloseReparto() {
    if (!activeTsId) return;
    setCierreClosing(true);
    const { error } = await supabase.rpc('close_reparto', { p_travel_stock_id: activeTsId });
    if (error) { alert(error.message); setCierreClosing(false); return; }
    setActiveTsId(null);
    setTsItems([]);
    setLastVenta(null);
    setCierreDeliveries([]);
    setCierreClosing(false);
    setView('home');
  }

  // ── Prepare close summary screen ─────────────────────────────
  async function prepareCierre() {
    if (!activeTsId) return;
    setCierreLoading(true);
    const { data } = await supabase
      .from('deliveries')
      .select('*, customer:customers(*), items:delivery_items(*)')
      .eq('travel_stock_id', activeTsId)
      .order('created_at');
    setCierreDeliveries((data ?? []) as DeliveryFull[]);
    setCierreLoading(false);
    setView('cierre-reparto');
  }

  // ── Nueva venta ─────────────────────────────────────────────
  function startNuevaVenta() {
    setSelectedCustomer(null);
    setCart([]);
    setPayMethod('cash');
    setVentaError(null);
    setVentaStep('cliente');
    setCustomerSearch('');
    setVentaProductSearch('');
    setVentaProductPage(0);
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
      // Guardar punto de entrega en el mapa
      if (currentPosRef.current && activeTsId) {
        supabase.from('reparto_waypoints').insert({
          travel_stock_id: activeTsId,
          lat:           currentPosRef.current.lat,
          lng:           currentPosRef.current.lng,
          type:          'delivery',
          customer_name: selectedCustomer.name,
          total_amount:  total,
        }).then(() => {});
      }
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
    if (!establishmentId || !user) return;
    setHistorialLoading(true);

    // Cargar perfiles del establecimiento para mostrar nombres
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('establishment_id', establishmentId)
      .then(({ data }) => setHistorialProfiles((data ?? []) as { id: string; full_name: string }[]));

    if (activeTsId) {
      // Reparto activo: todas las ventas del reparto (lista plana)
      const { data } = await supabase
        .from('deliveries')
        .select('*, customer:customers(*), items:delivery_items(*)')
        .eq('travel_stock_id', activeTsId)
        .order('created_at', { ascending: false });
      setHistorial((data ?? []) as DeliveryWithCustomer[]);
      setRepartoGroups([]);
    } else {
      // Sin reparto activo: agrupar por reparto
      const [tsRes, delRes] = await Promise.all([
        supabase
          .from('travel_stocks')
          .select('id, created_at, status')
          .eq('establishment_id', establishmentId)
          .eq('assigned_to', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('deliveries')
          .select('*, customer:customers(*), items:delivery_items(*)')
          .eq('establishment_id', establishmentId)
          .eq('sold_by', user.id)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      const deliveries = (delRes.data ?? []) as DeliveryWithCustomer[];
      const groups = (tsRes.data ?? []).map(ts => ({
        tsId:       ts.id as string,
        date:       ts.created_at as string,
        status:     ts.status as string,
        deliveries: deliveries.filter(d => d.travel_stock_id === ts.id),
      })).filter(g => g.deliveries.length > 0);

      setRepartoGroups(groups);
      setHistorial([]);
    }

    setHistorialLoading(false);
  }, [supabase, establishmentId, activeTsId, user]);

  async function handleMarkPaid(deliveryId: string) {
    setMarkingPaid(deliveryId);
    try {
      const { error } = await supabase.rpc('mark_delivery_paid', {
        p_delivery_id: deliveryId,
        p_paid_by:     user!.id,
      });
      if (error) throw new Error(error.message);
      const update = { payment_status: 'paid' as const, paid_at: new Date().toISOString(), paid_by: user!.id };
      setHistorial(prev => prev.map(d => d.id === deliveryId ? { ...d, ...update } : d));
      setRepartoGroups(prev => prev.map(g => ({
        ...g,
        deliveries: g.deliveries.map(d => d.id === deliveryId ? { ...d, ...update } : d),
      })));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setMarkingPaid(null);
    }
  }

  // ── Nuevo cliente ────────────────────────────────────────────
  async function handleNewCustomer() {
    if (!newClientName.trim() || !establishmentId) return;
    setSavingClient(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          establishment_id: establishmentId,
          name:             newClientName.trim(),
          locality:         newClientLocality.trim() || null,
          barrio:           newClientBarrio.trim()   || null,
          phone:            newClientPhone.trim()    || null,
        })
        .select('*')
        .single();
      if (error) throw error;
      setSelectedCustomer(data as Customer);
      setVentaStep('productos');
      setView('nueva-venta');
      setNewClientName(''); setNewClientLocality('');
      setNewClientBarrio(''); setNewClientPhone('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar cliente');
    } finally {
      setSavingClient(false);
    }
  }

  // ── Auto-dismiss last venta notification after 6s ───────────
  useEffect(() => {
    if (!lastVenta) return;
    const t = setTimeout(() => setLastVenta(null), 6000);
    return () => clearTimeout(t);
  }, [lastVenta]);

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

  // ── Filtro de productos existentes ──────────────────────────
  const filteredEpProducts = useMemo(() => {
    if (!productSearch.trim()) return epProducts;
    const q = productSearch.toLowerCase();
    return epProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.brand ?? '').toLowerCase().includes(q)
    );
  }, [epProducts, productSearch]);

  // ── Filtro de items del camión en el paso de venta ───────────
  const filteredTsItems = useMemo(() => {
    if (!ventaProductSearch.trim()) return tsItems;
    const q = ventaProductSearch.toLowerCase();
    return tsItems.filter(i => i.product_name.toLowerCase().includes(q));
  }, [tsItems, ventaProductSearch]);

  // Reset página al buscar en venta
  useEffect(() => { setVentaProductPage(0); }, [ventaProductSearch]);

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

          <Link
            href="/dashboard/repartos"
            className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl border-2
                       border-slate-200 bg-white text-slate-700 transition-transform active:scale-[0.97]"
          >
            <History className="h-5 w-5 text-slate-400" />
            <span className="text-base font-semibold">Historial de repartos</span>
          </Link>

          {/* ── Repartos de colegas para unirse ── */}
          {availableRepartos.filter(r => r.assigned_to !== user?.id).length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Repartos en curso
              </p>
              {availableRepartos
                .filter(r => r.assigned_to !== user?.id)
                .map(r => (
                  <button
                    key={r.id}
                    onClick={() => joinReparto(r.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border-2
                               border-blue-200 bg-blue-50 px-4 py-4 mb-2
                               text-left transition-transform active:scale-[0.97]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                      <Truck className="h-5 w-5 text-blue-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-blue-900">
                        Reparto de {r.assigned_name.split(' ')[0]}
                      </p>
                      <p className="text-xs text-blue-600">
                        Iniciado a las {new Date(r.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · Tocá para unirte
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-blue-400" />
                  </button>
                ))
              }
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SCANNING — Carga de camioneta / Agregar productos
  // ─────────────────────────────────────────────────────────────
  if (view === 'scanning' || view === 'agregar-stock') {
    const isAgregando = view === 'agregar-stock';
    return (
      <div className="mx-auto max-w-md p-4 pb-32">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => setView(isAgregando ? 'active' : 'home')}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900">
              {isAgregando ? 'Agregar productos' : 'Cargar'}
            </h1>
            <p className="text-xs text-slate-500">
              {isAgregando ? 'Agregá más productos al reparto en curso' : 'Escaneá los productos que llevás hoy'}
            </p>
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

          {/* Input pistola + botón cámara */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={barcodeRef}
                autoFocus
                disabled={scanMode !== 'idle' || scanning}
                readOnly={cameraOpen}
                value={barcodeInput}
                onChange={e => {
                  const val = e.target.value;
                  if (val.includes('\n') || val.includes('\r')) {
                    const clean = val.replace(/[\r\n]/g, '').trim();
                    if (clean) handleBarcodeScan(clean);
                    return;
                  }
                  setBarcodeInput(val);
                }}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === 'Tab') && scanMode === 'idle') {
                    e.preventDefault();
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) handleBarcodeScan(val);
                  }
                }}
                onFocus={() => setScannerFocused(true)}
                onBlur={() => {
                  setScannerFocused(false);
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

            {/* Botón cámara */}
            <button
              disabled={scanMode !== 'idle' || scanning}
              onClick={() => { barcodeRef.current?.blur(); setCameraOpen(true); }}
              className="flex h-[58px] w-[58px] shrink-0 items-center justify-center
                         rounded-2xl bg-primary-700 text-white shadow-sm
                         active:bg-primary-800 disabled:opacity-40"
              title="Escanear con cámara"
            >
              <Camera className="h-6 w-6" />
            </button>
          </div>

          {scanError && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />{scanError}
            </p>
          )}
        </div>

        {/* Escáner de cámara */}
        {cameraOpen && (
          <CameraScanner
            onScan={code => {
              setCameraOpen(false);
              handleBarcodeScan(code);
            }}
            onClose={() => {
              setCameraOpen(false);
              setTimeout(() => barcodeRef.current?.focus(), 150);
            }}
          />
        )}

        {/* ── Modo LOCAL: producto ya estaba en el sistema ── */}
        {scanMode === 'local' && scannedProduct && (
          <div className="mb-4 rounded-2xl border-2 border-primary-200 bg-primary-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-500 mb-1">Producto encontrado</p>
            <p className="font-bold text-primary-900">{scannedProduct.name}</p>
            {scannedProduct.brand && <p className="text-xs text-primary-500">{scannedProduct.brand}</p>}
            <div className="mt-2 mb-3 space-y-2">
              <div>
                <label className="text-xs font-medium text-primary-600">Código de barras</label>
                <input
                  readOnly
                  value={scannedProduct.barcode}
                  className="block w-full rounded-xl border border-primary-200 bg-white/70 px-3 py-2 text-sm font-mono text-slate-600 select-all"
                />
              </div>
              <ContentInput
                label="Contenido del envase"
                qty={netQty}
                unit={netUnit}
                onQtyChange={setNetQty}
                onUnitChange={setNetUnit}
                labelClass="text-xs font-medium text-primary-600"
                borderClass="border-primary-200"
              />
              <div>
                <label className="text-xs font-medium text-primary-600">Precio de venta ($)</label>
                <div className="flex items-center rounded-xl border border-primary-200 bg-white px-3 py-2 text-base font-semibold min-h-[42px]">
                  {scanLocalPrice || <span className="text-slate-400">0</span>}
                </div>
                <NumPad value={scanLocalPrice} onChange={setScanLocalPrice} />
              </div>
            </div>
            <QtyControl
              value={scanQty}
              onChange={setScanQty}
              onConfirm={confirmLocalItem}
              onCancel={cancelScanDialog}
              confirmLabel={`Agregar (${scanQty})`}
              confirmDisabled={!scanLocalPrice || parseFloat(scanLocalPrice) <= 0}
            />
          </div>
        )}

        {/* ── Modo EXTERNAL: encontrado en Open Food Facts ── */}
        {scanMode === 'external' && externalInfo && (
          <div className="mb-4 rounded-2xl border-2 border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 mb-1">Encontrado en Open Food Facts</p>
            <div className="mb-3 space-y-2">
              <div>
                <label className="text-xs text-blue-600">Código de barras</label>
                <input
                  readOnly
                  value={externalInfo.barcode}
                  className="block w-full rounded-xl border border-blue-200 bg-white/70 px-3 py-2 text-sm font-mono text-slate-600 select-all"
                />
              </div>
              <KeyboardInput
                label="Nombre"
                value={externalInfo.name}
                onChange={v => setExternalInfo(prev => prev ? { ...prev, name: v } : prev)}
                labelClass="text-xs text-blue-600"
                borderClass="border-blue-200"
              />
              <ContentInput
                label="Contenido del envase"
                qty={netQty}
                unit={netUnit}
                onQtyChange={setNetQty}
                onUnitChange={setNetUnit}
                labelClass="text-xs text-blue-600"
                borderClass="border-blue-200"
              />
              <div>
                <label className="text-xs text-blue-600">Precio de venta ($)</label>
                <div className="flex items-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-base font-semibold min-h-[42px]">
                  {scanPrice || <span className="text-slate-400">0</span>}
                </div>
                <NumPad value={scanPrice} onChange={setScanPrice} />
              </div>
            </div>
            <QtyControl
              value={scanQty}
              onChange={setScanQty}
              onConfirm={confirmNewProduct}
              onCancel={cancelScanDialog}
              confirmLabel={`Agregar (${scanQty})`}
              confirmDisabled={!scanPrice || !externalInfo.name.trim()}
              confirming={creatingProduct}
            />
          </div>
        )}

        {/* ── Modo MANUAL: no encontrado en ningún lado ── */}
        {scanMode === 'manual' && (
          <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1">No encontrado — ingresar manualmente</p>
            <div className="mb-3 space-y-2">
              <div>
                <label className="text-xs text-amber-700">Código de barras</label>
                <input
                  readOnly
                  value={externalInfo?.barcode ?? ''}
                  className="block w-full rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-sm font-mono text-slate-600 select-all"
                />
              </div>
              <KeyboardInput
                label="Nombre del producto"
                value={scanManualName}
                onChange={setScanManualName}
                placeholder="Ej: Gaseosa Cola"
                labelClass="text-xs text-amber-700"
                borderClass="border-amber-200"
              />
              <ContentInput
                label="Contenido del envase (opcional)"
                qty={netQty}
                unit={netUnit}
                onQtyChange={setNetQty}
                onUnitChange={setNetUnit}
                labelClass="text-xs text-amber-700"
                borderClass="border-amber-200"
              />
              <div>
                <label className="text-xs text-amber-700">Precio de venta ($)</label>
                <div className="flex items-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-base font-semibold min-h-[42px]">
                  {scanPrice || <span className="text-slate-400">0</span>}
                </div>
                <NumPad value={scanPrice} onChange={setScanPrice} />
              </div>
            </div>
            <QtyControl
              value={scanQty}
              onChange={setScanQty}
              onConfirm={confirmNewProduct}
              onCancel={cancelScanDialog}
              confirmLabel={`Agregar (${scanQty})`}
              confirmDisabled={!scanPrice || !scanManualName.trim()}
              confirming={creatingProduct}
              confirmBg="bg-amber-600"
            />
          </div>
        )}

        {/* ── Productos cargados — colapsable, estilo ticket ── */}
        {scanCart.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setScanCartOpen(o => !o)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200
                         bg-white px-4 py-3 text-sm font-semibold text-slate-700
                         hover:bg-slate-50 active:bg-slate-100"
            >
              <div className="flex items-center gap-2">
                <span>Productos cargados</span>
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full
                                 bg-primary-700 px-1.5 text-[11px] font-bold text-white">
                  {scanCart.length}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${scanCartOpen ? 'rotate-180' : ''}`} />
            </button>

            {scanCartOpen && (
              <div className="mt-2 flex flex-col gap-2">
                {scanCart.map(item => (
                  <div
                    key={item.product.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex items-start justify-between px-4 pt-3 pb-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{item.product.name}</p>
                        {item.product.brand && (
                          <p className="text-[11px] text-slate-400">{item.product.brand}</p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatCurrency(item.product.price)} c/u
                          {item.product.net_content ? ` · ${item.product.net_content}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => setScanCart(prev => prev.filter(p => p.product.id !== item.product.id))}
                        className="ml-2 mt-0.5 text-slate-300 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mx-4 border-t border-dashed border-slate-200" />
                    <div className="flex items-center justify-between px-4 py-2">
                      <span className="text-xs font-semibold text-slate-400">
                        Subtotal: {formatCurrency(item.product.price * item.quantity)}
                      </span>
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
                        <span className="w-8 text-center text-sm font-black tabular-nums text-slate-900">
                          {item.quantity}
                        </span>
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
                    </div>
                  </div>
                ))}

                {/* Total general */}
                <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total cargado</span>
                  <span className="text-base font-black text-white tabular-nums">
                    {formatCurrency(scanCart.reduce((s, i) => s + i.product.price * i.quantity, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Elegir de productos existentes (colapsable, paginado) ── */}
        {scanMode === 'idle' && (
          <div className="mb-4">
            <button
              onClick={() => setProductListOpen(o => !o)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200
                         bg-white px-4 py-3 text-sm font-semibold text-slate-600
                         hover:bg-slate-50 active:bg-slate-100"
            >
              <span>Tus productos</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${productListOpen ? 'rotate-180' : ''}`} />
            </button>

            {productListOpen && (
              <div className="mt-2">
                {/* Buscador */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Buscar producto…"
                    className="block w-full rounded-xl border border-slate-200 bg-white
                               py-2.5 pl-9 pr-4 text-sm focus:border-primary-700 focus:outline-none"
                  />
                </div>

                {loadingProds ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : filteredEpProducts.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">
                    {epProducts.length === 0 ? 'Todavía no hay productos cargados' : 'No se encontraron productos'}
                  </p>
                ) : (() => {
                  const totalPages = Math.ceil(filteredEpProducts.length / PRODS_PER_PAGE);
                  const pageProds  = filteredEpProducts.slice(
                    productPage * PRODS_PER_PAGE,
                    (productPage + 1) * PRODS_PER_PAGE
                  );
                  return (
                    <>
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        {pageProds.map((p, i) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setScannedProduct(p);
                              setScanMode('local');
                              setScanQty(1);
                              setScanLocalPrice(String(p.price));
                              const lp = parseNetContent(p.net_content ?? '');
                              setNetQty(lp.qty);
                              setNetUnit(lp.unit);
                            }}
                            className={`flex w-full items-center justify-between px-4 py-3 text-left
                                        hover:bg-slate-50 active:bg-primary-50
                                        ${i > 0 ? 'border-t border-slate-100' : ''}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                              <p className="text-xs text-slate-400">
                                {formatCurrency(p.price)}
                                {p.net_content ? ` · ${p.net_content}` : ''}
                                {p.brand ? ` · ${p.brand}` : ''}
                              </p>
                            </div>
                            <Plus className="ml-3 h-4 w-4 shrink-0 text-primary-600" />
                          </button>
                        ))}
                      </div>

                      {/* Paginación */}
                      {totalPages > 1 && (
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <button
                            onClick={() => setProductPage(p => Math.max(0, p - 1))}
                            disabled={productPage === 0}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold
                                       disabled:opacity-30 hover:bg-slate-50"
                          >
                            ← Anterior
                          </button>
                          <span className="font-medium">
                            {productPage + 1} / {totalPages}
                          </span>
                          <button
                            onClick={() => setProductPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={productPage >= totalPages - 1}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold
                                       disabled:opacity-30 hover:bg-slate-50"
                          >
                            Siguiente →
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Botón iniciar ruta / agregar al reparto */}
        {scanCart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-slate-100 bg-white/95 p-4 backdrop-blur-sm">
            <div className="mx-auto max-w-md">
              <button
                onClick={isAgregando ? handleAddStockToReparto : handleCreateReparto}
                disabled={creating}
                className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl
                           bg-green-600 text-xl font-black text-white
                           transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                {creating
                  ? <Loader2 className="h-6 w-6 animate-spin" />
                  : <Truck className="h-6 w-6" />
                }
                {creating
                  ? (isAgregando ? 'Guardando…' : 'Iniciando reparto…')
                  : (isAgregando ? 'Agregar al reparto' : 'Iniciar reparto')
                }
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
    const totalGenerado  = tsItems.reduce((s, i) => s + i.quantity_sold * i.unit_price, 0);
    const totalRestanteMonto = tsItems.reduce((s, i) => s + (i.quantity_assigned - i.quantity_sold) * i.unit_price, 0);

    return (
      <div className="mx-auto max-w-md p-4 pt-6">
        {/* Status header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-slate-900">En reparto</h1>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              ● Activo
            </span>
          </div>

          {/* Resumen stock — unidades */}
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

          {/* Resumen en plata */}
          {totalGenerado > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-center">
                <p className="text-base font-black tabular-nums text-green-800">
                  {formatCurrency(totalGenerado)}
                </p>
                <p className="text-[11px] text-green-600">Generado en ventas</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                <p className="text-base font-black tabular-nums text-slate-700">
                  {formatCurrency(totalRestanteMonto)}
                </p>
                <p className="text-[11px] text-slate-400">En camioneta</p>
              </div>
            </div>
          )}
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
            <span className="text-xl font-black">NUEVA VENTA</span>
          </button>

          {/* Tres acciones secundarias en fila */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => { setScanCart([]); setScanError(null); setView('agregar-stock'); }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl
                         border-2 border-primary-200 bg-primary-50 py-4 text-primary-700
                         transition-transform active:scale-[0.97]"
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs font-bold">PRODUCTOS</span>
            </button>

            <button
              onClick={async () => { setView('historial'); await loadHistorial(); }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl
                         border-2 border-slate-200 bg-white py-4 text-slate-600
                         transition-transform active:scale-[0.97]"
            >
              <History className="h-5 w-5" />
              <span className="text-xs font-bold">VENTAS</span>
            </button>

            <button
              onClick={prepareCierre}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl
                         border-2 border-red-200 bg-red-50 py-4 text-red-600
                         transition-transform active:scale-[0.97]"
            >
              <X className="h-5 w-5" />
              <span className="text-xs font-bold">CERRAR</span>
            </button>
          </div>
        </div>

        {/* Stock en camioneta */}
        {tsItems.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Stock en camioneta
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {tsItems.map((item, i) => {
                const remaining  = item.quantity_assigned - item.quantity_sold;
                const isEditing  = editPriceItem?.itemId === item.id;
                return (
                  <div key={item.id} className={i > 0 ? 'border-t border-slate-100' : ''}>
                    <div className={`flex items-center justify-between px-4 py-3 ${
                      remaining === 0 ? 'bg-red-50/60' : 'bg-green-50/60'
                    }`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{item.product_name}</p>
                        {/* Precio — toca para editar */}
                        {isEditing ? (
                          <span className="text-xs font-bold text-primary-700">
                            ${editPriceItem!.value || '0'}
                          </span>
                        ) : (
                          <button
                            onClick={() => setEditPriceItem({ itemId: item.id, epId: item.establishment_product_id, value: String(item.unit_price) })}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary-700 transition-colors"
                          >
                            {formatCurrency(item.unit_price)} c/u
                            <Pencil className="h-3 w-3 opacity-60" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs tabular-nums">
                        <span className="text-slate-400">vendidos: {item.quantity_sold}</span>
                        <span className={`font-bold ${remaining === 0 ? 'text-red-400' : 'text-emerald-600'}`}>
                          quedan: {remaining}
                        </span>
                      </div>
                    </div>

                    {/* Editor de precio inline */}
                    {isEditing && (
                      <div className="border-t border-primary-100 bg-primary-50 px-4 py-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-primary-700">Nuevo precio</span>
                          <div className="flex gap-2">
                            <button
                              onClick={saveItemPrice}
                              disabled={savingItemPrice || !editPriceItem.value || parseFloat(editPriceItem.value) <= 0}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-700 text-white disabled:opacity-50"
                            >
                              {savingItemPrice
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={() => setEditPriceItem(null)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <NumPad
                          value={editPriceItem.value}
                          onChange={v => setEditPriceItem(prev => prev ? { ...prev, value: v } : prev)}
                        />
                      </div>
                    )}
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

        {/* Buscador + Nuevo cliente */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
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
          <button
            onClick={() => setVentaStep('nuevo-cliente')}
            className="flex items-center gap-1.5 rounded-xl border-2 border-primary-200
                       bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700
                       whitespace-nowrap transition-transform active:scale-[0.97]"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo
          </button>
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
    const ventaTotalPages = Math.ceil(filteredTsItems.length / PRODS_PER_PAGE);
    const ventaPageItems  = filteredTsItems.slice(
      ventaProductPage * PRODS_PER_PAGE,
      (ventaProductPage + 1) * PRODS_PER_PAGE,
    );

    return (
      <div className="mx-auto max-w-md p-4 pb-36">
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => setVentaStep('cliente')} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900">{selectedCustomer?.name}</h1>
            <p className="text-xs text-slate-500">Seleccioná los productos</p>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={ventaProductSearch}
            onChange={e => setVentaProductSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="block w-full rounded-xl border border-slate-200 bg-white
                       py-2.5 pl-9 pr-4 text-sm focus:border-primary-700 focus:outline-none"
          />
          {ventaProductSearch && (
            <button
              onClick={() => setVentaProductSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {filteredTsItems.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {tsItems.length === 0 ? 'No hay productos en el reparto' : 'No se encontraron productos'}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {ventaPageItems.map(item => {
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

            {/* Paginación */}
            {ventaTotalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <button
                  onClick={() => setVentaProductPage(p => Math.max(0, p - 1))}
                  disabled={ventaProductPage === 0}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold
                             disabled:opacity-30 hover:bg-slate-50"
                >
                  ← Anterior
                </button>
                <span className="font-medium">
                  {ventaProductPage + 1} / {ventaTotalPages}
                </span>
                <button
                  onClick={() => setVentaProductPage(p => Math.min(ventaTotalPages - 1, p + 1))}
                  disabled={ventaProductPage >= ventaTotalPages - 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold
                             disabled:opacity-30 hover:bg-slate-50"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}

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

    // ── Tarjeta de entrega estilo ticket (colapsable) ─────────
    const DeliveryCard = ({ d }: { d: DeliveryWithCustomer }) => {
      const sellerName       = historialProfiles.find(p => p.id === d.sold_by)?.full_name;
      const collectorName    = d.paid_by ? historialProfiles.find(p => p.id === d.paid_by)?.full_name : null;
      const isMySale         = d.sold_by === user?.id;
      const collectedByOther = d.paid_by && d.paid_by !== d.sold_by;
      const isPaid           = d.payment_status === 'paid';
      const isExpanded       = expandedDeliveries.has(d.id);

      function toggleExpand() {
        setExpandedDeliveries(prev => {
          const next = new Set(prev);
          next.has(d.id) ? next.delete(d.id) : next.add(d.id);
          return next;
        });
      }

      return (
        <div className={`overflow-hidden rounded-xl border-2 ${
          isPaid ? 'border-green-200 bg-white' : 'border-amber-200 bg-white'
        }`}>
          {/* Cabecera — toca para expandir */}
          <button
            onClick={toggleExpand}
            className={`flex w-full items-center justify-between px-4 py-3 text-left ${
              isPaid ? 'bg-green-50' : 'bg-amber-50'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-slate-900">{d.customer?.name}</p>
              <p className="text-[11px] text-slate-500">
                {new Date(d.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                {' · '}{payLabel(d.payment_method)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pl-3">
              <p className="text-sm font-black tabular-nums text-slate-900">
                {formatCurrency(Number(d.total_amount))}
              </p>
              {isPaid ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <ChevronDown className={`h-4 w-4 text-amber-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              )}
            </div>
          </button>

          {/* Detalle expandido */}
          {isExpanded && (
            <>
              {/* Líneas de productos */}
              {d.items && d.items.length > 0 && (
                <div className="px-4 py-2 space-y-1">
                  {d.items.map(item => (
                    <div key={item.id} className="flex items-baseline gap-2 text-sm">
                      <span className="w-5 shrink-0 text-right font-bold tabular-nums text-slate-500">{item.quantity}</span>
                      <span className="flex-1 truncate text-slate-700">{item.product_name}</span>
                      <span className="shrink-0 tabular-nums text-slate-600">{formatCurrency(item.unit_price)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Separador punteado */}
              <div className="mx-4 border-t border-dashed border-slate-200" />

              {/* Metadata + botón cobrar */}
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="text-[11px] text-slate-400 space-y-0.5">
                  {!isMySale && sellerName && (
                    <p>Vendió: <span className="font-semibold text-slate-500">{sellerName}</span></p>
                  )}
                  {collectedByOther && collectorName && (
                    <p>Cobró: <span className="font-semibold text-slate-500">{collectorName}</span></p>
                  )}
                </div>
                {!isPaid && (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmPaidId(d.id); }}
                    disabled={markingPaid === d.id}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5
                               text-xs font-bold text-white disabled:opacity-50"
                  >
                    {markingPaid === d.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <CheckCircle2 className="h-3 w-3" />}
                    Cobrar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      );
    }

    const confirmPaidDelivery =
      historial.find(d => d.id === confirmPaidId) ??
      (repartoGroups.flatMap(g => g.deliveries).find(d => d.id === confirmPaidId) ?? null);

    const confirmModal = (
      <Modal
        isOpen={!!confirmPaidId}
        onClose={() => setConfirmPaidId(null)}
        title="Confirmar cobro"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {confirmPaidDelivery && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="font-semibold text-slate-900">{confirmPaidDelivery.customer?.name}</p>
              <p className="text-lg font-black text-amber-800 tabular-nums">
                {formatCurrency(Number(confirmPaidDelivery.total_amount))}
              </p>
              <p className="text-xs text-slate-500">{payLabel(confirmPaidDelivery.payment_method)}</p>
            </div>
          )}
          <p className="text-sm text-slate-600">
            ¿Confirmás que recibiste el pago de esta entrega? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmPaidId(null)}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600
                         hover:bg-slate-50 active:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                const id = confirmPaidId!;
                setConfirmPaidId(null);
                await handleMarkPaid(id);
              }}
              className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white
                         hover:bg-green-700 active:scale-[0.97]"
            >
              Confirmar cobro
            </button>
          </div>
        </div>
      </Modal>
    );

    if (activeTsId) {
      // ── Vista: ventas del reparto activo ──────────────────────
      const paid    = historial.filter(d => d.payment_status === 'paid');
      const pending = historial.filter(d => d.payment_status === 'pending');
      const totalPaid    = paid.reduce((s, d) => s + Number(d.total_amount), 0);
      const totalPending = pending.reduce((s, d) => s + Number(d.total_amount), 0);

      return (
        <>
        <div className="mx-auto max-w-md p-4 pb-8">
          <div className="mb-5 flex items-center gap-3">
            <button onClick={() => setView('active')} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-black text-slate-900">Ventas del reparto</h1>
          </div>

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
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : historial.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Package className="h-12 w-12 text-slate-200" />
              <p className="text-sm text-slate-400">No hay ventas registradas aún</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {historial.map(d => <DeliveryCard key={d.id} d={d} />)}
            </div>
          )}
        </div>
        {confirmModal}
      </>
      );
    }

    // ── Vista: historial agrupado por repartos ────────────────
    return (
      <>
      <div className="mx-auto max-w-md p-4 pb-8">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => setView('home')} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-black text-slate-900">Historial de repartos</h1>
        </div>

        {historialLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : repartoGroups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Package className="h-12 w-12 text-slate-200" />
            <p className="text-sm text-slate-400">No hay repartos registrados aún</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {repartoGroups.map(group => {
              const gPaid    = group.deliveries.filter(d => d.payment_status === 'paid');
              const gPending = group.deliveries.filter(d => d.payment_status === 'pending');
              const gTotal   = group.deliveries.reduce((s, d) => s + Number(d.total_amount), 0);
              return (
                <div key={group.tsId}>
                  {/* Cabecera del reparto */}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary-600" />
                      <p className="text-sm font-black text-slate-800">
                        Reparto {new Date(group.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        group.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {group.status === 'active' ? 'Activo' : 'Completado'}
                      </span>
                    </div>
                    <p className="text-sm font-black text-slate-900">{formatCurrency(gTotal)}</p>
                  </div>

                  {/* Mini resumen */}
                  <div className="mb-2 flex gap-3 text-xs">
                    <span className="text-green-700 font-semibold">{gPaid.length} cobrada{gPaid.length !== 1 ? 's' : ''}</span>
                    {gPending.length > 0 && (
                      <span className="text-amber-600 font-semibold">{gPending.length} pendiente{gPending.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  {/* Entregas del reparto */}
                  <div className="flex flex-col gap-2">
                    {group.deliveries.map(d => <DeliveryCard key={d.id} d={d} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {confirmModal}
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // NUEVA VENTA — Sub-step: NUEVO CLIENTE
  // ─────────────────────────────────────────────────────────────
  if (view === 'nueva-venta' && ventaStep === 'nuevo-cliente') {
    return (
      <div className="mx-auto max-w-md p-4 pb-8">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => setVentaStep('cliente')} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900">Nuevo cliente</h1>
            <p className="text-xs text-slate-500">Completá los datos del nuevo cliente</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nombre *
            </label>
            <input
              autoFocus
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="block w-full rounded-xl border border-slate-200 px-4 py-3
                         text-sm focus:border-primary-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Localidad
            </label>
            <input
              value={newClientLocality}
              onChange={e => setNewClientLocality(e.target.value)}
              placeholder="Ej: San Martín"
              className="block w-full rounded-xl border border-slate-200 px-4 py-3
                         text-sm focus:border-primary-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Barrio
            </label>
            <input
              value={newClientBarrio}
              onChange={e => setNewClientBarrio(e.target.value)}
              placeholder="Ej: Centro"
              className="block w-full rounded-xl border border-slate-200 px-4 py-3
                         text-sm focus:border-primary-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Teléfono
            </label>
            <input
              value={newClientPhone}
              onChange={e => setNewClientPhone(e.target.value)}
              placeholder="Ej: 1123456789"
              type="tel"
              className="block w-full rounded-xl border border-slate-200 px-4 py-3
                         text-sm focus:border-primary-700 focus:outline-none"
            />
          </div>

          <button
            onClick={handleNewCustomer}
            disabled={!newClientName.trim() || savingClient}
            className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl
                       bg-primary-700 text-base font-black text-white
                       transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            {savingClient
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <UserPlus className="h-5 w-5" />
            }
            {savingClient ? 'Guardando…' : 'Crear cliente y continuar'}
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // CIERRE DEL REPARTO — resumen completo
  // ─────────────────────────────────────────────────────────────
  if (view === 'cierre-reparto') {
    const totalVendidoMonto = cierreDeliveries.reduce((s, d) => s + Number(d.total_amount), 0);

    return (
      <div className="mx-auto max-w-md p-4 pb-32">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => setView('active')} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900">Cierre del reparto</h1>
            <p className="text-xs text-slate-500">Revisá el resumen antes de cerrar</p>
          </div>
        </div>

        {cierreLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* ── Resumen de stock ── */}
            <div className="mb-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                Resumen de stock
              </p>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {/* Header */}
                <div className="grid grid-cols-4 gap-2 border-b border-slate-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="col-span-2">Producto</span>
                  <span className="text-center">Cargado</span>
                  <span className="text-center">Sobró</span>
                </div>
                {tsItems.map((item, i) => {
                  const sobrante = item.quantity_assigned - item.quantity_sold;
                  return (
                    <div
                      key={item.id}
                      className={`grid grid-cols-4 gap-2 px-4 py-3 text-sm ${i > 0 ? 'border-t border-slate-50' : ''}`}
                    >
                      <span className="col-span-2 truncate font-medium text-slate-800">{item.product_name}</span>
                      <span className="text-center tabular-nums text-slate-500">{item.quantity_assigned}</span>
                      <span className={`text-center font-bold tabular-nums ${
                        sobrante > 0 ? 'text-green-600' : sobrante < 0 ? 'text-red-600' : 'text-slate-400'
                      }`}>
                        {sobrante > 0 ? `+${sobrante}` : sobrante}
                      </span>
                    </div>
                  );
                })}
                {tsItems.length === 0 && (
                  <p className="px-4 py-6 text-center text-xs text-slate-400">Sin productos registrados</p>
                )}
              </div>
            </div>

            {/* ── Ventas realizadas ── */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ventas realizadas
                </p>
                <p className="text-sm font-black text-slate-900">{formatCurrency(totalVendidoMonto)}</p>
              </div>

              {cierreDeliveries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white py-8 text-center">
                  <Package className="h-10 w-10 text-slate-200" />
                  <p className="text-sm text-slate-400">No se registraron ventas</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {cierreDeliveries.map(d => (
                    <div key={d.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      {/* Cabecera de la entrega */}
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <div>
                          <p className="font-bold text-slate-900">{d.customer?.name}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(d.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900 tabular-nums">{formatCurrency(Number(d.total_amount))}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            d.payment_method === 'cash'       ? 'bg-green-100 text-green-700' :
                            d.payment_method === 'transfer'   ? 'bg-blue-100 text-blue-700'   :
                                                                'bg-amber-100 text-amber-700'
                          }`}>
                            {payLabel(d.payment_method)}
                          </span>
                        </div>
                      </div>
                      {/* Productos de la entrega */}
                      <div className="px-4 py-2">
                        {(d.items ?? []).map(item => (
                          <div key={item.id} className="flex items-center justify-between py-1.5 text-sm">
                            <span className="text-slate-700">
                              {item.quantity} × {item.product_name}
                            </span>
                            <span className="tabular-nums text-slate-500">{formatCurrency(item.subtotal)}</span>
                          </div>
                        ))}
                        {(!d.items || d.items.length === 0) && (
                          <p className="py-2 text-xs text-slate-400">Sin detalle de productos</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Botón confirmar cierre */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-100 bg-white/95 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-md">
            <button
              onClick={handleCloseReparto}
              disabled={cierreClosing || cierreLoading}
              className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl
                         bg-red-600 text-xl font-black text-white
                         transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              {cierreClosing
                ? <Loader2 className="h-6 w-6 animate-spin" />
                : <X className="h-6 w-6" />
              }
              {cierreClosing ? 'Cerrando reparto…' : 'CERRAR REPARTO'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function RepartoPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-700" />
      </div>
    }>
      <RepartoPage />
    </Suspense>
  );
}
