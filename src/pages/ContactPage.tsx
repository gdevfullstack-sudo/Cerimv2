import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  HelpCircle,
  MessageCircle,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { CERIM_WHATSAPP_DISPLAY } from '../data/biens';
import { useApp } from '../context/AppContext';
import { ContactIntent, ContactWizardModal } from '../components/ContactWizardModal';
import { AnimatedSuccessIcon } from '../components/AnimatedSuccessIcon';
import { BienVille } from '../types';
import { buildContactSeoConfig, usePageSeo } from '../utils/seo';

export const ContactPage: React.FC = () => {
  const { addSuggestion, navigate, adminSettings } = useApp();
  const contactSeo = useMemo(() => buildContactSeoConfig(), []);
  usePageSeo(contactSeo);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [initialIntent, setInitialIntent] = useState<ContactIntent>('reservation');
  const [sentUrl, setSentUrl] = useState('');
  const [lastSummary, setLastSummary] = useState<{
    fullName: string;
    intent: ContactIntent;
  } | null>(null);

  const openWizard = (intent: ContactIntent) => {
    setInitialIntent(intent);
    setWizardOpen(true);
  };

  const handleWizardComplete = (payload: {
    nom: string;
    prenom: string;
    telephone: string;
    intent: ContactIntent;
    ville: BienVille;
    details: string;
    whatsappUrl: string;
  }) => {
    const fullName = `${payload.prenom} ${payload.nom}`.trim();

    addSuggestion({
      nom: fullName,
      contact: payload.telephone,
      ville: payload.ville,
      sujet:
        payload.intent === 'reservation'
          ? 'Assistance réservation'
          : 'Question / Suggestion CERIM',
      message:
        payload.details ||
        `Demande d'assistance CERIM (${payload.ville}).`,
    });

    setSentUrl(payload.whatsappUrl);
    setLastSummary({ fullName, intent: payload.intent });

    const link = document.createElement('a');
    link.href = payload.whatsappUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl sm:text-4xl font-semibold text-[#123B63] tracking-tight">
          Contacter notre équipe CERIM
        </h1>
        <p className="text-sm sm:text-base text-[#5A7084]">
          CERIM est votre interlocuteur unique pour toute question, réservation ou assistance
          séjour à Brazzaville et Pointe-Noire. Réservation sans paiement en ligne : vous payez à
          votre arrivée.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white rounded-xl border border-[#DBE6EC] p-6 sm:p-8 space-y-6">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#0C7A6D]">
                Assistance CERIM
              </p>
              <h2 className="text-xl font-semibold text-[#123B63]">
                Comment notre équipe peut-elle vous aider ?
              </h2>
              <p className="text-sm text-[#5A7084]">
                Indiquez vos coordonnées et l’objet de votre demande pour joindre directement notre
                équipe sur WhatsApp.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => openWizard('reservation')}
                className="group p-5 rounded-xl border border-[#DBE6EC] hover:border-[#20B8A6] bg-[#F2F7F9]/60 hover:bg-[#F2F7F9] text-left space-y-3 transition-all"
              >
                <span className="w-10 h-10 rounded-lg bg-[#123B63] text-[#20B8A6] inline-flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-[#123B63] group-hover:text-[#0C7A6D] transition-colors">
                    Assistance réservation
                  </h3>
                  <p className="text-xs text-[#5A7084] leading-relaxed">
                    Modifier un créneau d’arrivée, poser une question sur un dossier ou demander un
                    conseil avant votre séjour.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0C7A6D]">
                  <span>Contacter CERIM</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => openWizard('contact')}
                className="group p-5 rounded-xl border border-[#DBE6EC] hover:border-[#20B8A6] bg-[#F2F7F9]/60 hover:bg-[#F2F7F9] text-left space-y-3 transition-all"
              >
                <span className="w-10 h-10 rounded-lg bg-[#20B8A6] text-[#123B63] inline-flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-[#123B63] group-hover:text-[#0C7A6D] transition-colors">
                    Question &amp; suggestion
                  </h3>
                  <p className="text-xs text-[#5A7084] leading-relaxed">
                    Obtenir des précisions sur nos biens à Brazzaville ou Pointe-Noire, ou nous
                    transmettre une remarque.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0C7A6D]">
                  <span>Écrire à l’équipe</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openWizard('reservation')}
                className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold transition-colors"
              >
                <MessageCircle className="w-5 h-5" aria-hidden="true" />
                <span>Contacter notre équipe sur WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'suivi' })}
                className="min-h-[48px] px-5 rounded-lg border border-[#123B63] text-[#123B63] text-sm font-semibold hover:bg-[#F2F7F9] transition-colors"
              >
                Suivre une réservation
              </button>
            </div>

            {sentUrl && lastSummary && (
              <div
                role="status"
                className="p-4 rounded-lg bg-[#20B8A6]/15 border border-[#20B8A6] text-xs text-[#123B63] flex items-start gap-3"
              >
                <AnimatedSuccessIcon variant="compact" className="mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    Merci {lastSummary.fullName} ! Votre message a bien été enregistré et préparé
                    pour notre équipe CERIM.
                  </p>
                  <a
                    href={sentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-semibold underline text-[#0C7A6D]"
                  >
                    Ouvrir WhatsApp directement
                  </a>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl border border-[#DBE6EC] p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#123B63]">
              <Phone className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
              <h2 className="text-base font-semibold">Interlocuteur unique CERIM</h2>
            </div>
            <p className="text-lg font-semibold text-[#123B63] tabular-nums">
              {CERIM_WHATSAPP_DISPLAY}
            </p>
            <p className="text-xs text-[#5A7084] leading-relaxed">
              Disponible à Brazzaville et Pointe-Noire pour vous accompagner avant, pendant et après
              votre location.
            </p>
          </div>

          <div className="bg-[#123B63] text-white rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#20B8A6] shrink-0" aria-hidden="true" />
              <h2 className="text-base font-semibold">Garanties CERIM</h2>
            </div>
            <ul className="space-y-2.5 text-sm text-white/85 list-disc pl-5">
              <li>Réservation sans paiement en ligne : vous payez à votre arrivée.</li>
              <li>
                L’adresse exacte et les consignes d’accès apparaissent dans votre page de suivi dès
                que votre dossier est confirmé.
              </li>
              <li>
                Annulation gratuite jusqu’à {adminSettings.cancellationHours}h avant l’arrivée.
              </li>
            </ul>
            <p className="pt-3 border-t border-white/15 text-xs text-white/75 leading-relaxed">
              Ce service est géré par CERIM, votre interlocuteur unique pour la réservation et le
              séjour.
            </p>
          </div>
        </aside>
      </div>

      <ContactWizardModal
        isOpen={wizardOpen}
        initialIntent={initialIntent}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />
    </div>
  );
};
