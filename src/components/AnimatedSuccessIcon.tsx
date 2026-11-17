import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Send } from 'lucide-react';

interface AnimatedSuccessIconProps {
  variant?: 'hero' | 'compact';
  className?: string;
}

export const AnimatedSuccessIcon: React.FC<AnimatedSuccessIconProps> = ({
  variant = 'hero',
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (variant === 'compact') {
    return (
      <div
        aria-hidden="true"
        className={`relative inline-flex items-center justify-center w-9 h-9 shrink-0 ${className}`}
      >
        {!shouldReduceMotion && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0.55 }}
            animate={{ scale: 1.45, opacity: 0 }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full bg-[#20B8A6]"
          />
        )}
        <motion.div
          initial={shouldReduceMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 22 }}
          className="relative w-9 h-9 rounded-full bg-[#20B8A6] text-[#123B63] flex items-center justify-center shadow-xs"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.6}>
            <motion.path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.12, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`relative inline-flex items-center justify-center w-20 h-20 mx-auto ${className}`}
    >
      {/* Expanding outer pulse ring */}
      {!shouldReduceMotion && (
        <motion.span
          initial={{ scale: 0.7, opacity: 0.5 }}
          animate={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
          className="absolute inset-1 rounded-full bg-[#20B8A6]"
        />
      )}

      {/* Main spring circle + drawn SVG checkmark */}
      <motion.div
        initial={shouldReduceMotion ? false : { scale: 0.55, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        className="relative w-16 h-16 rounded-full bg-[#20B8A6]/15 border-2 border-[#20B8A6] text-[#0C7A6D] flex items-center justify-center shadow-sm"
      >
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.6}>
          <motion.path
            d="M5 13l4 4L19 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, delay: 0.15, ease: 'easeOut' }}
          />
        </svg>

        {/* Animated flying paper-plane accent */}
        <motion.span
          initial={
            shouldReduceMotion
              ? { opacity: 1, x: 0, y: 0, scale: 1 }
              : { opacity: 0, x: -8, y: 8, scale: 0.6 }
          }
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.35, ease: 'easeOut' }}
          className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[#123B63] text-[#20B8A6] flex items-center justify-center shadow-sm border-2 border-white"
        >
          <Send className="w-3.5 h-3.5" />
        </motion.span>
      </motion.div>
    </div>
  );
};
