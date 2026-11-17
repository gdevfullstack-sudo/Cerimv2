import React, { useState } from 'react';
import { Building2, Car } from 'lucide-react';
import { BienType } from '../types';

const LIGHT_SURFACE_LOGO = '/assets/aistudio/IMG-20261026-WA0017_298e92b8.jpg';
const DARK_SURFACE_LOGO = '/assets/aistudio/IMG-20261026-WA0022_bbf69dd2.jpg';

interface CerimLogoProps {
  variant?: 'ink' | 'teal' | 'white';
  className?: string;
}

export const CerimMark: React.FC<{ variant?: 'ink' | 'teal' | 'white'; className?: string }> = ({
  variant = 'ink',
  className = '',
}) => {
  const isDarkSurface = variant === 'white' || variant === 'teal';
  const logoSrc = isDarkSurface ? DARK_SURFACE_LOGO : LIGHT_SURFACE_LOGO;

  return (
    <span
      className={`relative inline-flex items-center justify-center w-9 h-9 rounded-md overflow-hidden shrink-0 ${className}`}
    >
      <img
        src={logoSrc}
        alt=""
        aria-hidden="true"
        className={`w-full h-full object-cover ${
          isDarkSurface ? 'scale-[2.45]' : 'scale-[1.06]'
        }`}
      />
    </span>
  );
};

export const CerimLogo: React.FC<CerimLogoProps> = ({ variant = 'ink', className = '' }) => {
  const textColor =
    variant === 'ink'
      ? 'text-[#123B63]'
      : variant === 'white'
        ? 'text-white'
        : 'text-[#20B8A6]';
  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <CerimMark variant={variant} />
      <span className={`text-xl font-semibold tracking-tight ${textColor}`}>CERIM</span>
    </span>
  );
};

interface FallbackImageProps {
  src: string;
  alt: string;
  type?: BienType;
  className?: string;
}

export const FallbackImage: React.FC<FallbackImageProps> = ({
  src,
  alt,
  type = 'Appartement',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0B2A47] to-[#123B63] text-white p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <div className="w-12 h-12 rounded-md bg-[#20B8A6]/15 border border-[#20B8A6]/40 flex items-center justify-center mb-2">
          {type === 'Voiture' ? (
            <Car className="w-6 h-6 text-[#20B8A6]" aria-hidden="true" />
          ) : (
            <Building2 className="w-6 h-6 text-[#20B8A6]" aria-hidden="true" />
          )}
        </div>
        <span className="text-xs font-medium text-white/85 line-clamp-2 max-w-[200px]">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
