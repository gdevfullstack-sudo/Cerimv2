import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, LayoutGrid, Map as MapIcon, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { BienType, BienVille, SearchFilters, SearchSortOption } from '../types';
import { filterAndSortBiens, formatFcfa, getTodayIso } from '../utils/dataHelpers';
import { PropertyCard } from '../components/PropertyCard';
import { SearchResultsSkeleton } from '../components/SearchResultsSkeleton';
import { SearchMapView } from '../components/SearchMapView';
import { SearchSortBar } from '../components/SearchSortBar';
import { buildSearchSeoConfig, usePageSeo } from '../utils/seo';

export const SearchPage: React.FC = () => {
  const { allBiens, catalogBlocks, reservations, route, favorites } = useApp();
  const prefersReducedMotion = useReducedMotion();

  const [filters, setFilters] = useState<SearchFilters>({
    type: route.filters?.type ?? 'Tous',
    ville: route.filters?.ville ?? 'Toutes',
    budgetMax: route.filters?.budgetMax ?? null,
    debut: route.filters?.debut ?? '',
    fin: route.filters?.fin ?? '',
    sort: 'recommandes',
    chambresMin: route.filters?.chambresMin ?? null,
    carburant: route.filters?.carburant ?? 'Tous',
    boite: route.filters?.boite ?? 'Toutes',
  });
  const [isUpdating, setIsUpdating] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const timerRef = useRef<number | null>(null);

  const triggerLoadingPulse = (duration = 280) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    setIsUpdating(true);
    timerRef.current = window.setTimeout(() => {
      setIsUpdating(false);
      timerRef.current = null;
    }, duration);
  };

  useEffect(() => {
    triggerLoadingPulse(280);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      type: route.filters?.type ?? prev.type,
      ville: route.filters?.ville ?? prev.ville,
      debut: route.filters?.debut ?? prev.debut,
      fin: route.filters?.fin ?? prev.fin,
      budgetMax: route.filters?.budgetMax !== undefined ? route.filters.budgetMax : prev.budgetMax,
    }));
    triggerLoadingPulse(280);
  }, [route.filters]);

  const applySort = (nextSort: SearchSortOption) => {
    setFilters((prev) => ({ ...prev, sort: nextSort }));
  };

  const applyPatch = (patch: Partial<SearchFilters>) => {
    triggerLoadingPulse(280);
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.type === 'Voiture') {
        next.chambresMin = null;
        if (next.sort === 'chambres-asc' || next.sort === 'chambres-desc') {
          next.sort = 'recommandes';
        }
      }
      if (patch.type === 'Appartement') {
        next.carburant = 'Tous';
        next.boite = 'Toutes';
        if (next.sort === 'carburant') {
          next.sort = 'recommandes';
        }
      }
      return next;
    });
  };

  const resetAll = () => {
    setOnlyFavorites(false);
    applyPatch({
      type: 'Tous',
      ville: 'Toutes',
      budgetMax: null,
      debut: '',
      fin: '',
      sort: 'recommandes',
      chambresMin: null,
      carburant: 'Tous',
      boite: 'Toutes',
    });
  };

  const results = useMemo(() => {
    const base = filterAndSortBiens(allBiens, filters, catalogBlocks, reservations);
    return onlyFavorites ? base.filter((b) => favorites.includes(b.matricule)) : base;
  }, [allBiens, filters, catalogBlocks, reservations, onlyFavorites, favorites]);

  const searchSeo = useMemo(() => buildSearchSeoConfig(filters, results), [filters, results]);
  usePageSeo(searchSeo);

  const activeFilterChips = useMemo(() => {
    const items: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (filters.type !== 'Tous') {
      items.push({
        key: 'type',
        label: filters.type,
        onRemove: () => applyPatch({ type: 'Tous' }),
      });
    }
    if (filters.ville !== 'Toutes') {
      items.push({
        key: 'ville',
        label: filters.ville,
        onRemove: () => applyPatch({ ville: 'Toutes' }),
      });
    }
    if (filters.budgetMax !== null && filters.budgetMax > 0) {
      items.push({
        key: 'budget',
        label: `Max ${formatFcfa(filters.budgetMax)}`,
        onRemove: () => applyPatch({ budgetMax: null }),
      });
    }
    if (filters.chambresMin) {
      items.push({
        key: 'chambres',
        label: `${filters.chambresMin}+ chambre${filters.chambresMin > 1 ? 's' : ''}`,
        onRemove: () => applyPatch({ chambresMin: null }),
      });
    }
    if (filters.carburant && filters.carburant !== 'Tous') {
      items.push({
        key: 'carburant',
        label: `Carburant : ${filters.carburant}`,
        onRemove: () => applyPatch({ carburant: 'Tous' }),
      });
    }
    if (filters.boite && filters.boite !== 'Toutes') {
      items.push({
        key: 'boite',
        label: `Boîte : ${filters.boite}`,
        onRemove: () => applyPatch({ boite: 'Toutes' }),
      });
    }
    return items;
  }, [filters]);

  const todayIso = getTodayIso();
  const showApartmentFilters = filters.type !== 'Voiture';
  const showCarFilters = filters.type !== 'Appartement';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-4xl font-semibold text-[#123B63] tracking-tight">
          Rechercher un bien à louer
        </h1>
        <p className="text-sm sm:text-base text-[#5A7084]">
          Affinez votre recherche par budget, dates, nombre de chambres ou type de carburant : seuls
          les biens disponibles sur toute la période s’affichent.
        </p>
      </div>

      {/* Filters Panel */}
      <section
        aria-label="Filtres de recherche"
        className="bg-white rounded-xl border border-[#DBE6EC] p-4 sm:p-6 space-y-5"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-[#123B63]">
            <SlidersHorizontal className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
            <span>Critères et tri</span>
          </h2>
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0C7A6D] hover:text-[#123B63] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Réinitialiser</span>
          </button>
        </div>

        {/* Primary Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label htmlFor="f-type" className="block text-xs font-semibold text-[#123B63]">
              Catégorie
            </label>
            <select
              id="f-type"
              value={filters.type}
              onChange={(e) => applyPatch({ type: e.target.value as 'Tous' | BienType })}
              className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
            >
              <option value="Tous">Tous</option>
              <option value="Appartement">Appartement</option>
              <option value="Voiture">Voiture</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="f-ville" className="block text-xs font-semibold text-[#123B63]">
              Ville
            </label>
            <select
              id="f-ville"
              value={filters.ville}
              onChange={(e) => applyPatch({ ville: e.target.value as 'Toutes' | BienVille })}
              className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
            >
              <option value="Toutes">Toutes</option>
              <option value="Brazzaville">Brazzaville</option>
              <option value="Pointe-Noire">Pointe-Noire</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="f-budget" className="block text-xs font-semibold text-[#123B63]">
              Budget max (FCFA)
            </label>
            <input
              id="f-budget"
              type="number"
              min={0}
              step={5000}
              placeholder="Ex: 80000"
              value={filters.budgetMax ?? ''}
              onChange={(e) =>
                applyPatch({
                  budgetMax: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm text-[#0F2233] tabular-nums focus:border-[#20B8A6] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="f-debut" className="block text-xs font-semibold text-[#123B63]">
              Du
            </label>
            <input
              id="f-debut"
              type="date"
              min={todayIso}
              value={filters.debut}
              onChange={(e) => {
                const val = e.target.value;
                applyPatch({
                  debut: val,
                  fin: filters.fin && val > filters.fin ? '' : filters.fin,
                });
              }}
              className="w-full min-h-[44px] px-2.5 rounded-lg border border-[#DBE6EC] bg-white text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="f-fin" className="block text-xs font-semibold text-[#123B63]">
              Au
            </label>
            <input
              id="f-fin"
              type="date"
              min={filters.debut || todayIso}
              value={filters.fin}
              onChange={(e) => applyPatch({ fin: e.target.value })}
              className="w-full min-h-[44px] px-2.5 rounded-lg border border-[#DBE6EC] bg-white text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
            />
          </div>
        </div>

        {/* Granular Attribute Filters */}
        <div className="pt-4 border-t border-[#DBE6EC] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {showApartmentFilters && (
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-[#123B63]">
                Nombre de chambres (Appartements)
              </span>
              <div
                role="group"
                aria-label="Filtrer par nombre de chambres"
                className="grid grid-cols-4 gap-1 p-1 bg-[#F2F7F9] rounded-lg border border-[#DBE6EC]"
              >
                {[
                  { label: 'Tous', val: null },
                  { label: '1+', val: 1 },
                  { label: '2+', val: 2 },
                  { label: '3+', val: 3 },
                ].map((opt) => {
                  const active = (filters.chambresMin ?? null) === opt.val;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => applyPatch({ chambresMin: opt.val })}
                      aria-pressed={active}
                      className={`min-h-[36px] rounded-md text-xs font-semibold tabular-nums transition-colors ${
                        active
                          ? 'bg-[#123B63] text-white'
                          : 'text-[#5A7084] hover:text-[#123B63]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showCarFilters && (
            <div className="space-y-1.5">
              <label htmlFor="f-carburant" className="block text-xs font-semibold text-[#123B63]">
                Type de carburant (Voitures)
              </label>
              <select
                id="f-carburant"
                value={filters.carburant ?? 'Tous'}
                onChange={(e) =>
                  applyPatch({
                    carburant: e.target.value as SearchFilters['carburant'],
                  })
                }
                className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
              >
                <option value="Tous">Tous les carburants</option>
                <option value="Essence">Essence</option>
                <option value="Diesel">Diesel</option>
                <option value="Hybride">Hybride</option>
              </select>
            </div>
          )}

          {showCarFilters && (
            <div className="space-y-1.5">
              <label htmlFor="f-boite" className="block text-xs font-semibold text-[#123B63]">
                Boîte de vitesses (Voitures)
              </label>
              <select
                id="f-boite"
                value={filters.boite ?? 'Toutes'}
                onChange={(e) =>
                  applyPatch({
                    boite: e.target.value as SearchFilters['boite'],
                  })
                }
                className="w-full min-h-[44px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
              >
                <option value="Toutes">Toutes les boîtes</option>
                <option value="Automatique">Automatique</option>
                <option value="Manuelle">Manuelle</option>
              </select>
            </div>
          )}

          {/* Quick Budget Presets */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-[#123B63]">
              Plafonds rapides
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[50000, 75000, 100000].map((cap) => {
                const active = filters.budgetMax === cap;
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => applyPatch({ budgetMax: active ? null : cap })}
                    aria-pressed={active}
                    className={`min-h-[38px] px-2.5 rounded-lg border text-xs font-semibold tabular-nums transition-colors ${
                      active
                        ? 'bg-[#20B8A6] border-[#20B8A6] text-[#123B63]'
                        : 'bg-[#F2F7F9] border-[#DBE6EC] text-[#123B63] hover:border-[#20B8A6]'
                    }`}
                  >
                    ≤ {(cap / 1000).toFixed(0)}k
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Results Header, Active Filter Removers & View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {isUpdating ? (
            <div
              aria-hidden="true"
              className="h-5 w-36 rounded cerim-skeleton"
            />
          ) : (
            <p className="text-sm font-medium text-[#5A7084] tabular-nums">
              {results.length} bien{results.length > 1 ? 's' : ''} disponible
              {results.length > 1 ? 's' : ''}
            </p>
          )}

          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-md bg-white border border-[#DBE6EC] hover:border-[#123B63] text-xs font-medium text-[#123B63] transition-colors"
                >
                  <span>{chip.label}</span>
                  <X className="w-3.5 h-3.5 text-[#5A7084]" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              triggerLoadingPulse(220);
              setOnlyFavorites((v) => !v);
            }}
            aria-pressed={onlyFavorites}
            className={`min-h-[42px] inline-flex items-center gap-1.5 px-3.5 rounded-lg border text-xs font-semibold transition-colors ${
              onlyFavorites
                ? 'bg-[#20B8A6] border-[#20B8A6] text-[#123B63]'
                : 'bg-white border-[#DBE6EC] text-[#123B63] hover:border-[#20B8A6]'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-current' : ''}`} aria-hidden="true" />
            <span className="tabular-nums">Favoris ({favorites.length})</span>
          </button>

          <div
            role="group"
            aria-label="Mode d’affichage des résultats"
            className="inline-flex items-center gap-1 p-1 bg-white rounded-lg border border-[#DBE6EC]"
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#123B63] text-white'
                  : 'text-[#5A7084] hover:text-[#123B63]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Grille</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              aria-pressed={viewMode === 'map'}
              className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'map'
                  ? 'bg-[#123B63] text-white'
                  : 'text-[#5A7084] hover:text-[#123B63]'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Carte</span>
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Sort Interface */}
      <SearchSortBar
        sort={filters.sort}
        onChangeSort={applySort}
        showApartmentSorts={showApartmentFilters}
        showCarSorts={showCarFilters}
      />

      {/* Results Grid / Map */}
      {isUpdating ? (
        <SearchResultsSkeleton
          count={Math.min(6, Math.max(3, results.length || 6))}
          viewMode={viewMode}
        />
      ) : results.length > 0 ? (
        viewMode === 'map' ? (
          <SearchMapView biens={results} cityFilter={filters.ville} />
        ) : (
          <LayoutGroup id="cerim-search-results">
            <motion.div
              layout={!prefersReducedMotion}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {results.map((bien) => (
                  <motion.div
                    key={bien.matricule}
                    layout={!prefersReducedMotion}
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : {
                            layout: { type: 'spring', stiffness: 360, damping: 32 },
                            opacity: { duration: 0.2 },
                            scale: { duration: 0.2 },
                          }
                    }
                    className="h-full"
                  >
                    <PropertyCard bien={bien} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>
        )
      ) : (
        <div className="bg-white rounded-xl border border-[#DBE6EC] p-8 text-center space-y-4">
          <h3 className="text-lg font-semibold text-[#123B63]">
            Aucun bien disponible sur ces critères
          </h3>
          <p className="text-sm text-[#5A7084] max-w-md mx-auto">
            Certains biens sont peut-être réservés aux dates sélectionnées ou ne correspondent pas
            aux critères détaillés choisis.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {filters.budgetMax !== null && (
              <button
                type="button"
                onClick={() => applyPatch({ budgetMax: null })}
                className="min-h-[44px] px-4 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold transition-colors"
              >
                Retirer le budget max
              </button>
            )}
            {filters.chambresMin && (
              <button
                type="button"
                onClick={() => applyPatch({ chambresMin: null })}
                className="min-h-[44px] px-4 rounded-lg border border-[#123B63] text-[#123B63] text-sm font-semibold hover:bg-[#F2F7F9] transition-colors"
              >
                Retirer le filtre chambres
              </button>
            )}
            {filters.carburant && filters.carburant !== 'Tous' && (
              <button
                type="button"
                onClick={() => applyPatch({ carburant: 'Tous' })}
                className="min-h-[44px] px-4 rounded-lg border border-[#123B63] text-[#123B63] text-sm font-semibold hover:bg-[#F2F7F9] transition-colors"
              >
                Tous les carburants
              </button>
            )}
            {(filters.debut || filters.fin) && (
              <button
                type="button"
                onClick={() => applyPatch({ debut: '', fin: '' })}
                className="min-h-[44px] px-4 rounded-lg border border-[#123B63] text-[#123B63] text-sm font-semibold hover:bg-[#F2F7F9] transition-colors"
              >
                Effacer les dates
              </button>
            )}
            <button
              type="button"
              onClick={resetAll}
              className="min-h-[44px] px-4 rounded-lg border border-[#DBE6EC] text-[#5A7084] text-sm font-medium hover:text-[#123B63]"
            >
              Tout réinitialiser
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
