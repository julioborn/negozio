'use client';

import { useRef, useState } from 'react';

// ─── NumPad (exportado — usado para precios también) ───────────
const PAD_KEYS = ['7','8','9','4','5','6','1','2','3','.','0','⌫'] as const;

export function NumPad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-1 grid grid-cols-3 gap-1.5">
      {PAD_KEYS.map(k => (
        <button
          key={k}
          type="button"
          onPointerDown={e => {
            e.preventDefault();
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

// ─── ContentInput — cantidad + unidad para envase ─────────────
export const CONTENT_UNITS = [
  { v: 'g',     l: 'g',    full: 'Gramos'               },
  { v: 'kg',    l: 'kg',   full: 'Kilogramos'            },
  { v: 'mg',    l: 'mg',   full: 'Miligramos'            },
  { v: 'ml',    l: 'ml',   full: 'Mililitros'            },
  { v: 'L',     l: 'L',    full: 'Litros'                },
  { v: 'cl',    l: 'cl',   full: 'Centilitros'           },
  { v: 'cc',    l: 'cc',   full: 'CC (cm³)'              },
  { v: 'un',    l: 'un',   full: 'Unidades'              },
  { v: 'par',   l: 'par',  full: 'Par'                   },
  { v: 'paq',   l: 'paq',  full: 'Paquete'               },
  { v: 'caja',  l: 'caja', full: 'Caja'                  },
  { v: 'doc',   l: 'doc',  full: 'Docena'                },
  { v: 'm',     l: 'm',    full: 'Metros'                },
  { v: 'cm',    l: 'cm',   full: 'Centímetros'           },
] as const;

interface ContentInputProps {
  qty: string;
  unit: string;
  onQtyChange: (v: string) => void;
  onUnitChange: (v: string) => void;
  label?: string;
  labelClass?: string;
  borderClass?: string;
}

export function ContentInput({
  qty, unit, onQtyChange, onUnitChange,
  label,
  labelClass  = 'text-xs font-medium text-slate-600',
  borderClass = 'border-slate-200',
}: ContentInputProps) {
  const [padOpen, setPadOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function openPad() {
    setPadOpen(true);
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  return (
    <div ref={ref}>
      {label && <label className={labelClass}>{label}</label>}
      <div className="mt-0.5 flex gap-2">

        {/* Número — abre NumPad al tocar */}
        <div
          role="textbox"
          tabIndex={0}
          onClick={openPad}
          className={[
            'flex h-[42px] w-28 shrink-0 cursor-pointer items-center justify-center',
            'rounded-xl border bg-white px-3 text-base font-semibold',
            borderClass,
            qty ? 'text-slate-900' : 'text-slate-400',
          ].join(' ')}
        >
          <span>
            {qty || '—'}
            {padOpen && (
              <span className="ml-0.5 inline-block h-[1.1em] w-[2px] animate-[blink_1s_step-end_infinite] bg-slate-700" />
            )}
          </span>
        </div>

        {/* Selector de unidad — nativo (wheel en iOS, dropdown en Android) */}
        <select
          value={unit}
          onChange={e => onUnitChange(e.target.value)}
          className={[
            'flex-1 rounded-xl border bg-white px-2 text-base text-slate-900 focus:outline-none',
            borderClass,
          ].join(' ')}
        >
          <option value="">Unidad…</option>
          {CONTENT_UNITS.map(u => (
            <option key={u.v} value={u.v}>{u.l} — {u.full}</option>
          ))}
        </select>
      </div>

      {/* NumPad overlay */}
      {padOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onPointerDown={() => setPadOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-[9999] rounded-t-2xl bg-white px-4 pt-4 shadow-2xl border-t border-slate-200"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">Cantidad</span>
              <span className="text-3xl font-black tracking-tight text-slate-900">
                {qty || '0'}
              </span>
            </div>
            <NumPad value={qty} onChange={onQtyChange} />
            <button
              type="button"
              onPointerDown={e => { e.preventDefault(); setPadOpen(false); }}
              className="mt-3 w-full rounded-xl bg-primary-700 py-3 text-sm font-bold text-white"
            >
              Listo
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Teclado QWERTY custom ────────────────────────────────────
type KBMode = 'lower' | 'upper' | 'num';

const ROWS: Record<KBMode, string[][]> = {
  lower: [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['⇧','z','x','c','v','b','n','m','⌫'],
    ['123',' ','Listo'],
  ],
  upper: [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['⇧','Z','X','C','V','B','N','M','⌫'],
    ['123',' ','Listo'],
  ],
  num: [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['.','×','-','(',')','/',',','%','@','#'],
    ['!','?',"'",'_','+','=','"','&','*','⌫'],
    ['ABC',' ','Listo'],
  ],
};

const DARK = new Set(['⇧','⌫','123','ABC']);

function SoftKeyboard({
  value, onChange, onDone,
}: { value: string; onChange: (v: string) => void; onDone: () => void }) {
  const [mode, setMode] = useState<KBMode>('lower');
  const isUpper = mode === 'upper';

  function press(key: string) {
    if (key === '⇧')     { setMode(isUpper ? 'lower' : 'upper'); return; }
    if (key === '⌫')     { onChange(value.slice(0, -1)); return; }
    if (key === '123')   { setMode('num'); return; }
    if (key === 'ABC')   { setMode('lower'); return; }
    if (key === 'Listo') { onDone(); return; }
    onChange(value + key);
    if (mode === 'upper') setMode('lower');
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] select-none bg-[#D1D5DB] px-1.5 pt-2"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      {ROWS[mode].map((row, ri) => (
        <div key={ri} className="mb-1.5 flex items-center justify-center gap-1">
          {row.map(key => {
            const isDark        = DARK.has(key);
            const isSpace       = key === ' ';
            const isListo       = key === 'Listo';
            const isShiftActive = key === '⇧' && isUpper;
            return (
              <button
                key={key}
                type="button"
                onPointerDown={e => { e.preventDefault(); press(key); }}
                className={[
                  'flex h-[43px] items-center justify-center rounded-[5px]',
                  'shadow-[0_1px_0_rgba(0,0,0,0.32)] active:opacity-60',
                  isSpace  ? 'flex-1 bg-white text-slate-900'
                  : isListo ? 'w-[82px] bg-[#AAB4BF] text-[13px] font-bold text-slate-700'
                  : isDark  ? `w-[43px] font-medium text-slate-800 ${isShiftActive ? 'bg-white' : 'bg-[#AAB4BF]'}`
                  : 'flex-1 bg-white text-[17px] text-slate-900',
                ].join(' ')}
              >
                {key === '⇧'
                  ? <span className="text-[18px]">{isUpper ? '⬆' : '⇧'}</span>
                  : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── KeyboardInput — display + teclado QWERTY ─────────────────
interface KeyboardInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  labelClass?: string;
  borderClass?: string;
}

export function KeyboardInput({
  value, onChange, placeholder,
  label,
  labelClass  = 'text-xs font-medium text-slate-600',
  borderClass = 'border-slate-200',
}: KeyboardInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div>
        {label && <label className={labelClass}>{label}</label>}
        <div
          role="textbox"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={e => e.key === 'Enter' && setOpen(true)}
          className={[
            'flex min-h-[42px] cursor-text items-center rounded-xl border bg-white px-3 py-2 text-base',
            borderClass,
          ].join(' ')}
        >
          {/* Cursor va DENTRO del span, pegado al último carácter */}
          <span className={`flex-1 ${value ? 'text-slate-900' : 'text-slate-400'}`}>
            {value || placeholder || ''}
            {open && (
              <span className="ml-0.5 inline-block h-[1.1em] w-[2px] align-middle
                               animate-[blink_1s_step-end_infinite] bg-slate-700" />
            )}
          </span>
          {/* Botón para limpiar todo */}
          {value && (
            <button
              type="button"
              onPointerDown={e => { e.preventDefault(); onChange(''); }}
              className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center
                         rounded-full bg-slate-200 text-[10px] text-slate-500"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-[9998]" onPointerDown={() => setOpen(false)} />
          <SoftKeyboard value={value} onChange={onChange} onDone={() => setOpen(false)} />
        </>
      )}
    </>
  );
}
