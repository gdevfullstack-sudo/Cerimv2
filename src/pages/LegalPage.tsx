import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Cookie,
  FileText,
  Lock,
  MessageCircle,
  Scale,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LegalTab } from '../types';
import { CERIM_WHATSAPP_DISPLAY } from '../data/biens';
import { buildCerimWhatsAppUrl } from '../utils/dataHelpers';
import { buildLegalSeoConfig, usePageSeo } from '../utils/seo';

const LEGAL_TABS: Array<{
  id: LegalTab;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'cgv', label: 'CGV & Annulation', shortLabel: 'CGV', icon: FileText },
  {
    id: 'confidentialite',
    label: 'Politique de confidentialité',
    shortLabel: 'Confidentialité',
    icon: Lock,
  },
  { id: 'cookies', label: 'Cookies & stockage local', shortLabel: 'Cookies', icon: Cookie },
  {
    id: 'mentions',
    label: 'Mentions légales',
    shortLabel: 'Mentions',
    icon: Scale,
  },
];

export const LegalPage: React.FC = () => {
  const {
    route,
    navigate,
    adminSettings,
    cookieConsent,
    updateCookieConsent,
    clearLocalPersonalData,
  } = useApp();

  const rawTab: LegalTab = route.legalTab || 'cgv';
  const activeTab: LegalTab = rawTab === 'cgu' ? 'cgv' : rawTab;

  const legalSeo = useMemo(() => buildLegalSeoConfig(activeTab), [activeTab]);
  usePageSeo(legalSeo);

  const [analyticsDraft, setAnalyticsDraft] = useState<boolean>(
    cookieConsent ? cookieConsent.analytics : true
  );
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setAnalyticsDraft(cookieConsent ? cookieConsent.analytics : true);
    setConfirmClear(false);
  }, [cookieConsent, activeTab]);

  const whatsappDirectUrl = buildCerimWhatsAppUrl(
    'Bonjour CERIM, je souhaite obtenir des précisions concernant vos conditions générales ou mes données.'
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate({ page: 'home' })}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#123B63] hover:text-[#0C7A6D] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Retour à l&apos;accueil</span>
        </button>
        <p className="text-xs text-[#5A7084]">
          Brazzaville &amp; Pointe-Noire · Paiement sur place à l&apos;arrivée
        </p>
      </div>

      <div className="max-w-3xl space-y-2">
        <h1 className="text-2xl sm:text-4xl font-semibold text-[#123B63] tracking-tight">
          CGV, Mentions légales &amp; Confidentialité
        </h1>
        <p className="text-sm sm:text-base text-[#5A7084]">
          Règles de réservation sans paiement en ligne, politique d&apos;annulation et protection de
          vos données sur CERIM.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <nav
          aria-label="Sections légales"
          className="lg:col-span-4 bg-white rounded-xl border border-[#DBE6EC] p-2 sm:p-3 flex lg:flex-col gap-1.5 overflow-x-auto lg:sticky lg:top-24"
        >
          {LEGAL_TABS.map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate({ page: 'legal', legalTab: tab.id })}
                aria-current={isCurrent ? 'page' : undefined}
                className={`min-h-[44px] inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-left transition-colors whitespace-nowrap lg:whitespace-normal shrink-0 ${
                  isCurrent
                    ? 'bg-[#123B63] text-white'
                    : 'text-[#5A7084] hover:text-[#123B63] hover:bg-[#F2F7F9]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-[#36CBB9]' : 'text-[#0C7A6D]'}`}
                />
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <article className="lg:col-span-8 bg-white rounded-xl border border-[#DBE6EC] p-6 sm:p-8 space-y-8 text-sm sm:text-[15px] text-[#0F2233] leading-relaxed">
          {activeTab === 'cgv' && (
            <div className="space-y-6">
              <header className="pb-5 border-b border-[#DBE6EC] space-y-2">
                <h2 className="text-xl sm:text-2xl font-semibold text-[#123B63]">
                  Conditions Générales de Vente et de Réservation (CGV)
                </h2>
                <p className="text-xs sm:text-sm text-[#5A7084]">
                  Applicables à toute réservation d&apos;appartement ou de véhicule géré par CERIM à
                  Brazzaville et Pointe-Noire.
                </p>
              </header>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-[#123B63]">
                  1. Rôle de CERIM — Interlocuteur unique
                </h3>
                <p className="text-[#5A7084]">
                  CERIM assure la gestion complète de la réservation, du suivi client et du séjour en
                  qualité d&apos;interlocuteur unique pour nos biens (appartements et véhicules) à
                  Brazzaville et Pointe-Noire. Notre équipe coordonne l&apos;ensemble des étapes
                  jusqu&apos;à la remise des clés et au départ.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-[#123B63]">
                  2. Réservation sans paiement en ligne &amp; double confirmation
                </h3>
                <p className="text-[#5A7084]">
                  Aucun paiement n&apos;est demandé en ligne.{' '}
                  <strong className="text-[#123B63]">
                    Réservation sans paiement en ligne : vous payez à votre arrivée
                  </strong>{' '}
                  (en espèces FCFA ou Mobile Money sur place), contre remise d&apos;un reçu daté.
                  Toute demande doit faire l&apos;objet d&apos;une confirmation « OUI » du client sous{' '}
                  <strong className="text-[#123B63]">
                    {Math.round(adminSettings.clientConfirmTimeoutMinutes / 60)} heures
                  </strong>
                  , faute de quoi les dates sont libérées automatiquement.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-[#123B63]">
                  3. Politique d&apos;annulation et no-show
                </h3>
                <p className="text-[#5A7084]">
                  L&apos;annulation est{' '}
                  <strong className="text-[#123B63]">
                    gratuite jusqu&apos;à {adminSettings.cancellationHours} heures avant l&apos;arrivée
                  </strong>{' '}
                  via votre page de suivi (<code className="text-[#123B63]">#/suivi</code>). En
                  dessous de ce délai, vous êtes invité à contacter l&apos;équipe CERIM au plus vite ;
                  en cas d&apos;annulation tardive ou d&apos;absence non signalée à l&apos;heure
                  convenue, un statut <code className="text-[#123B63]">no_show</code> est enregistré
                  au dossier.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-[#123B63]">
                  4. Pièce d&apos;identité, état des lieux &amp; caution
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-[#5A7084]">
                  <li>
                    La présentation ou l&apos;envoi préalable d&apos;une pièce d&apos;identité valide
                    est requis pour finaliser la remise des clés sur place.
                  </li>
                  <li>
                    L&apos;adresse exacte et les consignes d&apos;accès sont délivrées uniquement
                    dans votre espace de suivi dès la confirmation du bien.
                  </li>
                  <li>
                    Un état des lieux photographique (avant et après séjour) est effectué lors de
                    l&apos;arrivée et du départ. Une caution remboursable peut être demandée sur
                    place selon la catégorie du bien et restituée après vérification de sortie.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-[#123B63]">
                  5. Indisponibilité imprévue &amp; remplacement
                </h3>
                <p className="text-[#5A7084]">
                  Si un bien devient indisponible avant confirmation finale, CERIM vous propose sans
                  frais un bien équivalent (même ville, même catégorie, tarif comparable à ± 20 %)
                  que vous restez libre d&apos;accepter ou de refuser.
                </p>
              </section>
            </div>
          )}

          {activeTab === 'confidentialite' && (
            <div className="space-y-6">
              <header className="pb-5 border-b border-[#DBE6EC] space-y-2">
                <h2 className="text-xl sm:text-2xl font-semibold text-[#123B63]">
                  Politique de confidentialité
                </h2>
                <p className="text-xs sm:text-sm text-[#5A7084]">
                  Minimisation des données personnelles et cloisonnement strict des coordonnées.
                </p>
              </header>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-[#123B63]">
                  1. Données collectées et minimisation
                </h3>
                <p className="text-[#5A7084]">
                  CERIM collecte uniquement les données strictement nécessaires au traitement de
                  votre réservation : nom, prénom, numéro de téléphone international, dates et
                  créneau d&apos;arrivée, ainsi que votre pièce d&apos;identité (compressée à 1 Mo
                  maximum) pour la vérification à l&apos;arrivée.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-[#123B63]">
                  2. Partage limité &amp; confidentialité
                </h3>
                <p className="text-[#5A7084]">
                  Seuls votre <strong className="text-[#123B63]">prénom</strong> et votre{' '}
                  <strong className="text-[#123B63]">créneau d&apos;arrivée</strong> sont transmis
                  au prestataire logistique préparant le bien. Votre numéro de téléphone complet et
                  votre pièce d&apos;identité restent strictement sous la responsabilité de
                  l&apos;équipe CERIM.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[#123B63]">
                  3. Vos droits et effacement des données locales
                </h3>
                <p className="text-[#5A7084]">
                  Vous pouvez demander l&apos;accès, la rectification ou la suppression de vos
                  données auprès de l&apos;équipe CERIM, ou effacer immédiatement vos données de
                  navigation locales sur cet appareil.
                </p>

                <div className="rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#123B63]">
                      Effacer mes données locales sur cet appareil
                    </p>
                    <p className="text-xs text-[#5A7084]">
                      Supprime favoris, historique de visites et suggestions enregistrées.
                    </p>
                  </div>
                  {confirmClear ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          clearLocalPersonalData();
                          setConfirmClear(false);
                        }}
                        className="min-h-[40px] px-3.5 rounded-lg bg-[#123B63] text-white text-xs font-semibold hover:bg-[#0B2A47] transition-colors"
                      >
                        Confirmer la suppression
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="min-h-[40px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-xs font-semibold text-[#5A7084] hover:text-[#123B63]"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 rounded-lg border border-[#123B63] text-[#123B63] hover:bg-[#123B63] hover:text-white text-xs font-semibold transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Effacer mes données</span>
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'cookies' && (
            <div className="space-y-6">
              <header className="pb-5 border-b border-[#DBE6EC] space-y-2">
                <h2 className="text-xl sm:text-2xl font-semibold text-[#123B63]">
                  Politique des cookies &amp; stockage local
                </h2>
                <p className="text-xs sm:text-sm text-[#5A7084]">
                  Gérez vos préférences à tout moment pour les traceurs techniques et statistiques.
                </p>
              </header>

              <div className="space-y-3">
                <div className="rounded-xl border border-[#DBE6EC] p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-[#123B63]">
                        Stockage essentiel et fonctionnel
                      </h3>
                    </div>
                    <p className="text-xs text-[#5A7084]">
                      Indispensable pour mémoriser vos favoris, votre suivi de réservation et votre
                      choix de consentement (<code className="text-[#123B63]">cerim_cookie_consent</code>).
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#0C7A6D] whitespace-nowrap shrink-0 pt-0.5">
                    Toujours actif
                  </span>
                </div>

                <label className="rounded-xl border border-[#DBE6EC] p-4 flex items-start justify-between gap-4 cursor-pointer hover:border-[#20B8A6] transition-colors">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-[#123B63]">
                      Mesure d&apos;audience interne et popularité des annonces
                    </h3>
                    <p className="text-xs text-[#5A7084]">
                      Permet de comptabiliser anonymement les vues par page et les consultations afin
                      d&apos;améliorer le catalogue à Brazzaville et Pointe-Noire.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={analyticsDraft}
                    onChange={(e) => setAnalyticsDraft(e.target.checked)}
                    className="w-5 h-5 accent-[#20B8A6] rounded cursor-pointer shrink-0 mt-0.5"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-[#5A7084]">
                  <CheckCircle2 className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
                  <span>
                    Statut actuel :{' '}
                    <strong className="text-[#123B63]">
                      {cookieConsent === null
                        ? 'En attente de choix'
                        : cookieConsent.analytics
                          ? 'Essentiels + Mesure d’audience'
                          : 'Essentiels uniquement'}
                    </strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => updateCookieConsent(analyticsDraft)}
                  className="min-h-[44px] px-5 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold transition-colors"
                >
                  Enregistrer mes préférences
                </button>
              </div>
            </div>
          )}

          {activeTab === 'mentions' && (
            <div className="space-y-6">
              <header className="pb-5 border-b border-[#DBE6EC] space-y-2">
                <h2 className="text-xl sm:text-2xl font-semibold text-[#123B63]">
                  Mentions légales
                </h2>
                <p className="text-xs sm:text-sm text-[#5A7084]">
                  Informations légales de l&apos;exploitant de la plateforme CERIM. Les champs
                  marqués « [À COMPLÉTER] » doivent être renseignés avec les informations officielles
                  avant mise en production.
                </p>
              </header>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] p-4 space-y-1.5">
                  <p className="text-xs font-semibold text-[#5A7084]">Exploitant &amp; Raison sociale</p>
                  <p className="text-sm font-semibold text-[#123B63]">
                    CERIM — [À COMPLÉTER : Raison sociale / Forme juridique]
                  </p>
                  <p className="text-xs text-[#5A7084]">
                    RCCM : [À COMPLÉTER] · NIU : [À COMPLÉTER]
                  </p>
                  <p className="text-xs text-[#5A7084]">
                    Siège social : [À COMPLÉTER — Adresse complète, Brazzaville / Pointe-Noire,
                    République du Congo]
                  </p>
                </div>

                <div className="rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] p-4 space-y-1.5">
                  <p className="text-xs font-semibold text-[#5A7084]">
                    Direction de publication &amp; Hébergement
                  </p>
                  <p className="text-xs text-[#0F2233]">
                    <span className="font-semibold text-[#123B63]">Directeur de publication :</span>{' '}
                    [À COMPLÉTER]
                  </p>
                  <p className="text-xs text-[#0F2233]">
                    <span className="font-semibold text-[#123B63]">Hébergeur :</span> [À COMPLÉTER —
                    Dénomination et adresse de l&apos;hébergeur]
                  </p>
                  <p className="text-xs text-[#0F2233] tabular-nums">
                    <span className="font-semibold text-[#123B63]">Support CERIM :</span>{' '}
                    {CERIM_WHATSAPP_DISPLAY}
                  </p>
                  <a
                    href={whatsappDirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0C7A6D] hover:text-[#123B63] underline underline-offset-4"
                  >
                    <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Contacter notre équipe CERIM</span>
                  </a>
                </div>
              </section>

              <section className="rounded-xl border border-[#DBE6EC] p-5 space-y-3">
                <h3 className="text-base font-semibold text-[#123B63]">
                  Sécurité des réservations CERIM
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-[#5A7084]">
                  <li>
                    Aucun paiement n&apos;est exigé en ligne : le règlement s&apos;effectue sur
                    place à votre arrivée, après vérification du bien.
                  </li>
                  <li>
                    Vérifiez toujours votre code <code className="text-[#123B63]">CER-...</code> sur
                    la page <code className="text-[#123B63]">#/suivi</code> avant tout déplacement.
                  </li>
                  <li>
                    Exigez votre reçu de paiement daté lors du check-in et signalez toute anomalie
                    uniquement à notre numéro officiel CERIM.
                  </li>
                </ul>
              </section>
            </div>
          )}
        </article>
      </div>
    </div>
  );
};
