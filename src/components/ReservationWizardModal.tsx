import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  MessageCircle,
  ShieldCheck,
  Upload,
  User,
  X,
} from 'lucide-react';
import { Bien, Reservation } from '../types';
import { useApp } from '../context/AppContext';
import { reservationService } from '../services/reservationGateway';
import {
  ARRIVAL_SLOTS,
  computeEstimate,
  formatDateTimeFr,
  formatFcfa,
  formatIsoFr,
  getTodayIso,
  isRangeAvailable,
  validateInternationalPhone,
} from '../utils/dataHelpers';
import { compressImageFile } from '../utils/imageCompression';
import { AnimatedSuccessIcon } from './AnimatedSuccessIcon';

interface ReservationWizardModalProps {
  bien: Bien;
  extraBlocked: string[];
  initialDebut?: string;
  initialFin?: string;
  isOpen: boolean;
  onClose: () => void;
  onReservationCreated: (res: Reservation) => void;
}

const STEPS = [
  { id: 1, label: 'Coordonnées' },
  { id: 2, label: 'Dates & arrivée' },
  { id: 3, label: 'Validation' },
] as const;

export const ReservationWizardModal: React.FC<ReservationWizardModalProps> = ({
  bien,
  extraBlocked,
  initialDebut = '',
  initialFin = '',
  isOpen,
  onClose,
  onReservationCreated,
}) => {
  const {
    allBiens,
    reservations,
    refreshReservations,
    adminSettings,
    navigate,
    showToast,
  } = useApp();

  const todayIso = getTodayIso();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('+242 ');
  const [debut, setDebut] = useState(initialDebut || todayIso);
  const [fin, setFin] = useState(initialFin || initialDebut || todayIso);
  const [creneauArrivee, setCreneauArrivee] = useState<string>(ARRIVAL_SLOTS[2]);
  const [message, setMessage] = useState('');
  const [pieceIdentite, setPieceIdentite] = useState<string>('');
  const [idFileInfo, setIdFileInfo] = useState<string>('');
  const [accepteCgv, setAccepteCgv] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSimulatingOui, setIsSimulatingOui] = useState(false);
  const [error, setError] = useState('');
  const [createdReservation, setCreatedReservation] = useState<Reservation | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setDebut(initialDebut || todayIso);
      setFin(initialFin || initialDebut || todayIso);
      setError('');
      setCreatedReservation(null);
      setAccepteCgv(false);
      setHoneypot('');
    }
  }, [isOpen, initialDebut, initialFin, todayIso]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const effectiveFin = fin && fin >= debut ? fin : debut;

  const estimate = useMemo(() => {
    if (!debut) return null;
    return computeEstimate(bien.prix, bien.periode, debut, effectiveFin);
  }, [bien.prix, bien.periode, debut, effectiveFin]);

  const dateAvailable = useMemo(() => {
    if (!debut) return false;
    return isRangeAvailable(bien, debut, effectiveFin, extraBlocked, reservations);
  }, [bien, debut, effectiveFin, extraBlocked, reservations]);

  if (!isOpen) return null;

  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const compressed = await compressImageFile(file, 1024 * 1024);
      setPieceIdentite(compressed.dataUrl);
      const kb = Math.round(compressed.sizeBytes / 1024);
      setIdFileInfo(`${file.name} (compressée à ${kb} Ko)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du traitement de la pièce.');
    }
  };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!nom.trim() || !prenom.trim()) {
        setError('Veuillez renseigner votre nom et votre prénom.');
        return;
      }
      const phoneCheck = validateInternationalPhone(telephone);
      if (!phoneCheck.valid) {
        setError(phoneCheck.error || 'Numéro international invalide.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!debut || !creneauArrivee) {
        setError('Veuillez sélectionner vos dates et votre créneau d’arrivée.');
        return;
      }
      if (!dateAvailable) {
        setError('Ces dates comprennent un jour indisponible. Choisissez une autre période.');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmitReservation = async () => {
    setError('');
    if (!accepteCgv) {
      setError('Veuillez accepter les CGV et la politique d’annulation pour continuer.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { reservation } = await reservationService.creerReservation(
        {
          bien,
          nom,
          prenom,
          telephone,
          debut,
          fin: effectiveFin,
          creneauArrivee,
          message,
          pieceIdentite: pieceIdentite || undefined,
          accepteCgv,
          honeypot,
        },
        allBiens
      );
      refreshReservations();
      setCreatedReservation(reservation);
      onReservationCreated(reservation);
      showToast({
        title: `Réservation ${reservation.code} enregistrée`,
        description: 'Répondez « OUI » sous 2h pour confirmer la demande auprès de notre équipe.',
        type: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer la réservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateOui = async () => {
    if (!createdReservation) return;
    setIsSimulatingOui(true);
    setError('');
    try {
      const updated = await reservationService.confirmerClient(createdReservation.code, allBiens);
      refreshReservations();
      setCreatedReservation(updated);
      onReservationCreated(updated);
      showToast({
        title: 'Réponse « OUI » simulée avec succès',
        description: `Dossier ${updated.code} transmis au fournisseur et à l’équipe CERIM.`,
        type: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la simulation.');
    } finally {
      setIsSimulatingOui(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
      className="fixed inset-0 z-50 bg-[#0B2A47]/65 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl border border-[#DBE6EC] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#DBE6EC] flex items-center justify-between gap-3 bg-[#F2F7F9]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0C7A6D]">
              Réserver (paiement sur place) · {bien.matricule}
            </p>
            <h2 id="wizard-title" className="text-base sm:text-lg font-semibold text-[#123B63] truncate">
              {bien.titre}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le formulaire de réservation"
            className="min-w-[40px] min-h-[40px] rounded-lg border border-[#DBE6EC] bg-white text-[#123B63] hover:bg-[#F2F7F9] inline-flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Stepper */}
        {!createdReservation && (
          <div className="px-5 pt-4 pb-2 border-b border-[#DBE6EC]/70">
            <ol className="grid grid-cols-3 gap-2">
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

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {createdReservation ? (
            <div role="status" className="py-2 space-y-4 text-center">
              <AnimatedSuccessIcon variant="hero" />

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0C7A6D]">
                  Code de réservation
                </p>
                <p className="inline-block px-4 py-1.5 rounded-lg bg-[#F2F7F9] border-2 border-[#123B63] text-xl font-bold text-[#123B63] tracking-wider tabular-nums select-all">
                  {createdReservation.code}
                </p>
                <h3 className="text-base sm:text-lg font-semibold text-[#123B63] pt-1">
                  {createdReservation.statut === 'en_attente_client'
                    ? 'Double confirmation requise (sous 2 heures)'
                    : 'Demande transmise à notre équipe CERIM !'}
                </h3>
                <p className="text-xs sm:text-sm text-[#5A7084] max-w-md mx-auto leading-relaxed">
                  {createdReservation.statut === 'en_attente_client'
                    ? `Un message WhatsApp CERIM vous invite à répondre « OUI » avant ${
                        createdReservation.expiresAt
                          ? formatDateTimeFr(createdReservation.expiresAt)
                          : '2 heures'
                      }. Sans confirmation, les dates sont automatiquement libérées.`
                    : 'Votre confirmation « OUI » est enregistrée. Vous payez sur place à votre arrivée. L’adresse exacte sera débloquée dans votre suivi dès validation finale.'}
                </p>
              </div>

              <div className="rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] p-3.5 text-left text-xs space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-[#5A7084]">Bien</span>
                  <span className="font-semibold text-[#123B63] text-right">
                    {createdReservation.matricule} · {createdReservation.quartier}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#5A7084]">Période</span>
                  <span className="font-semibold text-[#123B63] tabular-nums">
                    {formatIsoFr(createdReservation.debut)} → {formatIsoFr(createdReservation.fin)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#5A7084]">À payer sur place</span>
                  <span className="font-semibold text-[#0C7A6D] tabular-nums">
                    {formatFcfa(createdReservation.totalEstime)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 pt-1">
                {createdReservation.statut === 'en_attente_client' && (
                  <button
                    type="button"
                    disabled={isSimulatingOui}
                    onClick={handleSimulateOui}
                    className="min-h-[44px] px-4 rounded-lg bg-[#123B63] hover:bg-[#0B2A47] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <MessageCircle className="w-4 h-4 text-[#20B8A6]" aria-hidden="true" />
                    <span>Simuler la réponse « OUI »</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const targetCode = createdReservation.code;
                    onClose();
                    navigate({ page: 'suivi', trackingCode: targetCode });
                  }}
                  className="min-h-[44px] px-5 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <FileCheck2 className="w-4 h-4" aria-hidden="true" />
                  <span>Ouvrir la page de suivi</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Honeypot anti-bot invisible */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="wiz-website">Site web</label>
                <input
                  id="wiz-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#123B63]">
                    <User className="w-5 h-5 text-[#0C7A6D]" aria-hidden="true" />
                    <h3 className="text-base font-semibold">Étape 1 : Identité &amp; Téléphone</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label htmlFor="wiz-nom" className="block text-xs font-semibold text-[#123B63]">
                        Nom <span className="text-[#0C7A6D]">*</span>
                      </label>
                      <input
                        id="wiz-nom"
                        type="text"
                        autoFocus
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        placeholder="Ex: Moukoko"
                        className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="wiz-prenom" className="block text-xs font-semibold text-[#123B63]">
                        Prénom <span className="text-[#0C7A6D]">*</span>
                      </label>
                      <input
                        id="wiz-prenom"
                        type="text"
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        placeholder="Ex: Christelle"
                        className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wiz-tel" className="block text-xs font-semibold text-[#123B63]">
                      Téléphone WhatsApp (format international) <span className="text-[#0C7A6D]">*</span>
                    </label>
                    <input
                      id="wiz-tel"
                      type="tel"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      placeholder="Ex: +242 06 600 00 00"
                      className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] text-sm text-[#0F2233] tabular-nums focus:border-[#20B8A6] focus:outline-none"
                    />
                    <p className="text-xs text-[#5A7084]">
                      CERIM est votre interlocuteur unique et vous envoie le suivi sur ce numéro
                      (maximum 2 réservations en attente simultanées).
                    </p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#123B63]">
                    <Calendar className="w-5 h-5 text-[#0C7A6D]" aria-hidden="true" />
                    <h3 className="text-base font-semibold">Étape 2 : Période &amp; créneau d’arrivée</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label htmlFor="wiz-debut" className="block text-xs font-semibold text-[#123B63]">
                        Date d’arrivée <span className="text-[#0C7A6D]">*</span>
                      </label>
                      <input
                        id="wiz-debut"
                        type="date"
                        min={todayIso}
                        value={debut}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDebut(val);
                          if (!fin || fin < val) setFin(val);
                        }}
                        className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="wiz-fin" className="block text-xs font-semibold text-[#123B63]">
                        Date de départ / fin
                      </label>
                      <input
                        id="wiz-fin"
                        type="date"
                        min={debut || todayIso}
                        value={effectiveFin}
                        onChange={(e) => setFin(e.target.value)}
                        className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wiz-slot" className="block text-xs font-semibold text-[#123B63]">
                      Créneau d’arrivée souhaité <span className="text-[#0C7A6D]">*</span>
                    </label>
                    <div className="relative">
                      <Clock
                        className="w-4 h-4 text-[#0C7A6D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <select
                        id="wiz-slot"
                        value={creneauArrivee}
                        onChange={(e) => setCreneauArrivee(e.target.value)}
                        className="w-full min-h-[44px] pl-10 pr-3 rounded-lg border border-[#DBE6EC] bg-white text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
                      >
                        {ARRIVAL_SLOTS.map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {estimate && (
                    <div
                      className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                        dateAvailable
                          ? 'bg-[#F2F7F9] border-[#DBE6EC] text-[#123B63]'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      <span>
                        {dateAvailable
                          ? `Disponible (${estimate.dureeLabel})`
                          : 'Période indisponible sur le calendrier'}
                      </span>
                      <span className="font-semibold text-sm tabular-nums text-[#0C7A6D]">
                        {formatFcfa(estimate.total)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#123B63]">
                    <ShieldCheck className="w-5 h-5 text-[#0C7A6D]" aria-hidden="true" />
                    <h3 className="text-base font-semibold">Étape 3 : Récapitulatif &amp; conditions</h3>
                  </div>

                  {/* Price & On-site Payment Notice */}
                  <div className="rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] p-4 space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-[#5A7084]">Bien</span>
                      <span className="font-semibold text-[#123B63] text-right">
                        [{bien.matricule}] {bien.quartier}, {bien.ville}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-[#5A7084]">Séjour &amp; créneau</span>
                      <span className="font-semibold text-[#123B63] tabular-nums text-right">
                        {formatIsoFr(debut)} → {formatIsoFr(effectiveFin)} ({creneauArrivee})
                      </span>
                    </div>
                    {estimate && (
                      <div className="flex justify-between gap-2 pt-2 border-t border-[#DBE6EC]">
                        <span className="font-semibold text-[#123B63]">
                          Estimation ({estimate.dureeLabel})
                        </span>
                        <span className="font-semibold text-[#0C7A6D] tabular-nums">
                          {formatFcfa(estimate.total)}
                        </span>
                      </div>
                    )}
                    <p className="pt-2 border-t border-[#DBE6EC] text-xs font-semibold text-[#123B63]">
                      Vous payez à votre arrivée. Aucun paiement en ligne n’est demandé.
                    </p>
                    <p className="text-[11px] text-[#5A7084]">
                      Annulation gratuite jusqu’à {adminSettings.cancellationHours} h avant l’arrivée ;
                      en dessous, un no-show peut être enregistré et vous devrez contacter CERIM.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wiz-msg" className="block text-xs font-semibold text-[#123B63]">
                      Message facultatif pour notre équipe
                    </label>
                    <textarea
                      id="wiz-msg"
                      rows={2}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Ex: Vol prévu à 13h, besoin d’un lit bébé..."
                      className="w-full px-3 py-2 rounded-lg border border-[#DBE6EC] text-xs sm:text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
                    />
                  </div>

                  {/* Photo pièce d'identité (compressée <= 1 Mo) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#123B63]">
                      Pièce d’identité (facultatif à cette étape, requise avant l’arrivée · 1 Mo max)
                    </label>
                    <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-dashed border-[#DBE6EC] hover:border-[#20B8A6] bg-[#F2F7F9]/60 cursor-pointer transition-colors">
                      <span className="inline-flex items-center gap-2 text-xs text-[#123B63] truncate">
                        <Upload className="w-4 h-4 text-[#0C7A6D] shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {idFileInfo || 'Joindre une photo CNI / Passeport (compressée auto)'}
                        </span>
                      </span>
                      <span className="text-[11px] font-semibold text-[#0C7A6D] shrink-0">
                        Choisir
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleIdUpload}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {/* CGV checkbox */}
                  <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#DBE6EC] bg-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accepteCgv}
                      onChange={(e) => setAccepteCgv(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#20B8A6] rounded cursor-pointer shrink-0"
                    />
                    <span className="text-xs text-[#0F2233] leading-relaxed">
                      J’accepte les{' '}
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate({ page: 'legal', legalTab: 'cgv' });
                        }}
                        className="font-semibold text-[#0C7A6D] underline underline-offset-2"
                      >
                        CGV et la politique d’annulation
                      </button>{' '}
                      (gratuit jusqu’à {adminSettings.cancellationHours}h avant l’arrivée).
                    </span>
                  </label>
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

        {/* Footer actions */}
        {!createdReservation && (
          <div className="px-5 py-4 border-t border-[#DBE6EC] bg-[#F2F7F9] flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep((prev) => (prev - 1) as 1 | 2 | 3);
                }}
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

            {step < 3 ? (
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
                disabled={isSubmitting}
                onClick={handleSubmitReservation}
                className="min-h-[46px] px-5 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>{isSubmitting ? 'Validation...' : 'Confirmer la réservation'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
