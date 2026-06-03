'use client';

import { useCallback } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, RefreshCw } from 'lucide-react';

import { usePullToRefresh } from '@/hooks/usePullToRefresh';

const THRESHOLD = 40; // mitad del THRESHOLD del hook (ya viene / 2)

export function PullToRefresh() {
  const router = useRouter();

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const { pullY, isRefreshing } = usePullToRefresh(handleRefresh);

  const visible   = pullY > 4 || isRefreshing;
  const progress  = Math.min(pullY / THRESHOLD, 1);       // 0 → 1
  const rotate    = progress * 270;
  const translateY = isRefreshing ? 16 : pullY - 28;     // 28 = mitad del círculo

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[9998] flex justify-center"
      style={{ transform: `translateY(${Math.max(translateY, 0)}px)`, transition: isRefreshing ? 'transform 0.2s ease' : 'none' }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg"
        style={{
          backgroundColor: '#1700a5',
          opacity: Math.max(progress * 1.5, isRefreshing ? 1 : 0),
          transform: `scale(${0.6 + progress * 0.4})`,
          transition: isRefreshing ? 'all 0.2s ease' : 'opacity 0.1s, transform 0.1s',
        }}
      >
        {isRefreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        ) : (
          <RefreshCw
            className="h-5 w-5 text-white"
            style={{ transform: `rotate(${rotate}deg)`, transition: 'none' }}
          />
        )}
      </div>
    </div>
  );
}
