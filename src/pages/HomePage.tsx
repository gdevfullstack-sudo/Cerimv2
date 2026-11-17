import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  CalendarCheck,
  Car,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BienType, BienVille } from '../types';
import { FallbackImage } from '../components/BrandMark';
import { PropertyCard, PropertyCardSkeleton } from '../components/PropertyCard';
import { MarketPriceChart } from '../components/MarketPriceChart';
import { animateCardsScroll, animateHeroSequence } from '../utils/animations';
import { getTodayIso } from '../utils/dataHelpers';
import { buildHomeSeoConfig, usePageSeo } from '../utils/seo';

export const HomePage: React.FC = () => {
  const { allBiens, navigate, setChatbotOpen } = useApp();

  const homeSeo = useMemo(() => buildHomeSeoConfig(allBiens), [allBiens]);
  usePageSeo(homeSeo);

  // Search bar state
  const [searchType, setSearchType] = useState<'Tous' | BienType>('Appartement');
  const [searchVille, setSearchVille] = useState<'Toutes' | BienVille>('Toutes');
  const [searchDebut, setSearchDebut] = useState('');
  const [searchFin, setSearchFin] = useState('');

  // Grid tabs
  const [activeTab, setActiveTab] = useState<'Tous' | BienType>('Tous');
  const [isSwitching, setIsSwitching] = useState(false);

  const heroBgRef = useRef<HTMLDivElement | null>(null);
  const heroTitleRef = useRef<HTMLDivElement | null>(null);
  const heroSearchRef = useRef<HTMLFormElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const cleanHero = animateHeroSequence(
      heroBgRef.current,
      heroTitleRef.current,
      heroSearchRef.current
    );
    const cleanCards = animateCardsScroll(gridRef.current);
    return () => {
      cleanHero?.();
      cleanCards?.();
    };
  }, []);

  const aptCount = useMemo(
    () => allBiens.filter((b) => b.type === 'Appartement').length,
    [allBiens]
  );
  const carCount = useMemo(
    () => allBiens.filter((b) => b.type === 'Voiture').length,
    [allBiens]
  );

  const displayedBiens = useMemo(() => {
    const base =
      activeTab === 'Tous' ? allBiens : allBiens.filter((b) => b.type === activeTab);
    return base.slice(0, 6);
  }, [allBiens, activeTab]);

  const handleTabChange = (tab: 'Tous' | BienType) => {
    if (tab === activeTab) return;
    setIsSwitching(true);
    setActiveTab(tab);
    window.setTimeout(() => setIsSwitching(false), 160);
  };

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      page: 'recherche',
      filters: {
        type: searchType,
        ville: searchVille,
        debut: searchDebut,
        fin: searchFin,
      },
    });
  };

  const todayIso = getTodayIso();

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Full-Bleed Airy Hero + Overlapping Search Pill */}
      <section className="relative w-full">
        <div
          id="cerim-hero-section"
          className="relative w-full overflow-hidden min-h-[340px] sm:min-h-[500px] lg:min-h-[660px] flex items-center bg-[#0B2A47]"
        >
          <div className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden">
            <div ref={heroBgRef} className="w-full h-full will-change-transform">
              <FallbackImage
                src="/src/assets/images/hero_brazza_terrace_1794704003927.jpg"
                alt="Terrasse d’appartement moderne donnant sur le fleuve à Brazzaville"
                type="Appartement"
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="absolute inset-0 bg-[#0B2A47]/45" aria-hidden="true" />
          </div>

          <div className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-6 pt-20 pb-12 sm:pt-28 sm:pb-20 lg:pt-32 lg:pb-28">
            <div ref={heroTitleRef} className="max-w-2xl space-y-3.5 sm:space-y-5">
              <p className="cerim-hero-item text-[11px] sm:text-sm font-semibold uppercase tracking-[0.12em] sm:tracking-[0.14em] text-[#36CBB9] leading-snug drop-shadow-xs">
                Brazzaville &amp; Pointe-Noire · Paiement sur place
              </p>

              <h1 className="cerim-hero-item text-white font-semibold tracking-tight leading-[1.14] sm:leading-[1.07] text-[clamp(1.65rem,5.2vw,3.75rem)] [text-wrap:balance] drop-shadow-sm">
                Votre appartement ou voiture au Congo,{' '}
                <span className="text-[#36CBB9]">réservé avec CERIM au juste prix.</span>
              </h1>

              <p className="cerim-hero-item text-sm sm:text-lg text-white/95 max-w-xl leading-[1.55] sm:leading-relaxed drop-shadow-xs">
                Réservation sans paiement en ligne : vous payez à votre arrivée. Notre équipe reste
                votre interlocuteur unique de la demande au départ.
              </p>

              <div className="cerim-hero-item flex flex-wrap items-center gap-x-3.5 sm:gap-x-5 gap-y-1.5 pt-0.5 sm:pt-1 text-xs sm:text-sm font-medium sm:font-semibold text-white/95">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#36CBB9]" aria-hidden="true" />
                  <span>Biens vérifiés</span>
                </span>
                <span className="text-white/40" aria-hidden="true">
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#36CBB9]" aria-hidden="true" />
                  <span>Tarifs transparents FCFA</span>
                </span>
                <span className="text-white/40" aria-hidden="true">
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#36CBB9]" aria-hidden="true" />
                  <span>Paiement à l&apos;arrivée</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Elevated Search Pill overlapping Hero bottom edge */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-6 sm:-mt-8 lg:-mt-10 relative z-20">
          <form
            ref={heroSearchRef}
            onSubmit={handleHeroSearch}
            className="bg-white rounded-2xl lg:rounded-full p-3.5 sm:p-4 lg:px-5 lg:py-3 shadow-[0_20px_50px_-12px_rgba(18,59,99,0.16)] border border-[#DBE6EC] grid grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 lg:gap-0 items-center lg:divide-x lg:divide-[#DBE6EC]"
          >
            {/* Category */}
            <div className="col-span-1 lg:col-span-3 lg:pr-4 flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#20B8A6]/15 text-[#0C7A6D] hidden sm:flex items-center justify-center shrink-0">
                {searchType === 'Voiture' ? (
                  <Car className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Building2 className="w-4 h-4" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <label htmlFor="hero-type" className="block text-[11px] font-semibold text-[#5A7084]">
                  Catégorie
                </label>
                <select
                  id="hero-type"
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as 'Tous' | BienType)}
                  className="w-full min-h-[36px] bg-transparent text-[13px] sm:text-sm font-semibold text-[#123B63] focus:outline-none cursor-pointer py-0.5 truncate"
                >
                  <option value="Appartement">Appartement</option>
                  <option value="Voiture">Voiture</option>
                  <option value="Tous">Tous les biens</option>
                </select>
              </div>
            </div>

            {/* City */}
            <div className="col-span-1 lg:col-span-3 lg:px-4 flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#20B8A6]/15 text-[#0C7A6D] hidden sm:flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <label htmlFor="hero-ville" className="block text-[11px] font-semibold text-[#5A7084]">
                  Localisation
                </label>
                <select
                  id="hero-ville"
                  value={searchVille}
                  onChange={(e) => setSearchVille(e.target.value as 'Toutes' | BienVille)}
                  className="w-full min-h-[36px] bg-transparent text-[13px] sm:text-sm font-semibold text-[#123B63] focus:outline-none cursor-pointer py-0.5 truncate"
                >
                  <option value="Toutes">Brazzaville &amp; Pointe-Noire</option>
                  <option value="Brazzaville">Brazzaville</option>
                  <option value="Pointe-Noire">Pointe-Noire</option>
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="col-span-2 lg:col-span-4 lg:px-4 flex items-center gap-2.5 sm:gap-3 min-w-0 pt-1 sm:pt-0 border-t border-[#DBE6EC]/70 sm:border-t-0">
              <div className="w-9 h-9 rounded-full bg-[#20B8A6]/15 text-[#0C7A6D] hidden sm:flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-2 gap-2 flex-1">
                <div>
                  <label htmlFor="hero-debut" className="block text-[11px] font-semibold text-[#5A7084]">
                    Du
                  </label>
                  <input
                    id="hero-debut"
                    type="date"
                    min={todayIso}
                    value={searchDebut}
                    onChange={(e) => {
                      setSearchDebut(e.target.value);
                      if (searchFin && e.target.value > searchFin) setSearchFin('');
                    }}
                    className="w-full min-h-[36px] bg-transparent text-xs sm:text-sm font-medium text-[#123B63] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="hero-fin" className="block text-[11px] font-semibold text-[#5A7084]">
                    Au
                  </label>
                  <input
                    id="hero-fin"
                    type="date"
                    min={searchDebut || todayIso}
                    value={searchFin}
                    onChange={(e) => setSearchFin(e.target.value)}
                    className="w-full min-h-[36px] bg-transparent text-xs sm:text-sm font-medium text-[#123B63] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="col-span-2 lg:col-span-2 lg:pl-4">
              <button
                type="submit"
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 rounded-xl lg:rounded-full bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold transition-colors whitespace-nowrap shadow-sm"
              >
                <Search className="w-4 h-4" aria-hidden="true" />
                <span>Rechercher</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Airy 4-Column Medallion Reassurance Strip */}
      <section aria-label="Engagements CERIM" className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 text-center">
          <div className="space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-[#20B8A6]/15 text-[#0C7A6D] flex items-center justify-center mx-auto">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-[#123B63]">
              Paiement sur place
            </h2>
            <p className="text-xs sm:text-sm text-[#5A7084] max-w-[230px] mx-auto leading-relaxed">
              Réservation sans paiement en ligne : vous réglez le tarif affiché à votre arrivée.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-[#20B8A6]/15 text-[#0C7A6D] flex items-center justify-center mx-auto">
              <CalendarCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-[#123B63]">
              Disponibilités en temps réel
            </h2>
            <p className="text-xs sm:text-sm text-[#5A7084] max-w-[230px] mx-auto leading-relaxed">
              Consultez les dates libres sur chaque bien et suivez l&apos;avancement en direct.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-[#20B8A6]/15 text-[#0C7A6D] flex items-center justify-center mx-auto">
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-[#123B63]">
              Interlocuteur unique CERIM
            </h2>
            <p className="text-xs sm:text-sm text-[#5A7084] max-w-[230px] mx-auto leading-relaxed">
              Notre équipe coordonne votre confirmation, l&apos;accès et la remise des clés.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setChatbotOpen(true)}
            className="space-y-2.5 group text-center focus-visible:outline-none"
          >
            <div className="w-12 h-12 rounded-full bg-[#20B8A6]/15 group-hover:bg-[#20B8A6]/30 text-[#0C7A6D] flex items-center justify-center mx-auto transition-colors">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-[#123B63] group-hover:text-[#0C7A6D] transition-colors">
              Assistant CERIM
            </h2>
            <p className="text-xs sm:text-sm text-[#5A7084] max-w-[230px] mx-auto leading-relaxed">
              Indiquez ville, budget et dates pour trouver nos biens adaptés en 30 secondes.
            </p>
          </button>
        </div>
      </section>

      {/* Featured Listings Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0C7A6D] mb-1">
              Nos biens gérés par CERIM · Tarifs transparents
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#123B63] tracking-tight">
              Les biens prêts à réserver dès aujourd’hui
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="tablist"
              aria-label="Filtrer par type de bien"
              className="inline-flex items-center gap-1 p-1 bg-white rounded-lg border border-[#DBE6EC]"
            >
              {(['Tous', 'Appartement', 'Voiture'] as const).map((tab) => {
                const label =
                  tab === 'Tous' ? 'Tous' : tab === 'Appartement' ? 'Appartements' : 'Voitures';
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleTabChange(tab)}
                    className={`min-h-[38px] px-3.5 rounded-md text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#123B63] text-white'
                        : 'text-[#5A7084] hover:text-[#123B63]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => navigate({ page: 'recherche', filters: { type: activeTab } })}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#123B63] hover:text-[#0C7A6D] transition-colors whitespace-nowrap min-h-[40px]"
            >
              <span>Tout voir</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isSwitching
            ? Array.from({ length: 3 }).map((_, i) => <PropertyCardSkeleton key={i} />)
            : displayedBiens.map((bien) => <PropertyCard key={bien.matricule} bien={bien} />)}
        </div>
      </section>

      {/* Two Category Cards */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#123B63] tracking-tight">
            Deux univers pensés pour votre confort et votre mobilité
          </h2>
          <p className="text-sm sm:text-base text-[#5A7084] mt-1">
            Des logements meublés prêts à vivre et des véhicules fiables contrôlés pour vos séjours
            d’affaires ou privés.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            type="button"
            onClick={() => navigate({ page: 'recherche', filters: { type: 'Appartement' } })}
            className="group relative rounded-2xl overflow-hidden bg-white border border-[#DBE6EC] text-left shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col"
          >
            <div className="aspect-[16/10] w-full overflow-hidden bg-[#F2F7F9]">
              <FallbackImage
                src="/src/assets/images/apt_brazza_salon_1794704004033.jpg"
                alt="Appartements meublés à Brazzaville et Pointe-Noire"
                type="Appartement"
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
            </div>
            <div className="p-6 bg-[#0B2A47] text-white flex items-center justify-between gap-4 flex-1">
              <div>
                <p className="text-xs font-medium text-[#36CBB9] tabular-nums">
                  {aptCount} annonce{aptCount > 1 ? 's' : ''} disponible{aptCount > 1 ? 's' : ''}
                </p>
                <h3 className="text-2xl font-semibold mt-0.5 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#20B8A6]" aria-hidden="true" />
                  <span>Appartements meublés</span>
                </h3>
                <p className="text-sm text-white/85 mt-1">
                  Studios cosy, résidences sécurisées et suites équipées gérés par CERIM.
                </p>
              </div>
              <span className="min-w-[44px] min-h-[44px] rounded-lg bg-[#20B8A6] text-[#123B63] inline-flex items-center justify-center shrink-0 group-hover:bg-[#36CBB9] transition-colors">
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate({ page: 'recherche', filters: { type: 'Voiture' } })}
            className="group relative rounded-2xl overflow-hidden bg-white border border-[#DBE6EC] text-left shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col"
          >
            <div className="aspect-[16/10] w-full overflow-hidden bg-[#F2F7F9]">
              <FallbackImage
                src="/src/assets/images/car_suv_executive_1794704004462.jpg"
                alt="Voitures et SUV 4x4 à louer à Brazzaville et Pointe-Noire"
                type="Voiture"
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
            </div>
            <div className="p-6 bg-[#0B2A47] text-white flex items-center justify-between gap-4 flex-1">
              <div>
                <p className="text-xs font-medium text-[#36CBB9] tabular-nums">
                  {carCount} véhicule{carCount > 1 ? 's' : ''} disponible{carCount > 1 ? 's' : ''}
                </p>
                <h3 className="text-2xl font-semibold mt-0.5 flex items-center gap-2">
                  <Car className="w-5 h-5 text-[#20B8A6]" aria-hidden="true" />
                  <span>Voitures &amp; 4x4</span>
                </h3>
                <p className="text-sm text-white/85 mt-1">
                  Berlines urbaines et 4x4 climatisés prêts à prendre la route en toute sérénité.
                </p>
              </div>
              <span className="min-w-[44px] min-h-[44px] rounded-lg bg-[#20B8A6] text-[#123B63] inline-flex items-center justify-center shrink-0 group-hover:bg-[#36CBB9] transition-colors">
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Market Price Trends by Neighborhood */}
      <section
        aria-label="Observatoire des prix moyens par quartier"
        className="max-w-6xl mx-auto px-4 sm:px-6"
      >
        <MarketPriceChart />
      </section>

      {/* Pourquoi l'hirondelle ? — Editorial Split */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 rounded-2xl overflow-hidden shadow-md bg-white border border-[#DBE6EC] aspect-[4/3]">
            <FallbackImage
              src="/src/assets/images/hirondelle_flight_1794704004314.jpg"
              alt="Hirondelle en plein vol symbolisant la liberté et l’agilité de CERIM"
              type="Appartement"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="lg:col-span-6 space-y-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0C7A6D]">
              La signature CERIM
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#123B63] tracking-tight">
              Réservez librement, payez uniquement sur place.
            </h2>
            <p className="text-sm sm:text-base text-[#0F2233] leading-relaxed">
              À l’image de l’hirondelle, CERIM simplifie votre séjour à Brazzaville et Pointe-Noire.
              Notre équipe vérifie chaque bien, coordonne la disponibilité et reste votre
              interlocuteur unique du début à la fin.
            </p>
            <p className="text-sm sm:text-base text-[#5A7084] leading-relaxed">
              Aucune avance en ligne n’est demandée : vous réglez directement sur place lors de
              votre arrivée, après contrôle et remise des clés.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#DBE6EC]">
              <div>
                <p className="text-xl font-semibold text-[#123B63]">Sur place</p>
                <p className="text-xs text-[#5A7084]">Paiement à l&apos;arrivée</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-[#123B63] tabular-nums">
                  {allBiens.length}
                </p>
                <p className="text-xs text-[#5A7084]">Nos biens actifs</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-[#123B63] tabular-nums">2</p>
                <p className="text-xs text-[#5A7084]">Villes couvertes</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-[#123B63]">1 équipe</p>
                <p className="text-xs text-[#5A7084]">Suivi unique CERIM</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deep Navy Closing CTA Banner */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl overflow-hidden bg-[#0B2A47] text-white grid grid-cols-1 md:grid-cols-12 items-stretch">
          <div className="md:col-span-7 p-8 sm:p-10 lg:p-12 space-y-4 flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#36CBB9]">
              Brazzaville &amp; Pointe-Noire · Accompagnement CERIM
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-snug">
              Réservez en ligne sans avance et suivez votre dossier en temps réel.
            </h2>
            <p className="text-sm sm:text-base text-white/85 leading-relaxed">
              Parcourez nos appartements et véhicules disponibles ou accédez à votre suivi de
              réservation avec votre code CERIM.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate({ page: 'recherche' })}
                className="min-h-[46px] px-6 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold transition-colors whitespace-nowrap"
              >
                Découvrir nos biens disponibles
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'suivi' })}
                className="min-h-[46px] px-6 rounded-lg border border-white/30 hover:bg-white/10 text-white text-sm font-semibold transition-colors whitespace-nowrap"
              >
                Suivre une réservation
              </button>
            </div>
          </div>
          <div className="hidden md:block md:col-span-5 min-h-[260px]">
            <FallbackImage
              src="/src/assets/images/apt_pointenoire_suite_1794704004153.jpg"
              alt="Suite meublée à Pointe-Noire"
              type="Appartement"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
