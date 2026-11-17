import React from 'react';
import { CheckCircle2, Clock, MapPin, BedDouble, Maximize2, Cog, Fuel, Users, Heart } from 'lucide-react';
import { Bien } from '../types';
import { FallbackImage } from './BrandMark';
import { formatFcfa, formatIsoFr, isAvailableToday } from '../utils/dataHelpers';
import { useApp } from '../context/AppContext';

interface PropertyCardProps {
  bien: Bien;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ bien }) => {
  const { navigate, catalogBlocks, reservations, isFavorite, toggleFavorite } = useApp();
  const extraBlocked = catalogBlocks[bien.matricule] || [];
  const availableToday = isAvailableToday(bien, extraBlocked, reservations);
  const fav = isFavorite(bien.matricule);

  const openDetail = () => {
    navigate({ page: 'detail', matricule: bien.matricule });
  };

  return (
    <article className="h-full cerim-card-anim group bg-white rounded-xl border border-[#DBE6EC] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F2F7F9]">
        <button
          type="button"
          onClick={openDetail}
          aria-label={`Voir la fiche de ${bien.titre}`}
          className="w-full h-full block focus-visible:outline-none"
        >
          <FallbackImage
            src={bien.photos[0] || ''}
            alt={`${bien.titre} — ${bien.quartier}, ${bien.ville}`}
            type={bien.type}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        </button>

        {/* Square Matricule Stamp echoing the square brand mark */}
        <span className="pointer-events-none absolute top-3 left-3 inline-flex items-center justify-center px-2 py-0.5 bg-white border-[1.5px] border-[#123B63] text-[#123B63] text-xs font-semibold tracking-wide rounded-[3px] shadow-xs">
          {bien.matricule}
        </span>

        {/* Favorite Heart Toggle */}
        <button
          type="button"
          onClick={() => toggleFavorite(bien.matricule, bien.titre)}
          aria-label={
            fav
              ? `Retirer ${bien.matricule} des favoris`
              : `Ajouter ${bien.matricule} aux favoris`
          }
          aria-pressed={fav}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full inline-flex items-center justify-center border shadow-xs transition-all ${
            fav
              ? 'bg-[#20B8A6] border-[#20B8A6] text-[#123B63]'
              : 'bg-white/95 hover:bg-white border-[#DBE6EC] text-[#123B63]'
          }`}
        >
          <Heart className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        onClick={openDetail}
        className="p-5 flex-1 flex flex-col justify-between gap-4 text-left focus-visible:outline-none"
      >
        <div className="space-y-2">
          {/* Unboxed metadata row: Status + Today's availability + Publication date */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
            <span className="text-[#0C7A6D] font-semibold">{bien.statut}</span>
            <span className="text-[#DBE6EC]" aria-hidden="true">
              ·
            </span>
            {availableToday ? (
              <span className="inline-flex items-center gap-1 text-[#0C7A6D] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Disponible aujourd&apos;hui</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[#5A7084] font-semibold">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Occupé aujourd&apos;hui</span>
              </span>
            )}
            <span className="text-[#DBE6EC]" aria-hidden="true">
              ·
            </span>
            <span className="text-[#5A7084] tabular-nums">
              Publié le {formatIsoFr(bien.date_publication)}
            </span>
          </div>

          <h3 className="text-base font-semibold text-[#123B63] leading-snug group-hover:text-[#0C7A6D] transition-colors">
            {bien.titre}
          </h3>

          <p className="inline-flex items-center gap-1.5 text-sm text-[#5A7084]">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#0C7A6D]" aria-hidden="true" />
            <span>
              {bien.quartier} · {bien.ville}
            </span>
          </p>
        </div>

        <div className="pt-3 border-t border-[#DBE6EC] flex items-end justify-between gap-3 w-full">
          <div>
            <p className="text-lg font-semibold text-[#123B63] tabular-nums leading-tight">
              {formatFcfa(bien.prix)}
            </p>
            <p className="text-xs text-[#5A7084]">par {bien.periode} · paiement sur place</p>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#5A7084] shrink-0">
            {bien.type === 'Appartement' ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <BedDouble className="w-3.5 h-3.5 text-[#123B63]" aria-hidden="true" />
                  <span className="tabular-nums">{bien.chambres} ch.</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Maximize2 className="w-3.5 h-3.5 text-[#123B63]" aria-hidden="true" />
                  <span className="tabular-nums">{bien.surface} m²</span>
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1">
                  <Cog className="w-3.5 h-3.5 text-[#123B63]" aria-hidden="true" />
                  <span>{bien.boite === 'Automatique' ? 'Auto' : 'Manuelle'}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Fuel className="w-3.5 h-3.5 text-[#123B63]" aria-hidden="true" />
                  <span>{bien.carburant}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#123B63]" aria-hidden="true" />
                  <span className="tabular-nums">{bien.places} pl.</span>
                </span>
              </>
            )}
          </div>
        </div>
      </button>
    </article>
  );
};

export { PropertyCardSkeleton } from './SearchResultsSkeleton';

