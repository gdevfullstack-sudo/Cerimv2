import React, { useState } from 'react';
import { ArrowRight, Mail, MessageCircle } from 'lucide-react';
import { CerimLogo } from './BrandMark';
import { AnimatedSuccessIcon } from './AnimatedSuccessIcon';
import { useApp } from '../context/AppContext';
import { CERIM_WHATSAPP_DISPLAY } from '../data/biens';
import { buildCerimWhatsAppUrl } from '../utils/dataHelpers';
import { subscribeNewsletterEmail } from '../utils/storage';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const Footer: React.FC = () => {
  const { navigate, showToast, setCookieSettingsOpen } = useApp();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [subscribedEmail, setSubscribedEmail] = useState('');

  const whatsappDirectUrl = buildCerimWhatsAppUrl(
    'Bonjour CERIM, je souhaite obtenir des renseignements sur vos biens disponibles.'
  );

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = email.trim();
    if (!EMAIL_PATTERN.test(cleaned)) {
      setError('Veuillez saisir une adresse e-mail valide (ex. nom@domaine.com).');
      return;
    }

    setError('');
    const result = subscribeNewsletterEmail(cleaned);
    setSubscribedEmail(cleaned.toLowerCase());
    setEmail('');

    if (result.added) {
      showToast({
        title: 'Inscription newsletter confirmée',
        description: `Les prochains biens à Brazzaville et Pointe-Noire seront envoyés à ${cleaned.toLowerCase()}.`,
        type: 'success',
      });
    } else {
      showToast({
        title: 'Adresse déjà inscrite',
        description: `${cleaned.toLowerCase()} reçoit déjà nos alertes nouveaux biens.`,
        type: 'info',
      });
    }
  };

  return (
    <footer className="bg-[#0B2A47] text-white mt-16 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-10 border-b border-white/12">
          {/* Col 1: Brand + Official Social Links */}
          <div className="lg:col-span-4 space-y-5">
            <CerimLogo variant="teal" />
            <p className="text-sm text-white/80 leading-relaxed max-w-sm">
              Plateforme de réservation d&apos;appartements meublés et de voitures à Brazzaville et
              Pointe-Noire. Réservation sans paiement en ligne : vous payez à votre arrivée.
            </p>

            <div className="space-y-2.5">
              <p className="text-xs font-medium text-white/65 tracking-wide">
                Réseaux officiels CERIM
              </p>
              <div className="flex items-center gap-2.5">
                <a
                  href="https://www.facebook.com/cerim.congo"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="CERIM sur Facebook"
                  title="Facebook officiel CERIM"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/15 bg-white/[0.04] text-white/85 hover:border-[#20B8A6] hover:bg-[#20B8A6]/15 hover:text-[#36CBB9] transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M13.5 21v-8.2h2.75l.41-3.2H13.5V7.55c0-.93.26-1.56 1.59-1.56h1.7V3.13c-.3-.04-1.31-.13-2.49-.13-2.46 0-4.15 1.5-4.15 4.26V9.6H7.4v3.2h2.75V21h3.35z" />
                  </svg>
                </a>

                <a
                  href="https://www.instagram.com/cerim.congo"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="CERIM sur Instagram"
                  title="Instagram officiel CERIM"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/15 bg-white/[0.04] text-white/85 hover:border-[#20B8A6] hover:bg-[#20B8A6]/15 hover:text-[#36CBB9] transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </a>

                <a
                  href="https://www.linkedin.com/company/cerim-congo"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="CERIM sur LinkedIn"
                  title="LinkedIn officiel CERIM"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/15 bg-white/[0.04] text-white/85 hover:border-[#20B8A6] hover:bg-[#20B8A6]/15 hover:text-[#36CBB9] transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M6.94 8.5H3.56V19.5H6.94V8.5ZM5.25 3.5C4.14 3.5 3.25 4.39 3.25 5.5C3.25 6.6 4.14 7.5 5.25 7.5C6.35 7.5 7.25 6.6 7.25 5.5C7.25 4.39 6.35 3.5 5.25 3.5ZM20.44 13.02C20.44 9.88 18.76 8.22 16.16 8.22C14.37 8.22 13.48 9.2 13.02 9.93V8.5H9.65C9.7 9.48 9.65 19.5 9.65 19.5H13.02V13.36C13.02 13.02 13.05 12.69 13.15 12.45C13.42 11.78 14.03 11.09 15.07 11.09C16.41 11.09 17.06 12.11 17.06 13.6V19.5H20.44V13.02Z" />
                  </svg>
                </a>

                <a
                  href={whatsappDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="CERIM sur WhatsApp"
                  title="WhatsApp officiel CERIM"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/15 bg-white/[0.04] text-white/85 hover:border-[#20B8A6] hover:bg-[#20B8A6]/15 hover:text-[#36CBB9] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4">Liens rapides</h3>
            <ul className="space-y-2.5 text-sm text-white/75">
              <li>
                <a
                  href="#/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate({ page: 'home' });
                  }}
                  className="hover:text-[#36CBB9] transition-colors inline-block py-0.5"
                >
                  Accueil
                </a>
              </li>
              <li>
                <a
                  href="#/recherche?type=Appartement"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate({ page: 'recherche', filters: { type: 'Appartement' } });
                  }}
                  className="hover:text-[#36CBB9] transition-colors inline-block py-0.5"
                >
                  Appartements
                </a>
              </li>
              <li>
                <a
                  href="#/recherche?type=Voiture"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate({ page: 'recherche', filters: { type: 'Voiture' } });
                  }}
                  className="hover:text-[#36CBB9] transition-colors inline-block py-0.5"
                >
                  Voitures
                </a>
              </li>
              <li>
                <a
                  href="#/suivi"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate({ page: 'suivi' });
                  }}
                  className="hover:text-[#36CBB9] transition-colors inline-block py-0.5"
                >
                  Suivi de réservation
                </a>
              </li>
              <li>
                <a
                  href="#/admin"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate({ page: 'admin', adminTab: 'reservations' });
                  }}
                  className="hover:text-[#36CBB9] transition-colors inline-block py-0.5"
                >
                  Administration
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Cities & Direct Contact */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4">Villes &amp; Contact</h3>
            <ul className="space-y-2.5 text-sm text-white/75">
              <li>
                <a
                  href="#/recherche?ville=Brazzaville"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate({ page: 'recherche', filters: { ville: 'Brazzaville' } });
                  }}
                  className="hover:text-[#36CBB9] transition-colors inline-block py-0.5"
                >
                  Brazzaville
                </a>
              </li>
              <li>
                <a
                  href="#/recherche?ville=Pointe-Noire"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate({ page: 'recherche', filters: { ville: 'Pointe-Noire' } });
                  }}
                  className="hover:text-[#36CBB9] transition-colors inline-block py-0.5"
                >
                  Pointe-Noire
                </a>
              </li>
              <li>
                <a
                  href="#/contact"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate({ page: 'contact' });
                  }}
                  className="hover:text-[#36CBB9] transition-colors inline-block py-0.5"
                >
                  Contacter CERIM
                </a>
              </li>
              <li className="pt-1">
                <a
                  href={whatsappDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-white/95 hover:text-[#36CBB9] font-medium tabular-nums transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[#20B8A6] shrink-0" aria-hidden="true" />
                  <span>{CERIM_WHATSAPP_DISPLAY}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Newsletter */}
          <div className="lg:col-span-4">
            <div className="rounded-xl border border-white/12 bg-white/[0.04] p-5 space-y-3.5">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#36CBB9] shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-white">Alertes nouveaux biens</h3>
              </div>
              <p className="text-xs text-white/75 leading-relaxed">
                Recevez par e-mail nos prochains appartements et véhicules disponibles à Brazzaville
                et Pointe-Noire.
              </p>

              {subscribedEmail ? (
                <div className="rounded-lg border border-[#20B8A6]/40 bg-[#20B8A6]/10 p-3 flex items-center gap-3">
                  <AnimatedSuccessIcon variant="compact" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white">Inscription enregistrée</p>
                    <p className="text-xs text-white/75 truncate">{subscribedEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubscribedEmail('')}
                    className="text-xs text-[#36CBB9] hover:text-white font-medium whitespace-nowrap shrink-0 underline underline-offset-4"
                  >
                    Modifier
                  </button>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} noValidate className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="votre@email.com"
                      aria-label="Adresse e-mail pour les alertes nouveaux biens"
                      className="w-full min-w-0 flex-1 min-h-[42px] px-3.5 rounded-lg bg-[#081F36] border border-white/15 text-sm text-white placeholder:text-white/45 focus:outline-none focus:border-[#20B8A6] transition-colors"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[42px] rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#0B2A47] text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>S&apos;inscrire</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  {error && (
                    <p className="text-xs text-amber-300" role="alert">
                      {error}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Legal Links & Bottom Bar */}
        <div className="pt-6 space-y-4">
          <p className="text-xs text-white/70 leading-relaxed max-w-4xl">
            <strong className="font-semibold text-white/90">Information CERIM :</strong> Tous nos
            biens sont gérés par CERIM, votre interlocuteur unique pour la réservation et le séjour.
            Réservation sans paiement en ligne : vous réglez sur place à votre arrivée.
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/75">
            <a
              href="#/cgv"
              onClick={(e) => {
                e.preventDefault();
                navigate({ page: 'legal', legalTab: 'cgv' });
              }}
              className="hover:text-[#36CBB9] transition-colors"
            >
              Conditions Générales (CGV)
            </a>
            <a
              href="#/confidentialite"
              onClick={(e) => {
                e.preventDefault();
                navigate({ page: 'legal', legalTab: 'confidentialite' });
              }}
              className="hover:text-[#36CBB9] transition-colors"
            >
              Confidentialité
            </a>
            <a
              href="#/cookies"
              onClick={(e) => {
                e.preventDefault();
                navigate({ page: 'legal', legalTab: 'cookies' });
              }}
              className="hover:text-[#36CBB9] transition-colors"
            >
              Cookies
            </a>
            <a
              href="#/mentions-legales"
              onClick={(e) => {
                e.preventDefault();
                navigate({ page: 'legal', legalTab: 'mentions' });
              }}
              className="hover:text-[#36CBB9] transition-colors"
            >
              Mentions légales
            </a>
            <button
              type="button"
              onClick={() => setCookieSettingsOpen(true)}
              className="text-[#36CBB9] hover:text-white font-medium underline underline-offset-4 transition-colors"
            >
              Gérer mes cookies
            </button>
          </div>

          <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-white/65">
            <p>© {new Date().getFullYear()} CERIM — Brazzaville &amp; Pointe-Noire.</p>
            <div className="flex flex-wrap items-center gap-3">
              <span>Paiement sur place</span>
              <span aria-hidden="true">·</span>
              <span>Interlocuteur unique CERIM</span>
              <span aria-hidden="true">·</span>
              <span>Brazzaville &amp; Pointe-Noire</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
