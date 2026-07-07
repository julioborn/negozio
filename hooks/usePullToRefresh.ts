'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const THRESHOLD   = 80;   // px a bajar para disparar el refresh
const MAX_PULL    = 120;  // px máximo de arrastre visual

export function usePullToRefresh(onRefresh: () => void) {
  const [pullY,        setPullY]        = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef    = useRef<number | null>(null);
  const pullingRef   = useRef(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try { await onRefresh(); } finally {
      // Pequeña pausa para que el spinner sea visible
      setTimeout(() => {
        setIsRefreshing(false);
        setPullY(0);
      }, 800);
    }
  }, [onRefresh]);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      // Solo activar si estamos al tope del scroll
      if (window.scrollY === 0) {
        startYRef.current = e.touches[0]!.clientY;
        pullingRef.current = false;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (startYRef.current === null || isRefreshing) return;

      const diff = e.touches[0]!.clientY - startYRef.current;

      // Una vez que empezamos a jalar, seguimos aunque scrollY cambie levemente
      if (diff > 0 && (window.scrollY < 4 || pullingRef.current)) {
        pullingRef.current = true;
        const clamped = Math.min(diff * 0.5, MAX_PULL);
        setPullY(clamped);
        e.preventDefault(); // prevenir desde el primer px
      } else if (diff <= 0 && pullingRef.current) {
        setPullY(0);
        pullingRef.current = false;
      }
    }

    function onTouchEnd() {
      if (startYRef.current === null) return;
      startYRef.current = null;

      if (pullingRef.current && pullY >= THRESHOLD / 2 && !isRefreshing) {
        handleRefresh();
      } else {
        setPullY(0);
      }
      pullingRef.current = false;
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove',  onTouchMove,  { passive: false });
    document.addEventListener('touchend',   onTouchEnd,   { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove',  onTouchMove);
      document.removeEventListener('touchend',   onTouchEnd);
    };
  }, [pullY, isRefreshing, handleRefresh]);

  return { pullY, isRefreshing };
}
