import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  KeyRound,
  MapPin,
  MessageCircle,
  QrCode,
  Search,
  ShieldCheck,
  Star,
  Upload,
  XCircle,
} from 'lucide-react';
import { AccesInfo, Bien, Reservation, StatutReservation } from '../types';
import { useApp } from '../context/AppContext';
import { reservationService } from '../services/reservationGateway';
import {
  buildCerimWhatsAppUrl,
  formatDateTimeFr,
  formatFcfa,
  formatIsoFr,
  getPhoneLast4,
  hoursUntilArrival,
  STATUT_LABELS,
} from '../utils/dataHelpers';
import { compressImageFile } from '../utils/imageCompression';
import { buildSuiviSeoConfig, usePageSeo } from '../utils/seo';

const TIMELINE_STEPS: Array<{ statut: StatutReservation; label: string }> = [
  { statut: 'demandee', label: 'Demandée' },
  { statut: 'confirmee', label: 'Confirmée' },
  { statut: 'bien_pret', label: 'Bien prêt' },
  { statut: 'arrivee', label: 'Arrivée' },
  { statut: 'terminee', label: 'Terminée' },
];

const STEP_INDEX: Partial<Record<StatutReservation, number>> = {
  en_attente_client: -1,
  demandee: 0,
  confirmee: 1,
  bien_pret: 2,
  arrivee: 3,
  terminee: 4,
};

