import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BedDouble,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Cog,
  FileCheck2,
  Fuel,
  Heart,
  Images,
  MapPin,
  Maximize2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AvailabilityCalendar } from '../components/AvailabilityCalendar';
import { FallbackImage } from '../components/BrandMark';
import { Lightbox } from '../components/Lightbox';
import { ReservationWizardModal } from '../components/ReservationWizardModal';
import { AnimatedSuccessIcon } from '../components/AnimatedSuccessIcon';
import { MarketPriceChart } from '../components/MarketPriceChart';
import { Reservation } from '../types';
import {
  computeEstimate,
  formatFcfa,
  formatIsoFr,
  isAvailableToday,
} from '../utils/dataHelpers';
import { CERIM_WHATSAPP_DISPLAY } from '../data/biens';
import { buildBienSeoConfig, buildSearchSeoConfig, usePageSeo } from '../utils/seo';

export const DetailPage: React.FC = () => {
  const {
    allBiens,
    reservations,
    route,
    navigate,
    recordVisit,
    recordInteraction,
    catalogBlocks,
    adminSettings,
    isFavorite,
    toggleFavorite,
  } = useApp();

  const bien = useMemo(
    () => allBiens.find((b) => b.matricule === route.matricule) || allBiens[0],
    [allBiens, route.matricule]
  );

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);

  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [lastReservation, setLastReservation] = useState<Reservation | null>(null);

  const detailSeo = useMemo(() => {
    if (!bien) {
      return buildSearchSeoConfig(
        { type: 'Tous', ville: 'Toutes', budgetMax: null, debut: '', fin: '', sort: 'recommandes' },
        allBiens
      );
    }
    const blocked = catalogBlocks[bien.matricule] || [];
    const avail = isAvailableToday(bien, blocked, reservations);
    // Les avis clients ne sont jamais affichés publiquement (modération interne uniquement)
    return buildBienSeoConfig(bien, avail, []);
  }, [bien, allBiens, catalogBlocks, reservations]);

  usePageSeo(detailSeo);

  useEffect(() => {
    if (bien?.matricule) {
      recordVisit(bien.matricule);
      recordInteraction(bien.matricule, 'views');
      setDebut('');
      setFin('');
      setWizardOpen(false);
      setLastReservation(null);
    }
  }, [bien?.matricule, recordVisit, recordInteraction]);

  if (!bien) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-lg font-semibold text-[#123B63]">Annonce introuvable</p>
        <button
          type="button"
          onClick={() => navigate({ page: 'recherche' })}
          className="px-5 py-2.5 rounded-lg bg-[#20B8A6] text-[#123B63] text-sm font-semibold"
        >
          Retour aux annonces
        </button>
      </div>
    );
  }

  const extraBlocked = catalogBlocks[bien.matricule] || [];
  const availableToday = isAvailableToday(bien, extraBlocked, reservations);

  const estimate = useMemo(() => {
    if (!debut || !fin) return null;
    return computeEstimate(bien.prix, bien.periode, debut, fin);
  }, [bien.prix, bien.periode, debut, fin]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate({ page: 'recherche', filters: { type: bien.type } })}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#123B63] hover:text-[#0C7A6D] transition-colors min-h-[40px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Retour aux {bien.type === 'Appartement' ? 'appartements' : 'voitures'}</span>
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => toggleFavorite(bien.matricule, bien.titre)}
            aria-pressed={isFavorite(bien.matricule)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border text-xs font-semibold transition-colors ${
              isFavorite(bien.matricule)
                ? 'bg-[#20B8A6] border-[#20B8A6] text-[#123B63]'
                : 'bg-white border-[#DBE6EC] hover:border-[#123B63] text-[#123B63]'
            }`}
          >
            <Heart
              className={`w-3.5 h-3.5 ${isFavorite(bien.matricule) ? 'fill-current' : ''}`}
              aria-hidden="true"
            />
            <span>{isFavorite(bien.matricule) ? 'Favori enregistré' : 'Ajouter aux favoris'}</span>
          </button>

          <span className="inline-flex items-center justify-center px-2.5 py-1 bg-white border-[1.5px] border-[#123B63] text-[#123B63] text-xs font-semibold tracking-wide rounded-[3px]">
            {bien.matricule}
          </span>
          <span className="text-xs font-semibold text-[#0C7A6D]">{bien.statut}</span>
          <span className="text-[#DBE6EC]" aria-hidden="true">
            ·
          </span>
          {availableToday ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0C7A6D]">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Disponible aujourd&apos;hui</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#5A7084]">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Occupé aujourd&apos;hui</span>
            </span>
          )}
        </div>
      </div>

      {/* Title & Price Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#123B63] tracking-tight">
            {bien.titre}
          </h1>
          <p className="inline-flex items-center gap-1.5 text-sm sm:text-base text-[#5A7084]">
            <MapPin className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
            <span>
              {bien.quartier}, {bien.ville} (adresse exacte transmise après confirmation)
            </span>
          </p>
        </div>

        <div className="md:text-right">
          <p className="text-2xl sm:text-3xl font-semibold text-[#123B63] tabular-nums">
            {formatFcfa(bien.prix)}
          </p>
          <p className="text-xs sm:text-sm text-[#0C7A6D] font-medium">
            par {bien.periode} · paiement sur place
          </p>
        </div>
      </div>

      {/* Gallery */}
      <section aria-label="Galerie photos" className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <button
          type="button"
          onClick={() => {
            setLightboxIndex(0);
            setLightboxOpen(true);
            recordInteraction(bien.matricule, 'galleryOpens');
          }}
          className="md:col-span-8 relative aspect-[16/10] rounded-xl overflow-hidden bg-[#F2F7F9] group text-left"
        >
          <FallbackImage
            src={bien.photos[0] || ''}
            alt={`${bien.titre} — photo principale`}
            type={bien.type}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B2A47]/85 text-white text-xs font-semibold">
            <Images className="w-4 h-4 text-[#20B8A6]" aria-hidden="true" />
            <span className="tabular-nums">Voir les photos ({bien.photos.length})</span>
          </span>
        </button>

        <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-3">
          {(bien.photos.length > 1 ? bien.photos.slice(1, 3) : [bien.photos[0]]).map(
            (photo, i) => (
              <button
                key={`${photo}-${i}`}
                type="button"
                onClick={() => {
                  setLightboxIndex(bien.photos.length > 1 ? i + 1 : 0);
                  setLightboxOpen(true);
                  recordInteraction(bien.matricule, 'galleryOpens');
                }}
                className="relative aspect-[16/10] rounded-xl overflow-hidden bg-[#F2F7F9] group"
              >
                <FallbackImage
                  src={photo || ''}
                  alt={`${bien.titre} — aperçu ${i + 2}`}
                  type={bien.type}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
              </button>
            )
          )}
        </div>
      </section>

      {/* Main Content + Booking Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-8">
          {/* Specs */}
          <section className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#123B63]">Caractéristiques</h2>
            {bien.type === 'Appartement' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-[#F2F7F9]">
                  <p className="text-xs text-[#5A7084]">Chambres</p>
                  <p className="font-semibold text-[#123B63] mt-0.5 flex items-center gap-1.5 tabular-nums">
                    <BedDouble className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
                    <span>{bien.chambres}</span>
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F2F7F9]">
                  <p className="text-xs text-[#5A7084]">Surface</p>
                  <p className="font-semibold text-[#123B63] mt-0.5 flex items-center gap-1.5 tabular-nums">
                    <Maximize2 className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
                    <span>{bien.surface} m²</span>
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F2F7F9]">
                  <p className="text-xs text-[#5A7084]">Tarification</p>
                  <p className="font-semibold text-[#123B63] mt-0.5 capitalize">
                    Par {bien.periode}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-[#F2F7F9]">
                  <p className="text-xs text-[#5A7084]">Modèle</p>
                  <p className="font-semibold text-[#123B63] mt-0.5 flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
                    <span>
                      {bien.marque} {bien.modele}
                    </span>
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F2F7F9]">
                  <p className="text-xs text-[#5A7084]">Année</p>
                  <p className="font-semibold text-[#123B63] mt-0.5 tabular-nums">{bien.annee}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#F2F7F9]">
                  <p className="text-xs text-[#5A7084]">Boîte</p>
                  <p className="font-semibold text-[#123B63] mt-0.5 flex items-center gap-1.5">
                    <Cog className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
                    <span>{bien.boite}</span>
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F2F7F9]">
                  <p className="text-xs text-[#5A7084]">Carburant</p>
                  <p className="font-semibold text-[#123B63] mt-0.5 flex items-center gap-1.5">
                    <Fuel className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
                    <span>{bien.carburant}</span>
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F2F7F9]">
                  <p className="text-xs text-[#5A7084]">Places</p>
                  <p className="font-semibold text-[#123B63] mt-0.5 flex items-center gap-1.5 tabular-nums">
                    <Users className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
                    <span>{bien.places} places</span>
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Description */}
          <section className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-3">
            <h2 className="text-lg font-semibold text-[#123B63]">Description</h2>
            <p className="text-sm sm:text-base font-medium text-[#123B63]">{bien.resume}</p>
            <p className="text-sm sm:text-base text-[#5A7084] leading-relaxed">
              {bien.description}
            </p>
          </section>

          {/* Availability Calendar */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#0C7A6D]" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-[#123B63]">
                Calendrier de disponibilité
              </h2>
            </div>
            <p className="text-sm text-[#5A7084]">
              Cliquez sur une date de début puis une date de fin. Les jours réservés ou bloqués
              sont désactivés.
            </p>
            <AvailabilityCalendar
              bien={bien}
              extraBlocked={extraBlocked}
              activeReservations={reservations}
              mode="select"
              selectedStart={debut}
              selectedEnd={fin}
              onSelectRange={(d, f) => {
                setDebut(d);
                setFin(f);
                if (d && f) {
                  recordInteraction(bien.matricule, 'calendarSelections');
                }
              }}
            />
          </section>
        </div>

        {/* Right: Booking Card */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24 bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-5 shadow-sm">
          <div className="space-y-1 pb-4 border-b border-[#DBE6EC]">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-2xl font-semibold text-[#123B63] tabular-nums">
                {formatFcfa(bien.prix)}
              </p>
              <span className="text-xs font-semibold text-[#0C7A6D]">
                par {bien.periode} · Paiement sur place
              </span>
            </div>
            <p className="text-xs text-[#5A7084]">
              Réservation sans paiement en ligne : vous payez à votre arrivée. Géré par CERIM.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[#F2F7F9] border border-[#DBE6EC] space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#5A7084]">Matricule</span>
              <span className="font-semibold text-[#123B63]">{bien.matricule}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#5A7084]">Période choisie</span>
              <span className="font-semibold text-[#123B63] tabular-nums text-right">
                {debut && fin
                  ? `${formatIsoFr(debut)} → ${formatIsoFr(fin)}`
                  : debut
                    ? `À partir du ${formatIsoFr(debut)}`
                    : 'Sélectionnez vos dates'}
              </span>
            </div>
            {estimate && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#5A7084]">Durée</span>
                  <span className="font-medium text-[#0F2233] tabular-nums">
                    {estimate.dureeLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#DBE6EC]">
                  <span className="font-semibold text-[#123B63]">Estimation totale</span>
                  <span className="text-base font-semibold text-[#0C7A6D] tabular-nums">
                    {formatFcfa(estimate.total)}
                  </span>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm sm:text-base font-semibold transition-colors shadow-xs"
          >
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            <span>Réserver (paiement sur place)</span>
          </button>

          {lastReservation && (
            <div
              role="status"
              className="p-3.5 rounded-lg bg-[#20B8A6]/15 border border-[#20B8A6] text-xs text-[#123B63] flex items-start gap-3"
            >
              <AnimatedSuccessIcon variant="compact" className="mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-semibold">
                  Dossier {lastReservation.code} enregistré.
                </p>
                <p>
                  Retrouvez l’état d’avancement, la réponse « OUI » et votre QR code d’arrivée sur la
                  page de suivi.
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'suivi', trackingCode: lastReservation.code })}
                  className="inline-flex items-center gap-1 font-semibold underline text-[#0C7A6D]"
                >
                  <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Suivre {lastReservation.code}</span>
                </button>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-[#DBE6EC] space-y-1.5 text-xs text-[#5A7084]">
            <p>
              Interlocuteur unique CERIM :{' '}
              <span className="font-semibold text-[#123B63] tabular-nums">
                {CERIM_WHATSAPP_DISPLAY}
              </span>
            </p>
            <p>
              Annulation gratuite jusqu’à {adminSettings.cancellationHours}h avant l’arrivée.
              L’adresse exacte et les consignes d’accès apparaissent dans votre espace de suivi dès
              confirmation.
            </p>
          </div>
        </aside>
      </div>

      {/* Contextual Market Benchmark */}
      <section aria-label="Repères de prix du marché local" className="pt-2">
        <MarketPriceChart
          initialVille={bien.ville}
          initialType={bien.type}
          highlightQuartier={bien.quartier}
          compact
        />
      </section>

      <ReservationWizardModal
        bien={bien}
        extraBlocked={extraBlocked}
        initialDebut={debut}
        initialFin={fin}
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onReservationCreated={(res) => {
          setDebut(res.debut);
          setFin(res.fin);
          setLastReservation(res);
          recordInteraction(bien.matricule, 'whatsappClicks');
        }}
      />

      <Lightbox
        photos={bien.photos}
        title={`${bien.matricule} — ${bien.titre}`}
        type={bien.type}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};
