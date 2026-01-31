import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Hook for lazy loading elements using IntersectionObserver.
 * Only triggers loading when element enters viewport.
 */
export function useLazyLoad<T extends HTMLElement = HTMLDivElement>(
  options: {
    rootMargin?: string;
    threshold?: number;
    triggerOnce?: boolean;
  } = {}
): {
  ref: React.RefObject<T>;
  isVisible: boolean;
  hasBeenVisible: boolean;
} {
  const { 
    rootMargin = "100px", // Pre-load slightly before entering viewport
    threshold = 0.01,
    triggerOnce = true 
  } = options;
  
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    // Skip if already visible and triggerOnce is true
    if (triggerOnce && hasBeenVisible) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        const visible = entry.isIntersecting;
        
        setIsVisible(visible);
        
        if (visible && !hasBeenVisible) {
          setHasBeenVisible(true);
          
          // Disconnect if we only need to trigger once
          if (triggerOnce) {
            observer.disconnect();
          }
        }
      },
      {
        rootMargin,
        threshold,
      }
    );
    
    observer.observe(element);
    
    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold, triggerOnce, hasBeenVisible]);
  
  return { ref, isVisible, hasBeenVisible };
}

/**
 * Hook for lazy loading images with placeholder support.
 * Returns loading state and the final image URL.
 */
export function useLazyImage(
  loadImage: () => Promise<string | null>,
  options: {
    rootMargin?: string;
    enabled?: boolean;
  } = {}
): {
  containerRef: React.RefObject<HTMLDivElement>;
  imageUrl: string | null;
  isLoading: boolean;
  hasLoaded: boolean;
} {
  const { rootMargin = "100px", enabled = true } = options;
  
  const { ref: containerRef, hasBeenVisible } = useLazyLoad<HTMLDivElement>({
    rootMargin,
    triggerOnce: true,
  });
  
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const loadAttemptedRef = useRef(false);
  
  useEffect(() => {
    // Only load when visible and enabled
    if (!hasBeenVisible || !enabled || loadAttemptedRef.current) return;
    
    loadAttemptedRef.current = true;
    setIsLoading(true);
    
    loadImage()
      .then((url) => {
        setImageUrl(url);
        setHasLoaded(true);
      })
      .catch((err) => {
        console.warn("[useLazyImage] Failed to load image:", err);
        setHasLoaded(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [hasBeenVisible, enabled, loadImage]);
  
  return { containerRef, imageUrl, isLoading, hasLoaded };
}

/**
 * Hook for virtualized list item visibility tracking.
 * Useful for list items that need to know if they're in view.
 */
export function useVisibilityTracking<T extends HTMLElement = HTMLDivElement>(
  onVisibilityChange?: (isVisible: boolean) => void
): {
  ref: React.RefObject<T>;
  isVisible: boolean;
} {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);
  const onVisibilityChangeRef = useRef(onVisibilityChange);
  
  // Keep callback ref updated without triggering effect
  useEffect(() => {
    onVisibilityChangeRef.current = onVisibilityChange;
  }, [onVisibilityChange]);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        const visible = entry.isIntersecting;
        
        setIsVisible(visible);
        onVisibilityChangeRef.current?.(visible);
      },
      {
        rootMargin: "50px",
        threshold: 0.01,
      }
    );
    
    observer.observe(element);
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  return { ref, isVisible };
}

/**
 * Hook for lazy thumbnail loading with caching support.
 * Uses the thumbnail cache system for optimal performance.
 */
export function useLazyThumbnail(
  videoId: string | null,
  loadThumbnail: () => Promise<Blob | null>,
  options: {
    rootMargin?: string;
    enabled?: boolean;
    size?: "sm" | "md" | "lg";
  } = {}
): {
  containerRef: React.RefObject<HTMLDivElement>;
  thumbnailUrl: string | null;
  isLoading: boolean;
  hasLoaded: boolean;
} {
  const { rootMargin = "200px", enabled = true, size = "md" } = options;
  
  const { ref: containerRef, hasBeenVisible } = useLazyLoad<HTMLDivElement>({
    rootMargin,
    triggerOnce: true,
  });
  
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const loadAttemptedRef = useRef(false);
  
  useEffect(() => {
    // Only load when visible and enabled
    if (!hasBeenVisible || !enabled || !videoId || loadAttemptedRef.current) return;
    
    loadAttemptedRef.current = true;
    setIsLoading(true);
    
    // Dynamic import to avoid circular dependencies
    import("@/lib/thumbnailCache").then(async ({ getCachedThumbnail, cacheThumbnail, getThumbnailCacheKey }) => {
      const cacheKey = getThumbnailCacheKey(videoId, 0, size);
      
      // Check cache first
      const cached = await getCachedThumbnail(cacheKey);
      if (cached) {
        setThumbnailUrl(cached);
        setHasLoaded(true);
        setIsLoading(false);
        return;
      }
      
      // Load and cache
      try {
        const blob = await loadThumbnail();
        if (blob) {
          // Get dimensions from blob (use createImageBitmap)
          const bitmap = await createImageBitmap(blob);
          const url = await cacheThumbnail(cacheKey, blob, bitmap.width, bitmap.height);
          bitmap.close();
          setThumbnailUrl(url);
        }
        setHasLoaded(true);
      } catch (err) {
        console.warn("[useLazyThumbnail] Failed to load thumbnail:", err);
        setHasLoaded(true);
      } finally {
        setIsLoading(false);
      }
    });
  }, [hasBeenVisible, enabled, videoId, size, loadThumbnail]);
  
  return { containerRef, thumbnailUrl, isLoading, hasLoaded };
}
