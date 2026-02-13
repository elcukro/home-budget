'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { X, ZoomIn } from 'lucide-react';

interface ManualScreenshotProps {
  src: string;
  alt: string;
  caption?: string;
}

export default function ManualScreenshot({ src, alt, caption }: ManualScreenshotProps) {
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);

  return (
    <>
      <figure className="group">
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-full rounded-2xl overflow-hidden border border-emerald-100 shadow-lg hover:shadow-xl hover:shadow-emerald-100/50 hover:border-emerald-200 transition-all duration-300 cursor-zoom-in bg-emerald-50/50"
        >
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={750}
            className="w-full h-auto transition-transform duration-300 group-hover:scale-[1.02]"
            unoptimized
          />
          <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors duration-300 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
              <ZoomIn className="w-4 h-4" />
              <span className="text-sm font-medium">Powiększ</span>
            </div>
          </div>
        </button>
        {caption && (
          <figcaption className="mt-3 text-sm text-emerald-600/70 text-center">
            {caption}
          </figcaption>
        )}
      </figure>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
          onClick={close}
        >
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
          <button
            onClick={close}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Zamknij"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="relative max-w-[90vw] max-h-[85vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10">
              <Image
                src={src}
                alt={alt}
                width={1920}
                height={1200}
                className="w-auto h-auto max-w-[90vw] max-h-[80vh] object-contain"
                priority
                unoptimized
              />
            </div>
            {caption && (
              <p className="absolute -bottom-10 left-0 right-0 text-center text-white/60 text-sm">
                {caption}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
