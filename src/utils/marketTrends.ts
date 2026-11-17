import { Bien, BienType, BienVille } from '../types';

export interface MarketMonthPoint {
  monthKey: string;
  monthLabel: string;
  shortLabel: string;
  prixMoyen: number;
}

export interface NeighborhoodTrendSeries {
  id: string;
  quartier: string;
  ville: BienVille;
  type: BienType;
  color: string;
  dotClass: string;
  points: MarketMonthPoint[];
  currentAvg: number;
  changePct: number;
}

const MONTHS_6: Array<{ key: string; label: string; short: string }> = [
  { key: '2026-06', label: 'Juin 2026', short: 'Juin' },
  { key: '2026-07', label: 'Juillet 2026', short: 'Juil.' },
  { key: '2026-08', label: 'Août 2026', short: 'Août' },
  { key: '2026-09', label: 'Septembre 2026', short: 'Sept.' },
  { key: '2026-10', label: 'Octobre 2026', short: 'Oct.' },
  { key: '2026-11', label: 'Novembre 2026', short: 'Nov.' },
];

const SERIES_COLORS = ['#123B63', '#0C7A6D', '#D97706', '#4F46E5'];
const SERIES_DOT_CLASSES = [
  'bg-[#123B63]',
  'bg-[#0C7A6D]',
  'bg-[#D97706]',
  'bg-[#4F46E5]',
];

interface BaseNeighborhoodCurve {
  id: string;
  quartier: string;
  ville: BienVille;
  type: BienType;
  factors: [number, number, number, number, number, number];
  baselineNov: number;
}

const BASE_CURVES: BaseNeighborhoodCurve[] = [
  // Brazzaville — Appartements (FCFA / nuit)
  {
    id: 'bzv-apt-plateau',
    quartier: 'Centre-ville / Plateau',
    ville: 'Brazzaville',
    type: 'Appartement',
    factors: [0.92, 0.94, 0.96, 0.95, 0.98, 1.0],
    baselineNov: 55000,
  },
  {
    id: 'bzv-apt-bacongo',
    quartier: 'Bacongo / Corniche',
    ville: 'Brazzaville',
    type: 'Appartement',
    factors: [0.95, 0.96, 0.98, 0.99, 1.01, 1.0],
    baselineNov: 44000,
  },
  {
    id: 'bzv-apt-moungali',
    quartier: 'Moungali',
    ville: 'Brazzaville',
    type: 'Appartement',
    factors: [0.93, 0.94, 0.95, 0.97, 0.98, 1.0],
    baselineNov: 36000,
  },
  {
    id: 'bzv-apt-mpila',
    quartier: 'Mpila (équiv. nuit)',
    ville: 'Brazzaville',
    type: 'Appartement',
    factors: [0.96, 0.97, 0.97, 0.98, 0.99, 1.0],
    baselineNov: 22000,
  },

  // Pointe-Noire — Appartements (FCFA / nuit)
  {
    id: 'pnr-apt-centre',
    quartier: 'Centre-ville',
    ville: 'Pointe-Noire',
    type: 'Appartement',
    factors: [0.91, 0.93, 0.95, 0.97, 0.99, 1.0],
    baselineNov: 78000,
  },
  {
    id: 'pnr-apt-cote',
    quartier: 'Côte Sauvage',
    ville: 'Pointe-Noire',
    type: 'Appartement',
    factors: [0.93, 0.95, 0.98, 0.96, 0.98, 1.0],
    baselineNov: 65000,
  },
  {
    id: 'pnr-apt-loandjili',
    quartier: 'Loandjili',
    ville: 'Pointe-Noire',
    type: 'Appartement',
    factors: [0.94, 0.95, 0.96, 0.97, 0.99, 1.0],
    baselineNov: 42000,
  },

  // Brazzaville — Voitures (FCFA / jour)
  {
    id: 'bzv-car-bacongo',
    quartier: 'Bacongo / Centre-ville',
    ville: 'Brazzaville',
    type: 'Voiture',
    factors: [0.94, 0.96, 0.98, 0.97, 0.99, 1.0],
    baselineNov: 75000,
  },
  {
    id: 'bzv-car-plateau',
    quartier: 'Plateau / Maya-Maya',
    ville: 'Brazzaville',
    type: 'Voiture',
    factors: [0.95, 0.96, 0.99, 0.98, 1.0, 1.0],
    baselineNov: 62000,
  },
  {
    id: 'bzv-car-moungali',
    quartier: 'Moungali',
    ville: 'Brazzaville',
    type: 'Voiture',
    factors: [0.97, 0.98, 0.99, 0.98, 1.0, 1.0],
    baselineNov: 45000,
  },

  // Pointe-Noire — Voitures (FCFA / jour)
  {
    id: 'pnr-car-loandjili',
    quartier: 'Loandjili',
    ville: 'Pointe-Noire',
    type: 'Voiture',
    factors: [0.93, 0.95, 0.97, 0.98, 0.99, 1.0],
    baselineNov: 80000,
  },
  {
    id: 'pnr-car-cote',
    quartier: 'Côte Sauvage',
    ville: 'Pointe-Noire',
    type: 'Voiture',
    factors: [0.95, 0.96, 0.98, 0.97, 0.99, 1.0],
    baselineNov: 58000,
  },
  {
    id: 'pnr-car-centre',
    quartier: 'Centre-ville',
    ville: 'Pointe-Noire',
    type: 'Voiture',
    factors: [0.96, 0.97, 0.98, 0.99, 0.99, 1.0],
    baselineNov: 40000,
  },
];

function normalizeNightlyOrDailyPrice(bien: Bien): number {
  if (bien.periode === 'mois') {
    return Math.round(bien.prix / 30);
  }
  return bien.prix;
}

export function getNeighborhoodTrends(
  allBiens: Bien[],
  ville: BienVille,
  type: BienType
): NeighborhoodTrendSeries[] {
  const matchingCurves = BASE_CURVES.filter((c) => c.ville === ville && c.type === type);

  return matchingCurves.map((curve, idx) => {
    // Anchor November baseline to live catalog properties in the same neighborhood when present
    const matchingBiens = allBiens.filter(
      (b) =>
        b.ville === ville &&
        b.type === type &&
        b.quartier.toLowerCase().includes(curve.quartier.split(' ')[0].toLowerCase())
    );

    const liveNovAvg =
      matchingBiens.length > 0
        ? Math.round(
            matchingBiens.reduce((sum, b) => sum + normalizeNightlyOrDailyPrice(b), 0) /
              matchingBiens.length
          )
        : curve.baselineNov;

    // Blend gently for Mpila monthly studio vs nightly equivalent
    const anchor =
      curve.id === 'bzv-apt-mpila'
        ? Math.round((liveNovAvg + curve.baselineNov) / 2)
        : liveNovAvg;

    const points: MarketMonthPoint[] = MONTHS_6.map((m, mIdx) => ({
      monthKey: m.key,
      monthLabel: m.label,
      shortLabel: m.short,
      prixMoyen: Math.round((anchor * curve.factors[mIdx]) / 500) * 500,
    }));

    const first = points[0].prixMoyen;
    const last = points[points.length - 1].prixMoyen;
    const changePct = Number((((last - first) / first) * 100).toFixed(1));

    return {
      id: curve.id,
      quartier: curve.quartier,
      ville: curve.ville,
      type: curve.type,
      color: SERIES_COLORS[idx % SERIES_COLORS.length],
      dotClass: SERIES_DOT_CLASSES[idx % SERIES_DOT_CLASSES.length],
      points,
      currentAvg: last,
      changePct,
    };
  });
}
