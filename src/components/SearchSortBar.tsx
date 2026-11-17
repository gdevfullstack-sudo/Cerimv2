import React from 'react';
import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { SearchSortOption } from '../types';

interface SearchSortBarProps {
  sort: SearchSortOption;
  onChangeSort: (next: SearchSortOption) => void;
  showApartmentSorts: boolean;
  showCarSorts: boolean;
}

const SORT_LABELS: Record<SearchSortOption, string> = {
  recommandes: 'Recommandés',
  'prix-asc': 'Prix croissant',
  'prix-desc': 'Prix décroissant',
  recents: 'Plus récents',
  anciens: 'Plus anciens',
  'chambres-desc': 'Chambres (décroissant)',
  'chambres-asc': 'Chambres (croissant)',
  carburant: 'Type de carburant',
};

export const SearchSortBar: React.FC<SearchSortBarProps> = ({
  sort,
  onChangeSort,
  showApartmentSorts,
  showCarSorts,
}) => {
  const prefersReducedMotion = useReducedMotion();

  const isPriceSort = sort === 'prix-asc' || sort === 'prix-desc';
  const isDateSort = sort === 'recents' || sort === 'anciens';
  const isExtraSort =
    sort === 'chambres-desc' || sort === 'chambres-asc' || sort === 'carburant';

  const handlePriceToggle = () => {
    if (sort === 'prix-asc') {
      onChangeSort('prix-desc');
    } else {
      onChangeSort('prix-asc');
    }
  };

  const handleDateToggle = () => {
    if (sort === 'recents') {
      onChangeSort('anciens');
    } else {
      onChangeSort('recents');
    }
  };

  const activePillTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 34 };

  return (
    <div className="bg-white rounded-xl border border-[#DBE6EC] p-3 sm:px-4 sm:py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#5A7084] mr-1 whitespace-nowrap shrink-0">
          Trier par :
        </span>

        <div
          role="group"
          aria-label="Interface de tri avancée"
          className="flex flex-wrap items-center gap-1.5"
        >
          {/* Recommandés */}
          <button
            type="button"
            onClick={() => onChangeSort('recommandes')}
            aria-pressed={sort === 'recommandes'}
            className={`relative min-h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              sort === 'recommandes'
                ? 'text-white'
                : 'text-[#123B63] bg-[#F2F7F9] hover:bg-[#E4EEF3]'
            }`}
          >
            {sort === 'recommandes' && (
              <motion.span
                layoutId="cerim-active-sort-bg"
                transition={activePillTransition}
                className="absolute inset-0 rounded-lg bg-[#123B63]"
                aria-hidden="true"
              />
            )}
            <Sparkles className="relative z-10 w-3.5 h-3.5" aria-hidden="true" />
            <span className="relative z-10">Recommandés</span>
          </button>

          {/* Prix Croissant / Décroissant */}
          <button
            type="button"
            onClick={handlePriceToggle}
            aria-pressed={isPriceSort}
            title="Cliquer pour inverser l’ordre de prix (croissant / décroissant)"
            className={`relative min-h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              isPriceSort
                ? 'text-white'
                : 'text-[#123B63] bg-[#F2F7F9] hover:bg-[#E4EEF3]'
            }`}
          >
            {isPriceSort && (
              <motion.span
                layoutId="cerim-active-sort-bg"
                transition={activePillTransition}
                className="absolute inset-0 rounded-lg bg-[#123B63]"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {sort === 'prix-asc' ? (
                <ArrowUpNarrowWide className="w-3.5 h-3.5 text-[#36CBB9]" aria-hidden="true" />
              ) : sort === 'prix-desc' ? (
                <ArrowDownWideNarrow className="w-3.5 h-3.5 text-[#36CBB9]" aria-hidden="true" />
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5 text-[#0C7A6D]" aria-hidden="true" />
              )}
              <span>
                {sort === 'prix-asc'
                  ? 'Prix croissant'
                  : sort === 'prix-desc'
                    ? 'Prix décroissant'
                    : 'Prix'}
              </span>
            </span>
          </button>

          {/* Date de publication (Plus récents / Plus anciens) */}
          <button
            type="button"
            onClick={handleDateToggle}
            aria-pressed={isDateSort}
            title="Cliquer pour inverser l’ordre chronologique (récents / anciens)"
            className={`relative min-h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              isDateSort
                ? 'text-white'
                : 'text-[#123B63] bg-[#F2F7F9] hover:bg-[#E4EEF3]'
            }`}
          >
            {isDateSort && (
              <motion.span
                layoutId="cerim-active-sort-bg"
                transition={activePillTransition}
                className="absolute inset-0 rounded-lg bg-[#123B63]"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <Calendar
                className={`w-3.5 h-3.5 ${isDateSort ? 'text-[#36CBB9]' : 'text-[#0C7A6D]'}`}
                aria-hidden="true"
              />
              <span>
                {sort === 'recents'
                  ? 'Date · Plus récents'
                  : sort === 'anciens'
                    ? 'Date · Plus anciens'
                    : 'Date de publication'}
              </span>
            </span>
          </button>

          {/* Secondary attribute sorts (Chambres / Carburant) */}
          {(showApartmentSorts || showCarSorts) && (
            <div className="relative">
              <label htmlFor="f-sort-extra" className="sr-only">
                Autres tris par attribut
              </label>
              <select
                id="f-sort-extra"
                value={isExtraSort ? sort : ''}
                onChange={(e) => {
                  const val = e.target.value as SearchSortOption | '';
                  if (val) onChangeSort(val);
                }}
                className={`min-h-[38px] px-3 rounded-lg border text-xs font-semibold transition-colors focus:outline-none cursor-pointer ${
                  isExtraSort
                    ? 'bg-[#123B63] border-[#123B63] text-white'
                    : 'bg-[#F2F7F9] border-[#DBE6EC] text-[#123B63] hover:border-[#20B8A6]'
                }`}
              >
                <option value="">Autres critères…</option>
                {showApartmentSorts && (
                  <option value="chambres-desc">Chambres (décroissant)</option>
                )}
                {showApartmentSorts && (
                  <option value="chambres-asc">Chambres (croissant)</option>
                )}
                {showCarSorts && <option value="carburant">Type de carburant</option>}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Explicit sort direction quick shortcuts / active readout */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#5A7084] border-t lg:border-t-0 pt-2.5 lg:pt-0 border-[#DBE6EC]">
        <span className="whitespace-nowrap">
          Tri actif :{' '}
          <strong className="font-semibold text-[#123B63]">{SORT_LABELS[sort]}</strong>
        </span>
        {isPriceSort && (
          <button
            type="button"
            onClick={handlePriceToggle}
            className="text-xs font-semibold text-[#0C7A6D] hover:text-[#123B63] underline underline-offset-4 whitespace-nowrap"
          >
            {sort === 'prix-asc' ? 'Passer en décroissant' : 'Passer en croissant'}
          </button>
        )}
        {isDateSort && (
          <button
            type="button"
            onClick={handleDateToggle}
            className="text-xs font-semibold text-[#0C7A6D] hover:text-[#123B63] underline underline-offset-4 whitespace-nowrap"
          >
            {sort === 'recents' ? 'Voir les plus anciens' : 'Voir les plus récents'}
          </button>
        )}
      </div>
    </div>
  );
};
