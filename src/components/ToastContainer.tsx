import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ToastType } from '../types';

const TOAST_STYLES: Record<
  ToastType,
  {
    border: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  success: {
    border: 'border-[#20B8A6]',
    iconBg: 'bg-[#20B8A6]/20',
    iconColor: 'text-[#0C7A6D]',
  },
  info: {
    border: 'border-[#123B63]/25',
    iconBg: 'bg-[#F2F7F9]',
    iconColor: 'text-[#123B63]',
  },
  warning: {
    border: 'border-amber-300',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-700',
  },
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type];
          return (
            <motion.div
              key={toast.id}
              role="status"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.96 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`pointer-events-auto bg-white rounded-xl border ${style.border} shadow-[0_14px_34px_-10px_rgba(18,59,99,0.22)] p-3.5 flex items-start gap-3`}
            >
              <span
                className={`w-8 h-8 rounded-lg ${style.iconBg} ${style.iconColor} flex items-center justify-center shrink-0 mt-0.5`}
                aria-hidden="true"
              >
                {toast.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
                {toast.type === 'info' && <Info className="w-4 h-4" />}
                {toast.type === 'warning' && <AlertCircle className="w-4 h-4" />}
              </span>

              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-semibold text-[#123B63] leading-snug">{toast.title}</p>
                {toast.description && (
                  <p className="text-xs text-[#5A7084] leading-relaxed">{toast.description}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Fermer la notification"
                className="min-w-[30px] min-h-[30px] rounded-md text-[#5A7084] hover:text-[#123B63] hover:bg-[#F2F7F9] inline-flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
