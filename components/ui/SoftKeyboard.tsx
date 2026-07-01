'use client';

import { useState } from 'react';

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
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<KBMode>('lower');
  const isUpper = mode === 'upper';

  function press(key: string) {
    if (key === '⇧')    { setMode(isUpper ? 'lower' : 'upper'); return; }
    if (key === '⌫')    { onChange(value.slice(0, -1)); return; }
    if (key === '123')  { setMode('num'); return; }
    if (key === 'ABC')  { setMode('lower'); return; }
    if (key === 'Listo'){ onDone(); return; }
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
            const isDark  = DARK.has(key);
            const isSpace = key === ' ';
            const isListo = key === 'Listo';
            const isShiftActive = key === '⇧' && isUpper;

            return (
              <button
                key={key}
                type="button"
                onMouseDown={e => { e.preventDefault(); press(key); }}
                onTouchStart={e => { e.preventDefault(); press(key); }}
                className={[
                  'flex h-[43px] items-center justify-center rounded-[5px]',
                  'shadow-[0_1px_0_rgba(0,0,0,0.32)] active:opacity-60',
                  isSpace
                    ? 'flex-1 bg-white text-slate-900'
                    : isListo
                    ? 'w-[82px] bg-[#AAB4BF] text-[13px] font-bold text-slate-700'
                    : isDark
                    ? `w-[43px] font-medium text-slate-800 ${isShiftActive ? 'bg-white' : 'bg-[#AAB4BF]'}`
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

// ─── Componente wrapper para inputs de texto ───────────────────
interface KeyboardInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  labelClass?: string;
  borderClass?: string;
}

export function KeyboardInput({
  value,
  onChange,
  placeholder,
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
            value ? 'text-slate-900' : 'text-slate-400',
          ].join(' ')}
        >
          <span className="flex-1">{value || placeholder || ''}</span>
          {open && (
            <span className="ml-0.5 inline-block h-[1.1em] w-[2px] animate-[blink_1s_step-end_infinite] bg-slate-700" />
          )}
        </div>
      </div>

      {/* Keyboard overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onMouseDown={() => setOpen(false)}
            onTouchStart={() => setOpen(false)}
          />
          <SoftKeyboard
            value={value}
            onChange={onChange}
            onDone={() => setOpen(false)}
          />
        </>
      )}
    </>
  );
}