export const TrackingPage: React.FC = () => {
  const {
    route,
    navigate,
    allBiens,
    reservations,
    refreshReservations,
    adminSettings,
    addReview,
    reviews,
    showToast,
  } = useApp();

  const seoConfig = useMemo(() => buildSuiviSeoConfig(), []);
  usePageSeo(seoConfig);

  const [codeInput, setCodeInput] = useState(route.trackingCode || '');
  const [tel4Input, setTel4Input] = useState('');
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [bien, setBien] = useState<Bien | undefined>(undefined);
  const [alternatives, setAlternatives] = useState<Bien[]>([]);
  const [accesInfo, setAccesInfo] = useState<AccesInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Post-stay review form (stored as 'en attente' for back-office only)
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSent, setReviewSent] = useState(false);

  useEffect(() => {
    if (route.trackingCode) {
      setCodeInput(route.trackingCode);
    }
  }, [route.trackingCode]);

  const loadReservationDetails = async (code: string, tel4: string) => {
    setError('');
    setLoading(true);
    try {
      const result = await reservationService.consulter(code, tel4, allBiens);
      setReservation(result.reservation);
      setBien(result.bien);
      setAlternatives(result.alternatives);
      refreshReservations();

      const access = await reservationService.getAcces(code, tel4);
      setAccesInfo(access);

      const qr = await QRCode.toDataURL(result.reservation.code, {
        width: 180,
        margin: 1,
        color: { dark: '#123B63', light: '#FFFFFF' },
      });
      setQrDataUrl(qr);
    } catch (err) {
      setReservation(null);
      setAccesInfo(null);
      setQrDataUrl('');
      setError(err instanceof Error ? err.message : 'Recherche impossible.');
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadReservationDetails(codeInput, tel4Input);
  };

  const handleSimulateOui = async () => {
    if (!reservation) return;
    try {
      const updated = await reservationService.confirmerClient(reservation.code, allBiens);
      setReservation(updated);
      refreshReservations();
      showToast({
        title: 'Réponse « OUI » enregistrée',
        description: `Dossier ${updated.code} transmis à notre équipe.`,
        type: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleCancel = async () => {
    if (!reservation) return;
    try {
      const result = await reservationService.annuler(reservation.code, tel4Input, 'client');
      setReservation(result.reservation);
      setAccesInfo(null);
      refreshReservations();
      showToast({
        title: result.gratuite ? 'Réservation annulée' : 'Annulation tardive enregistrée',
        description: result.message,
        type: result.gratuite ? 'info' : 'warning',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Annulation impossible.');
    }
  };

  const handleUploadId = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !reservation) return;
    try {
      const compressed = await compressImageFile(file, 1024 * 1024);
      const updated = await reservationService.ajouterPieceIdentite(
        reservation.code,
        tel4Input,
        compressed.dataUrl
      );
      setReservation(updated);
      refreshReservations();
      showToast({
        title: 'Pièce d’identité enregistrée',
        description: 'Document compressé et ajouté au dossier pour votre arrivée.',
        type: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur sur l’image.');
    }
  };

  const handleAlternativeDecision = async (accepter: boolean) => {
    if (!reservation) return;
    try {
      const res = await reservationService.repondreAlternative(
        reservation.code,
        tel4Input,
        accepter,
        allBiens
      );
      refreshReservations();
      if (accepter && res.nouvelle) {
        setCodeInput(res.nouvelle.code);
        await loadReservationDetails(res.nouvelle.code, tel4Input);
        showToast({
          title: 'Nouvelle réservation créée',
          description: `Votre dossier alternatif ${res.nouvelle.code} est transmis.`,
          type: 'success',
        });
      } else {
        setReservation(res.original);
        showToast({
          title: 'Alternative refusée sans frais',
          type: 'info',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible.');
    }
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;
    addReview({
      id: `rev-${Date.now()}`,
      reservationId: reservation.id,
      reservationCode: reservation.code,
      matricule: reservation.matricule,
      titre: reservation.titre,
      note: reviewRating,
      commentaire: reviewComment.trim(),
      date: new Date().toISOString().slice(0, 10),
    });
    setReviewSent(true);
    setReviewComment('');
  };

  const alreadyReviewed = useMemo(() => {
    if (!reservation) return false;
    return reviews.some(
      (r) => r.reservationId === reservation.id || r.reservationCode === reservation.code
    );
  }, [reservation, reviews]);

  const helpWhatsAppUrl = buildCerimWhatsAppUrl(
    reservation
      ? `Bonjour CERIM, j’ai besoin d’aide concernant ma réservation ${reservation.code} (${reservation.matricule}).`
      : 'Bonjour CERIM, j’ai besoin d’aide pour suivre ma réservation.'
  );

  const canCancel =
    reservation &&
    ['en_attente_client', 'demandee', 'confirmee', 'bien_pret'].includes(reservation.statut);
  const isLateCancelWarning =
    reservation &&
    (reservation.statut === 'confirmee' || reservation.statut === 'bien_pret') &&
    hoursUntilArrival(reservation.debut) < adminSettings.cancellationHours;

  const altBienProposed = useMemo(() => {
    if (!reservation?.alternativePropose) return alternatives[0];
    return allBiens.find((b) => b.matricule === reservation.alternativePropose) || alternatives[0];
  }, [reservation?.alternativePropose, alternatives, allBiens]);

  const currentStepIdx = reservation ? (STEP_INDEX[reservation.statut] ?? -1) : -1;

  // Aide discrète en mode aperçu si l'utilisateur a déjà créé des réservations sur cet appareil
  const recentLocalCodes = useMemo(() => reservations.slice(0, 3), [reservations]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#0C7A6D]">
          Espace client sans compte
        </p>
        <h1 className="text-2xl sm:text-4xl font-semibold text-[#123B63] tracking-tight">
          Suivi de réservation
        </h1>
        <p className="text-sm sm:text-base text-[#5A7084]">
          Saisissez votre code CERIM et les 4 derniers chiffres de votre numéro de téléphone pour
          consulter l’état de votre dossier, votre QR code d’arrivée et votre adresse d’accès dès
          confirmation.
        </p>
      </div>

      {/* Lookup Form */}
      <form
        onSubmit={handleLookup}
        className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-5 space-y-1.5">
            <label htmlFor="suivi-code" className="block text-xs font-semibold text-[#123B63]">
              Code de réservation
            </label>
            <input
              id="suivi-code"
              type="text"
              required
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Ex: CER-AP1-0042"
              className="w-full min-h-[44px] px-3.5 rounded-lg border border-[#DBE6EC] text-sm font-semibold text-[#123B63] uppercase tabular-nums focus:border-[#20B8A6] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-4 space-y-1.5">
            <label htmlFor="suivi-tel4" className="block text-xs font-semibold text-[#123B63]">
              4 derniers chiffres du téléphone
            </label>
            <input
              id="suivi-tel4"
              type="text"
              inputMode="numeric"
              maxLength={4}
              required
              value={tel4Input}
              onChange={(e) => setTel4Input(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
              placeholder="Ex: 0000"
              className="w-full min-h-[44px] px-3.5 rounded-lg border border-[#DBE6EC] text-sm font-semibold text-[#123B63] tabular-nums focus:border-[#20B8A6] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              <span>{loading ? 'Recherche...' : 'Consulter'}</span>
            </button>
          </div>
        </div>

        {recentLocalCodes.length > 0 && !reservation && (
          <div className="pt-2 border-t border-[#DBE6EC] flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#5A7084]">Dossiers récents sur cet appareil :</span>
            {recentLocalCodes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  const last4 = getPhoneLast4(r.client.telephone);
                  setCodeInput(r.code);
                  setTel4Input(last4);
                  loadReservationDetails(r.code, last4);
                }}
                className="px-2.5 py-1 rounded bg-[#F2F7F9] border border-[#DBE6EC] hover:border-[#20B8A6] text-[#123B63] font-semibold tabular-nums"
              >
                {r.code}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5"
          >
            {error}
          </p>
        )}
      </form>

      {/* Reservation Details */}
      {reservation && (
        <div className="space-y-6">
          {/* Status Header + QR */}
          <section className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-2.5 py-1 bg-[#F2F7F9] border-[1.5px] border-[#123B63] text-[#123B63] text-xs font-bold rounded-[4px] tabular-nums">
                  {reservation.code}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0C7A6D]">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>{STATUT_LABELS[reservation.statut]}</span>
                </span>
              </div>

              <h2 className="text-xl font-semibold text-[#123B63]">{reservation.titre}</h2>
              <p className="text-sm text-[#5A7084] flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
                  <span>
                    {reservation.quartier}, {reservation.ville}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Calendar className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
                  <span>
                    {formatIsoFr(reservation.debut)} → {formatIsoFr(reservation.fin)} (
                    {reservation.creneauArrivee || '—'})
                  </span>
                </span>
              </p>
              <p className="text-sm font-semibold text-[#123B63] tabular-nums">
                Montant à payer sur place à l’arrivée :{' '}
                <span className="text-[#0C7A6D]">{formatFcfa(reservation.totalEstime)}</span>
              </p>
            </div>

            {qrDataUrl && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] shrink-0">
                <img
                  src={qrDataUrl}
                  alt={`QR Code réservation ${reservation.code}`}
                  className="w-20 h-20 rounded bg-white p-1 border border-[#DBE6EC]"
                />
                <div className="text-xs space-y-1 max-w-[140px]">
                  <p className="font-semibold text-[#123B63] inline-flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5 text-[#0C7A6D]" aria-hidden="true" />
                    <span>Pass check-in</span>
                  </p>
                  <p className="text-[#5A7084] leading-snug">
                    Présentez ce QR code à l’accueil CERIM lors de votre arrivée.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Pending Double Confirmation ("OUI" simulation) */}
          {reservation.statut === 'en_attente_client' && (
            <section className="rounded-xl bg-[#0B2A47] text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#36CBB9]">
                  Action requise sous 2 heures
                </p>
                <h3 className="text-base sm:text-lg font-semibold">
                  Confirmez votre demande en répondant « OUI »
                </h3>
                <p className="text-xs sm:text-sm text-white/80">
                  Sans confirmation avant{' '}
                  {reservation.expiresAt ? formatDateTimeFr(reservation.expiresAt) : 'expiration'},
                  les dates seront automatiquement libérées.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSimulateOui}
                className="min-h-[44px] px-5 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                Simuler la réponse « OUI »
              </button>
            </section>
          )}

          {/* Alternative Proposition (when refused / timed out) */}
          {reservation.statut === 'refusee' && (
            <section className="rounded-xl border-2 border-[#20B8A6] bg-white p-5 sm:p-6 space-y-4">
              {altBienProposed ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0C7A6D]">
                      Remplacement équivalent proposé par CERIM
                    </p>
                    <h3 className="text-lg font-semibold text-[#123B63]">
                      Le bien initial n’est plus libre — nous avons trouvé une alternative similaire
                    </h3>
                    <p className="text-sm text-[#5A7084]">
                      Même ville ({altBienProposed.ville}), même catégorie ({altBienProposed.type})
                      et disponible sur vos dates.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-[#0C7A6D]">
                        {altBienProposed.matricule} · {altBienProposed.quartier}
                      </p>
                      <p className="text-base font-semibold text-[#123B63]">
                        {altBienProposed.titre}
                      </p>
                      <p className="text-sm font-semibold text-[#0C7A6D] tabular-nums mt-0.5">
                        {formatFcfa(altBienProposed.prix)} / {altBienProposed.periode}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAlternativeDecision(true)}
                        className="min-h-[42px] px-4 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs sm:text-sm font-semibold transition-colors"
                      >
                        Accepter ce bien
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAlternativeDecision(false)}
                        className="min-h-[42px] px-4 rounded-lg border border-[#DBE6EC] bg-white text-[#5A7084] hover:text-[#123B63] text-xs sm:text-sm font-semibold transition-colors"
                      >
                        Refuser sans frais
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[#123B63]">
                      Nous sommes désolés — bien indisponible aux dates choisies
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5A7084]">
                      Aucun bien équivalent automatique n’est libre sur ce créneau. Notre équipe
                      CERIM est alertée et peut vous orienter sur WhatsApp.
                    </p>
                  </div>
                  <a
                    href={helpWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[42px] px-4 rounded-lg bg-[#123B63] text-white text-xs font-semibold inline-flex items-center gap-2 shrink-0"
                  >
                    <MessageCircle className="w-4 h-4 text-[#20B8A6]" aria-hidden="true" />
                    <span>Contacter CERIM</span>
                  </a>
                </div>
              )}
            </section>
          )}

          {/* 5-step Progress Bar */}
          {currentStepIdx >= 0 && (
            <section className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[#123B63]">Frise d’avancement</h3>
              <ol className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {TIMELINE_STEPS.map((st, idx) => {
                  const reached = currentStepIdx >= idx;
                  const active = currentStepIdx === idx;
                  return (
                    <li
                      key={st.statut}
                      className={`p-3 rounded-lg border text-xs space-y-1 ${
                        active
                          ? 'border-[#20B8A6] bg-[#20B8A6]/15 text-[#123B63]'
                          : reached
                            ? 'border-[#DBE6EC] bg-[#F2F7F9] text-[#0C7A6D]'
                            : 'border-[#DBE6EC] bg-white text-[#5A7084]/75'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold tabular-nums">0{idx + 1}</span>
                        {reached ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0C7A6D]" aria-hidden="true" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-[#5A7084]/50" aria-hidden="true" />
                        )}
                      </div>
                      <p className="font-semibold">{st.label}</p>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* Exact Address & Access (UNLOCKED ONLY >= confirmee via reservationService.getAcces) */}
          <section className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#123B63]">
              <KeyRound className="w-5 h-5 text-[#0C7A6D]" aria-hidden="true" />
              <h3 className="text-base font-semibold">Adresse exacte &amp; consignes d’accès</h3>
            </div>

            {accesInfo ? (
              <div className="rounded-xl bg-[#F2F7F9] border border-[#20B8A6]/50 p-4 space-y-2 text-sm">
                <p>
                  <span className="text-[#5A7084]">Adresse exacte : </span>
                  <span className="font-semibold text-[#123B63]">{accesInfo.adresseExacte}</span>
                </p>
                <p>
                  <span className="text-[#5A7084]">Point de rendez-vous : </span>
                  <span className="font-medium text-[#0F2233]">{accesInfo.pointRendezVous}</span>
                </p>
                <p>
                  <span className="text-[#5A7084]">Consignes : </span>
                  <span className="text-[#0F2233]">{accesInfo.consignesAcces}</span>
                </p>
                <p className="text-xs text-[#0C7A6D] font-semibold pt-1">
                  Interlocuteur unique CERIM : {accesInfo.contactCerim}
                </p>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-[#5A7084] bg-[#F2F7F9] border border-[#DBE6EC] rounded-lg p-3.5">
                L’adresse exacte et les consignes de remise des clés restent masquées jusqu’à la
                confirmation du séjour (statut « Confirmée »). Quartier indiqué :{' '}
                <strong className="text-[#123B63]">
                  {reservation.quartier}, {reservation.ville}
                </strong>
                .
              </p>
            )}
          </section>

          {/* Pièce d'identité avant arrivée */}
          {!reservation.client.pieceIdentite &&
            ['en_attente_client', 'demandee', 'confirmee', 'bien_pret'].includes(
              reservation.statut
            ) && (
              <section className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-semibold text-[#123B63]">
                    Pièce d’identité à fournir avant l’arrivée
                  </h3>
                  <p className="text-xs text-[#5A7084]">
                    Pour accélérer votre check-in sur place, déposez une photo de votre CNI ou
                    passeport (compressée automatiquement sous 1 Mo).
                  </p>
                </div>
                <label className="min-h-[42px] px-4 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shrink-0">
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>Envoyer ma pièce</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadId}
                    className="sr-only"
                  />
                </label>
              </section>
            )}

          {/* Historique horodaté + Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-4">
              <h3 className="text-base font-semibold text-[#123B63]">Historique du dossier</h3>
              <ul className="space-y-3">
                {[...reservation.historique].reverse().map((h, i) => (
                  <li
                    key={`${h.date}-${i}`}
                    className="p-3 rounded-lg bg-[#F2F7F9] border border-[#DBE6EC] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#123B63]">
                        {STATUT_LABELS[h.statut] || h.statut}
                      </span>
                      <span className="text-[#5A7084] tabular-nums">{formatDateTimeFr(h.date)}</span>
                    </div>
                    {h.note && <p className="text-[#5A7084]">{h.note}</p>}
                  </li>
                ))}
              </ul>
            </section>

            <section className="lg:col-span-5 bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-4">
              <h3 className="text-base font-semibold text-[#123B63]">Actions &amp; Assistance</h3>

              <div className="space-y-3 text-xs text-[#5A7084]">
                <p>
                  Politique d’annulation : gratuite jusqu’à {adminSettings.cancellationHours}h avant
                  l’arrivée. En dessous, un no-show est enregistré.
                </p>

                {isLateCancelWarning && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Moins de {adminSettings.cancellationHours}h avant l’arrivée : une annulation
                      enregistrera un no-show. Contactez CERIM en cas d’imprévu.
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2.5 pt-1">
                {canCancel && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-full min-h-[44px] px-4 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <XCircle className="w-4 h-4" aria-hidden="true" />
                    <span>Annuler la réservation</span>
                  </button>
                )}

                <a
                  href={helpWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[44px] px-4 rounded-lg bg-[#123B63] hover:bg-[#0B2A47] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[#20B8A6]" aria-hidden="true" />
                  <span>Besoin d’aide ? (WhatsApp CERIM)</span>
                </a>

                {bien && (
                  <button
                    type="button"
                    onClick={() => navigate({ page: 'detail', matricule: bien.matricule })}
                    className="w-full min-h-[40px] px-4 rounded-lg border border-[#DBE6EC] text-xs font-semibold text-[#123B63] hover:border-[#20B8A6] inline-flex items-center justify-center gap-1.5"
                  >
                    <span>Voir la fiche du bien</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </section>
          </div>

          {/* Post-stay Review (stored privately in back-office as 'en attente', never displayed publicly) */}
          {reservation.statut === 'terminee' && !alreadyReviewed && !reviewSent && (
            <section className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#123B63]">
                  Votre avis sur votre séjour (contrôle qualité interne CERIM)
                </h3>
                <p className="text-xs text-[#5A7084]">
                  Votre retour est transmis uniquement à l’équipe CERIM pour évaluer la qualité
                  d’accueil.
                </p>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-3">
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewRating(n)}
                      className={`min-h-[38px] px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 ${
                        reviewRating >= n
                          ? 'bg-[#20B8A6] border-[#20B8A6] text-[#123B63]'
                          : 'bg-white border-[#DBE6EC] text-[#5A7084]'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" aria-hidden="true" />
                      <span className="tabular-nums">{n}</span>
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Comment s’est déroulée votre arrivée et votre location ?"
                  className="w-full px-3 py-2 rounded-lg border border-[#DBE6EC] text-sm focus:border-[#20B8A6] focus:outline-none"
                />

                <button
                  type="submit"
                  className="min-h-[42px] px-5 rounded-lg bg-[#123B63] hover:bg-[#0B2A47] text-white text-xs sm:text-sm font-semibold"
                >
                  Envoyer mon avis à CERIM
                </button>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
