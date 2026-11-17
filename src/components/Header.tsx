import React, { useState, useEffect } from 'react';
import { Menu, X, MessageCircle } from 'lucide-react';
import { CerimLogo } from './BrandMark';
import { useApp } from '../context/AppContext';
import { buildCerimWhatsAppUrl } from '../utils/dataHelpers';

export const Header: React.FC = () => {
  const { route, navigate } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overHero, setOverHero] = useState(() => route.page === 'home');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    if (mobileOpen) {
      document.addEventListener('keydown', onKey);
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  useEffect(() => {
    if (route.page !== 'home') {
      setOverHero(false);
      return;
    }

    const updateHeaderState = () => {
      const heroEl = document.getElementById('cerim-hero-section');
      if (!heroEl) {
        setOverHero(window.scrollY < 460);
        return;
      }
      const rect = heroEl.getBoundingClientRect();
      setOverHero(rect.bottom > 72);
    };

    updateHeaderState();
    const rafId = window.requestAnimationFrame(updateHeaderState);
    window.addEventListener('scroll', updateHeaderState, { passive: true });
    window.addEventListener('resize', updateHeaderState);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', updateHeaderState);
      window.removeEventListener('resize', updateHeaderState);
    };
  }, [route.page]);

  const handleNav = (fn: () => void) => {
    setMobileOpen(false);
    fn();
  };

  const whatsappDirectUrl = buildCerimWhatsAppUrl(
    'Bonjour CERIM, je souhaite obtenir des renseignements sur une location.'
  );

  const isActive = (target: string) => {
    if (target === 'home' && route.page === 'home') return true;
    if (
      target === 'appartements' &&
      route.page === 'recherche' &&
      route.filters?.type === 'Appartement'
    )
      return true;
    if (target === 'voitures' && route.page === 'recherche' && route.filters?.type === 'Voiture')
      return true;
    if (target === 'suivi' && route.page === 'suivi') return true;
    if (target === 'contact' && route.page === 'contact') return true;
    if (target === 'admin' && (route.page === 'admin' || route.page === 'checkin')) return true;
    return false;
  };

  const isTransparent = route.page === 'home' && overHero;

  return (
    <>
      <header
        className={`${
          route.page === 'home' ? 'fixed top-0 inset-x-0' : 'sticky top-0'
        } z-40 transition-colors duration-300 ${
          isTransparent
            ? 'bg-transparent border-b border-transparent'
            : 'bg-white border-b border-[#DBE6EC] shadow-[0_4px_20px_-6px_rgba(18,59,99,0.08)]'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              handleNav(() => navigate({ page: 'home' }));
            }}
            aria-label="CERIM Accueil"
            className="whitespace-nowrap shrink-0 rounded focus-visible:outline-none"
          >
            <CerimLogo variant={isTransparent ? 'white' : 'ink'} />
          </a>

          <nav
            aria-label="Navigation principale"
            className={`hidden md:flex items-center gap-5 text-sm font-medium transition-colors ${
              isTransparent ? 'text-white/90' : 'text-[#5A7084]'
            }`}
          >
            <a
              href="#/"
              onClick={(e) => {
                e.preventDefault();
                navigate({ page: 'home' });
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                isTransparent ? 'hover:text-white' : 'hover:text-[#123B63]'
              } ${
                isActive('home')
                  ? `${isTransparent ? 'text-white' : 'text-[#123B63]'} font-semibold underline decoration-[#20B8A6] decoration-2 underline-offset-8`
                  : ''
              }`}
            >
              Accueil
            </a>
            <a
              href="#/recherche?type=Appartement"
              onClick={(e) => {
                e.preventDefault();
                navigate({ page: 'recherche', filters: { type: 'Appartement' } });
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                isTransparent ? 'hover:text-white' : 'hover:text-[#123B63]'
              } ${
                isActive('appartements')
                  ? `${isTransparent ? 'text-white' : 'text-[#123B63]'} font-semibold underline decoration-[#20B8A6] decoration-2 underline-offset-8`
                  : ''
              }`}
            >
              Appartements
            </a>
            <a
              href="#/recherche?type=Voiture"
              onClick={(e) => {
                e.preventDefault();
                navigate({ page: 'recherche', filters: { type: 'Voiture' } });
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                isTransparent ? 'hover:text-white' : 'hover:text-[#123B63]'
              } ${
                isActive('voitures')
                  ? `${isTransparent ? 'text-white' : 'text-[#123B63]'} font-semibold underline decoration-[#20B8A6] decoration-2 underline-offset-8`
                  : ''
              }`}
            >
              Voitures
            </a>
            <a
              href="#/suivi"
              onClick={(e) => {
                e.preventDefault();
                navigate({ page: 'suivi' });
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                isTransparent ? 'hover:text-white' : 'hover:text-[#123B63]'
              } ${
                isActive('suivi')
                  ? `${isTransparent ? 'text-white' : 'text-[#123B63]'} font-semibold underline decoration-[#20B8A6] decoration-2 underline-offset-8`
                  : ''
              }`}
            >
              Suivi
            </a>
            <a
              href="#/contact"
              onClick={(e) => {
                e.preventDefault();
                navigate({ page: 'contact' });
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                isTransparent ? 'hover:text-white' : 'hover:text-[#123B63]'
              } ${
                isActive('contact')
                  ? `${isTransparent ? 'text-white' : 'text-[#123B63]'} font-semibold underline decoration-[#20B8A6] decoration-2 underline-offset-8`
                  : ''
              }`}
            >
              Contact
            </a>
            <a
              href="#/admin"
              onClick={(e) => {
                e.preventDefault();
                navigate({ page: 'admin', adminTab: 'reservations' });
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                isTransparent ? 'hover:text-white' : 'hover:text-[#123B63]'
              } ${
                isActive('admin')
                  ? `${isTransparent ? 'text-white' : 'text-[#123B63]'} font-semibold underline decoration-[#20B8A6] decoration-2 underline-offset-8`
                  : ''
              }`}
            >
              Admin
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href={whatsappDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              <span>CERIM WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={mobileOpen}
              className={`md:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border transition-colors ${
                isTransparent
                  ? 'border-white/40 text-white hover:bg-white/15'
                  : 'border-[#DBE6EC] text-[#123B63] hover:bg-[#F2F7F9]'
              }`}
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Fullscreen Navy Mobile Menu */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu mobile"
          className="fixed inset-0 z-50 bg-[#0B2A47] text-white flex flex-col justify-between p-6 md:hidden"
        >
          <div>
            <div className="flex items-center justify-between mb-10">
              <CerimLogo variant="teal" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer le menu"
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border border-white/20 text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex flex-col gap-2 text-lg font-medium">
              <button
                type="button"
                onClick={() => handleNav(() => navigate({ page: 'home' }))}
                className="text-left px-4 py-3.5 min-h-[44px] rounded-lg hover:bg-white/10 transition-colors"
              >
                Accueil
              </button>
              <button
                type="button"
                onClick={() =>
                  handleNav(() => navigate({ page: 'recherche', filters: { type: 'Appartement' } }))
                }
                className="text-left px-4 py-3.5 min-h-[44px] rounded-lg hover:bg-white/10 transition-colors"
              >
                Appartements
              </button>
              <button
                type="button"
                onClick={() =>
                  handleNav(() => navigate({ page: 'recherche', filters: { type: 'Voiture' } }))
                }
                className="text-left px-4 py-3.5 min-h-[44px] rounded-lg hover:bg-white/10 transition-colors"
              >
                Voitures
              </button>
              <button
                type="button"
                onClick={() => handleNav(() => navigate({ page: 'suivi' }))}
                className="text-left px-4 py-3.5 min-h-[44px] rounded-lg hover:bg-white/10 transition-colors text-[#36CBB9]"
              >
                Suivi de réservation
              </button>
              <button
                type="button"
                onClick={() => handleNav(() => navigate({ page: 'contact' }))}
                className="text-left px-4 py-3.5 min-h-[44px] rounded-lg hover:bg-white/10 transition-colors"
              >
                Contact &amp; assistance
              </button>
              <button
                type="button"
                onClick={() =>
                  handleNav(() => navigate({ page: 'admin', adminTab: 'reservations' }))
                }
                className="text-left px-4 py-3.5 min-h-[44px] rounded-lg hover:bg-white/10 transition-colors text-white/80"
              >
                Administration
              </button>
            </nav>
          </div>

          <div className="pt-6 border-t border-white/15">
            <a
              href={whatsappDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 min-h-[48px] rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] font-semibold transition-colors"
            >
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
              <span>Contacter CERIM sur WhatsApp</span>
            </a>
          </div>
        </div>
      )}
    </>
  );
};
