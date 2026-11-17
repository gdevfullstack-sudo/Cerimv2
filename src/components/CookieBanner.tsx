import React, { useEffect, useState } from 'react';
import { Cookie, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useApp } from '../context/AppContext';

export const CookieBanner: React.FC = () => {
  const {
    cookieConsent,
    updateCookieConsent,
    cookieSettingsOpen,
    setCookieSettingsOpen,
    navigate,
  } = useApp();
  const prefersReducedMotion = useReducedMotion();
  const [customizeMode, setCustomizeMode] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  const visible = cookieConsent === null || cookieSettingsOpen;

  useEffect(() => {
    if (visible) {
      setAnalyticsEnabled(cookieConsent ? cookieConsent.analytics : true);
      setCustomizeMode(cookieSettingsOpen);
    }
  }, [visible, cookieConsent, cookieSettingsOpen]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          role="dialog"
          aria-label="Gestion des cookies et préférences de confidentialité"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22 }}
          className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-40 bg-white rounded-xl border border-[#DBE6EC] shadow-[0_20px_50px_-12px_rgba(18,59,99,0.24)] p-4 sm:p-5 space-y-3.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#20B8A6]/15 text-[#0C7A6D] flex items-center justify-center shrink-0">
                <Cookie className="w-4 h-4" aria-hidden="true" />
              </div>
              <h2 className="text-sm font-semibold text-[#123B63]">
                Cookies &amp; confidentialité
              </h2>
            </div>

            {cookieConsent !== null && (
              <button
                type="button"
                onClick={() => setCookieSettingsOpen(false)}
                aria-label="Fermer les préférences cookies"
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#5A7084] hover:text-[#123B63] hover:bg-[#F2F7F9] transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <p className="text-xs text-[#5A7084] leading-relaxed">
            CERIM utilise un stockage local essentiel pour vos favoris et réservations, ainsi que
            des statistiques anonymes facultatives pour améliorer le catalogue.{' '}
            <button
              type="button"
              onClick={() => {
                setCookieSettingsOpen(false);
                navigate({ page: 'legal', legalTab: 'cookies' });
              }}
              className="text-[#0C7A6D] hover:text-[#123B63] font-semibold underline underline-offset-4"
            >
              En savoir plus
            </button>
          </p>

          {customizeMode && (
            <div className="rounded-lg bg-[#F2F7F9] border border-[#DBE6EC] p-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#123B63]">Cookies essentiels</p>
                  <p className="text-[#5A7084]">Favoris, historique et préférences.</p>
                </div>
                <span className="inline-flex items-center gap-1 font-semibold text-[#0C7A6D] whitespace-nowrap shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Toujours actifs
                </span>
              </div>

              <label className="flex items-center justify-between gap-3 pt-2 border-t border-[#DBE6EC] cursor-pointer">
                <div>
                  <p className="font-semibold text-[#123B63]">Mesure d&apos;audience interne</p>
                  <p className="text-[#5A7084]">Comptage anonyme des pages et fiches vues.</p>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsEnabled}
                  onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#20B8A6] rounded cursor-pointer shrink-0"
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {customizeMode ? (
              <>
                <button
                  type="button"
                  onClick={() => updateCookieConsent(analyticsEnabled)}
                  className="flex-1 min-h-[40px] px-3.5 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Enregistrer mes choix
                </button>
                <button
                  type="button"
                  onClick={() => setCustomizeMode(false)}
                  className="min-h-[40px] px-3 rounded-lg border border-[#DBE6EC] text-xs font-semibold text-[#5A7084] hover:text-[#123B63] transition-colors whitespace-nowrap"
                >
                  Retour
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => updateCookieConsent(true)}
                  className="flex-1 min-h-[40px] px-3.5 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Tout accepter
                </button>
                <button
                  type="button"
                  onClick={() => updateCookieConsent(false)}
                  className="min-h-[40px] px-3 rounded-lg border border-[#DBE6EC] bg-white hover:border-[#123B63] text-[#123B63] text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Essentiels uniquement
                </button>
                <button
                  type="button"
                  onClick={() => setCustomizeMode(true)}
                  aria-label="Personnaliser les préférences cookies"
                  className="min-h-[40px] px-2.5 rounded-lg border border-[#DBE6EC] text-[#5A7084] hover:text-[#123B63] inline-flex items-center gap-1 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Gérer</span>
                </button>
              </>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
