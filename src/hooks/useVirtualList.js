import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Progressive rendering hook using IntersectionObserver.
 * Renders `batchSize` items initially, then loads more as the user scrolls.
 */
export function useVirtualList(items, { batchSize = 30 } = {}) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const sentinelRef = useRef(null);

  // Reset when items change significantly
  useEffect(() => {
    setVisibleCount(batchSize);
  }, [items.length, batchSize]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + batchSize, items.length));
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, batchSize]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return { visibleItems, hasMore, sentinelRef, total: items.length };
}
