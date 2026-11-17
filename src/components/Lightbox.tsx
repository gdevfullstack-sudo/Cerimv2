import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { BienType } from '../types';
import { FallbackImage } from './BrandMark';

interface LightboxProps {
  photos: string[];
  title: string;
  type: BienType;
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  photos,
  title,
  type,
  initialIndex,
  isOpen,
  onClose,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setIndex((i) => (i + 1) % photos.length);
      } else if (e.key === 'ArrowLeft') {
        setIndex((i) => (i - 1 + photos.length) % photos.length);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, photos.length, onClose]);

  if (!isOpen || photos.length === 0) return null;

  const goPrev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const goNext = () => setIndex((i) => (i + 1) % photos.length);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Galerie photos — ${title}`}
      className="fixed inset-0 z-50 bg-[#0B2A47]/95 flex flex-col justify-between p-4 sm:p-6"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (delta > 45) goPrev();
        else if (delta < -45) goNext();
        touchStartX.current = null;
      }}
    >
      <div className="flex items-center justify-between text-white">
        <span className="text-sm font-medium tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer la galerie"
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden">
        {photos.length > 1 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Photo précédente"
            className="absolute left-2 sm:left-4 z-10 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg bg-[#0B2A47]/80 hover:bg-[#123B63] text-white border border-white/20 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        <div className="max-w-4xl w-full max-h-[75vh] flex items-center justify-center transition-opacity duration-200">
          <FallbackImage
            key={photos[index]}
            src={photos[index]}
            alt={`${title} — photo ${index + 1} sur ${photos.length}`}
            type={type}
            className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
          />
        </div>

        {photos.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Photo suivante"
            className="absolute right-2 sm:right-4 z-10 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg bg-[#0B2A47]/80 hover:bg-[#123B63] text-white border border-white/20 transition-colors"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="text-center text-xs text-white/75">{title}</p>
    </div>
  );
};
