'use client';

import { useRef, useState, useCallback, ReactNode } from 'react';

const THRESHOLD = 72;
const MAX_PULL = 100;

interface Props {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop ?? window.scrollY;
    if (scrollTop > 2) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const el = containerRef.current;
    const scrollTop = el?.scrollTop ?? window.scrollY;
    if (scrollTop > 2) { pulling.current = false; setPull(0); return; }
    const dist = e.touches[0].clientY - startY.current;
    if (dist <= 0) { setPull(0); return; }
    // resist past threshold
    const damped = dist < THRESHOLD ? dist : THRESHOLD + (dist - THRESHOLD) * 0.3;
    setPull(Math.min(damped, MAX_PULL));
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }, [pull, onRefresh]);

  const progress = Math.min(pull / THRESHOLD, 1);
  const isReady = pull >= THRESHOLD;

  return (
    <div
      ref={containerRef}
      className="ptr-container"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Indicador de pull */}
      <div
        className="ptr-indicator"
        style={{ height: refreshing ? THRESHOLD : pull, opacity: refreshing ? 1 : progress }}
      >
        <div className={`ptr-circle ${refreshing ? 'ptr-spinning' : ''}`}>
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            style={{
              transform: `rotate(${refreshing ? 0 : progress * 270}deg)`,
              transition: refreshing ? 'none' : 'transform 0.05s linear',
            }}
          >
            <circle
              cx="12" cy="12" r="9"
              fill="none"
              stroke={isReady || refreshing ? '#ba2309' : '#aaa'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={`${(refreshing ? 0.75 : progress) * 56.5} 56.5`}
              strokeDashoffset="0"
            />
          </svg>
        </div>
        {!refreshing && pull > 20 && (
          <span className="ptr-label">{isReady ? 'Suelta para actualizar' : 'Baja para actualizar'}</span>
        )}
        {refreshing && <span className="ptr-label">Actualizando...</span>}
      </div>

      <div
        style={{
          transform: `translateY(${refreshing ? THRESHOLD : pull}px)`,
          transition: (!pulling.current || refreshing) ? 'transform 0.28s ease' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
