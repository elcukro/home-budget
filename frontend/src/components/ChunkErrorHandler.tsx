'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * This component listens for chunk loading errors (which happen when
 * the browser tries to load stale JS/CSS files after a new build)
 * and automatically refreshes the page to get the latest version.
 */
export default function ChunkErrorHandler() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const message = event.message || '';
      const filename = event.filename || '';

      // Check if this is a chunk loading error or related React error
      const isChunkError =
        message.includes('Loading chunk') ||
        message.includes('ChunkLoadError') ||
        message.includes('Loading CSS chunk') ||
        message.includes('Minified React error #423') ||
        message.includes('Minified React error #418') ||
        message.includes('Minified React error #419') ||
        (filename.includes('_next/static') && event.error?.name === 'ChunkLoadError');

      if (isChunkError) {
        logger.warn('[ChunkErrorHandler] Chunk loading error detected, refreshing page:', message);

        // Clear service worker cache if available
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
        }

        // Force a hard refresh to get new chunks
        window.location.reload();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason?.message || String(reason) || '';

      // Check if this is a dynamic import error (chunk loading)
      const isChunkError =
        message.includes('Loading chunk') ||
        message.includes('ChunkLoadError') ||
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes("Unexpected token '<'"); // HTML error page instead of JS

      if (isChunkError) {
        logger.warn('[ChunkErrorHandler] Dynamic import error detected, refreshing page:', message);

        // Clear service worker cache if available
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
        }

        // Force a hard refresh to get new chunks
        window.location.reload();
      }
    };

    // Listen for chunk loading errors
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
