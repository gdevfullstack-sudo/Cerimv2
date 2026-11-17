import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  MessageCircle,
  Phone,
  User,
  X,
} from 'lucide-react';
import { buildCerimWhatsAppUrl } from '../utils/dataHelpers';
import { BienVille } from '../types';
import { AnimatedSuccessIcon } from './AnimatedSuccessIcon';

export type ContactIntent = 'contact' | 'reservation';

interface ContactWizardModalProps {
  isOpen: boolean;
  initialIntent?: ContactIntent | null;
  onClose: () => void;
  onComplete: (payload: {
    nom: string;
    prenom: string;
    telephone: string;
    intent: ContactIntent;
    ville: BienVille;
    details: string;
    whatsappUrl: string;
    whatsappMessage: string;
  }) => void;
}

const STEPS = [
  { id: 1, label: 'Identité' },
  { id: 2, label: 'Téléphone' },
  { id: 3, label: 'Objet' },
  { id: 4, label: 'Aperçu' },
] as const;

export const ContactWizardModal: React.FC<ContactWizardModalProps> = ({
  isOpen,
  initialIntent = null,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [intent, setIntent] = useState<ContactIntent>(initialIntent || 'reservation');
  const [ville, setVille] = useState<BienVille>('Brazzaville');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [sentUrl, setSentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setIntent(initialIntent || 'reservation');
      setError('');
      setSentUrl(null);
    }
  }, [isOpen, initialIntent]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const whatsappMessage = useMemo(() => {
    const fullName = `${prenom.trim()} ${nom.trim()}`.trim();
    const objetLabel =
      intent === 'reservation' ? 'Assistance réservation' : 'Question / Suggestion CERIM';

    return [
      `Bonjour CERIM, je souhaite contacter votre équipe (${ville}).`,
      `Nom et Prénom : ${fullName}`,
      `Téléphone : ${telephone.trim()}`,
      `Objet : ${objetLabel}`,
      details.trim()
        ? `Message : ${details.trim()}`
        : `Message : Merci de me recontacter pour échanger avec notre équipe CERIM.`,
    ].join('\n');
  }, [prenom, nom, telephone, intent, ville, details]);

  const whatsappUrl = useMemo(() => buildCerimWhatsAppUrl(whatsappMessage), [whatsappMessage]);

  if (!isOpen) return null;

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!nom.trim() || !prenom.trim()) {
        setError('Veuillez renseigner votre nom et votre prénom.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      const digits = telephone.replace(/[^\d]/g, '');
      if (digits.length < 6) {
        setError('Veuillez saisir un numéro de téléphone valide (au moins 6 chiffres).');
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    setError('');
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleConfirm = () => {
    setSentUrl(whatsappUrl);
    onComplete({
      nom: nom.trim(),
      prenom: prenom.trim(),
      telephone: telephone.trim(),
      intent,
      ville,
      details: details.trim(),
      whatsappUrl,
      whatsappMessage,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-wizard-title"
      className="fixed inset-0 z-50 bg-[#0B2A47]/65 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl border border-[#DBE6EC] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#DBE6EC] flex items-center justify-between gap-3 bg-[#F2F7F9]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0C7A6D]">
              Interlocuteur unique CERIM
            </p>
            <h2
              id="contact-wizard-title"
              className="text-base sm:text-lg font-semibold text-[#123B63] truncate"
            >
              Contacter notre équipe CERIM
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l’assistant de contact"
            className="min-w-[40px] min-h-[40px] rounded-lg border border-[#DBE6EC] bg-white text-[#123B63] hover:bg-[#F2F7F9] inline-flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {!sentUrl && (
          <div className="px-5 pt-4 pb-2 border-b border-[#DBE6EC]/70">
            <ol className="grid grid-cols-4 gap-2">
              {STEPS.map((s) => {
                const done = step > s.id;
                const current = step === s.id;
                return (
                  <li key={s.id} className="space-y-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-colors ${
                        done || current ? 'bg-[#20B8A6]' : 'bg-[#DBE6EC]'
                      }`}
                    />
                    <p
                      className={`text-[11px] font-semibold truncate ${
                        current ? 'text-[#123B63]' : done ? 'text-[#0C7A6D]' : 'text-[#5A7084]'
                      }`}
                    >
                      {s.id}. {s.label}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="p-5 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {sentUrl ? (
            <div role="status" className="py-4 text-center space-y-4">
              <AnimatedSuccessIcon variant="hero" />
              <div className="space-y-1.5">
                <h3 className="text-lg font-semibold text-[#123B63]">
                  Message validé et prêt pour notre équipe !
                </h3>
                <p className="text-sm text-[#5A7084] max-w-sm mx-auto leading-relaxed">
                  Merci <span className="font-semibold text-[#123B63]">{prenom.trim()}</span>. Votre
                  demande a été enregistrée. Cliquez ci-dessous pour ouvrir WhatsApp.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a
                  href={sentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-5 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Ouvrir WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 rounded-lg border border-[#DBE6EC] bg-white hover:border-[#123B63] text-[#123B63] text-sm font-semibold transition-colors"
                >
                  Terminer
                </button>
              </div>
            </div>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#123B63]">
                    <User className="w-5 h-5 text-[#0C7A6D]" aria-hidden="true" />
                    <h3 className="text-base font-semibold">Étape 1 : Nom et Prénom</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="cw-nom" className="block text-xs font-semibold text-[#123B63]">
                        Nom <span className="text-[#0C7A6D]">*</span>
                      </label>
                      <input
                        id="cw-nom"
                        type="text"
                        autoFocus
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        placeholder="Ex: Nganga"
                        className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="cw-prenom" className="block text-xs font-semibold text-[#123B63]">
                        Prénom <span className="text-[#0C7A6D]">*</span>
                      </label>
                      <input
                        id="cw-prenom"
                        type="text"
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        placeholder="Ex: Patrick"
                        className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#123B63]">
                    <Phone className="w-5 h-5 text-[#0C7A6D]" aria-hidden="true" />
                    <h3 className="text-base font-semibold">Étape 2 : Numéro de téléphone</h3>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="cw-tel" className="block text-xs font-semibold text-[#123B63]">
                      Numéro WhatsApp / Mobile <span className="text-[#0C7A6D]">*</span>
                    </label>
                    <input
                      id="cw-tel"
                      type="tel"
                      autoFocus
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      placeholder="Ex: +242 06 600 00 00"
                      className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] text-sm text-[#0F2233] tabular-nums focus:border-[#20B8A6] focus:outline-none"
                    />
                    <p className="text-xs text-[#5A7084]">
                      Votre numéro permet à notre équipe CERIM de vous répondre rapidement.
                    </p>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#123B63]">
                    <MessageCircle className="w-5 h-5 text-[#0C7A6D]" aria-hidden="true" />
                    <h3 className="text-base font-semibold">Étape 3 : Votre demande</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIntent('reservation')}
                      aria-pressed={intent === 'reservation'}
                      className={`p-4 rounded-xl border text-left space-y-1.5 transition-all ${
                        intent === 'reservation'
                          ? 'border-[#20B8A6] bg-[#20B8A6]/10 ring-1 ring-[#20B8A6]'
                          : 'border-[#DBE6EC] bg-white hover:border-[#123B63]'
                      }`}
                    >
                      <span className="inline-flex w-9 h-9 rounded-lg bg-[#123B63] text-white items-center justify-center">
                        <MessageCircle className="w-4 h-4 text-[#20B8A6]" aria-hidden="true" />
                      </span>
                      <p className="text-sm font-semibold text-[#123B63]">Assistance réservation</p>
                      <p className="text-xs text-[#5A7084]">
                        Suivi de dossier, créneau d’arrivée ou question séjour.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIntent('contact')}
                      aria-pressed={intent === 'contact'}
                      className={`p-4 rounded-xl border text-left space-y-1.5 transition-all ${
                        intent === 'contact'
                          ? 'border-[#20B8A6] bg-[#20B8A6]/10 ring-1 ring-[#20B8A6]'
                          : 'border-[#DBE6EC] bg-white hover:border-[#123B63]'
                      }`}
                    >
                      <span className="inline-flex w-9 h-9 rounded-lg bg-[#20B8A6] text-[#123B63] items-center justify-center">
                        <HelpCircle className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <p className="text-sm font-semibold text-[#123B63]">Question / Suggestion</p>
                      <p className="text-xs text-[#5A7084]">
                        Renseignement sur nos biens ou retour d’expérience.
                      </p>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="cw-ville" className="block text-xs font-semibold text-[#123B63]">
                        Ville
                      </label>
                      <select
                        id="cw-ville"
                        value={ville}
                        onChange={(e) => setVille(e.target.value as BienVille)}
                        className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
                      >
                        <option value="Brazzaville">Brazzaville</option>
                        <option value="Pointe-Noire">Pointe-Noire</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label htmlFor="cw-details" className="block text-xs font-semibold text-[#123B63]">
                        Votre message (optionnel)
                      </label>
                      <input
                        id="cw-details"
                        type="text"
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        placeholder="Code réservation ou précision..."
                        className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#123B63]">
                    <CheckCircle2 className="w-5 h-5 text-[#0C7A6D]" aria-hidden="true" />
                    <h3 className="text-base font-semibold">Étape 4 : Aperçu avant envoi</h3>
                  </div>

                  <div className="rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] p-4 space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-[#5A7084]">Nom &amp; Prénom</span>
                      <span className="font-semibold text-[#123B63] text-right">
                        {prenom.trim()} {nom.trim()}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[#5A7084]">Téléphone</span>
                      <span className="font-semibold text-[#123B63] tabular-nums">
                        {telephone.trim()}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[#5A7084]">Objet</span>
                      <span className="font-semibold text-[#0C7A6D] text-right">
                        {intent === 'reservation' ? 'Assistance réservation' : 'Question / Suggestion'} ·{' '}
                        {ville}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-[#123B63]">
                      Aperçu du message WhatsApp CERIM :
                    </p>
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed bg-white border border-[#DBE6EC] rounded-lg p-3.5 text-[#0F2233] select-all">
                      {whatsappMessage}
                    </pre>
                  </div>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
                >
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {!sentUrl && (
          <div className="px-5 py-4 border-t border-[#DBE6EC] bg-[#F2F7F9] flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="min-h-[44px] px-4 rounded-lg border border-[#DBE6EC] bg-white hover:border-[#123B63] text-sm font-semibold text-[#123B63] inline-flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Retour</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-lg border border-[#DBE6EC] bg-white text-sm font-medium text-[#5A7084] hover:text-[#123B63]"
              >
                Annuler
              </button>
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="min-h-[44px] px-5 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Suivant</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                className="min-h-[46px] px-5 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                <span>Envoyer à CERIM</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
