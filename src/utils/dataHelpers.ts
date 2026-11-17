import {
  Bien,
  BienPeriode,
  BienType,
  Reservation,
  SearchFilters,
  StatutReservation,
} from '../types';
import { CERIM_WHATSAPP } from '../data/biens';

export const ARRIVAL_SLOTS = [
  '09h–11h',
  '11h–13h',
  '13h–15h',
  '15h–17h',
  '17h–19h',
  '19h–21h',
] as const;

export const ACTIVE_BLOCKING_STATUSES: ReadonlySet<StatutReservation> = new Set([
  'en_attente_client',
  'demandee',
  'confirmee',
  'bien_pret',
  'arrivee',
]);

export const STATUT_LABELS: Record<StatutReservation, string> = {
  en_attente_client: 'En attente de votre confirmation (OUI)',
  demandee: 'Confirmée par le client · En attente équipe',
  confirmee: 'Réservation confirmée',
  bien_pret: 'Bien prêt pour votre arrivée',
  arrivee: 'Arrivée enregistrée (Check-in)',
  terminee: 'Séjour terminé',
  annulee: 'Annulée',
  refusee: 'Indisponible (refusée)',
  no_show: 'Absence constatée (no-show)',
};

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

export function diffDays(debutIso: string, finIso: string): number {
  const [y1, m1, d1] = debutIso.split('-').map(Number);
  const [y2, m2, d2] = finIso.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

export function formatIsoFr(isoDate: string): string {
  if (!isoDate) return '';
  const clean = isoDate.slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTimeFr(isoString: string): string {
  if (!isoString) return '';
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return isoString;
  return dt.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFcfa(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

export function validateInternationalPhone(phone: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const trimmed = phone.trim();
  if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) {
    return {
      valid: false,
      normalized: '',
      error: 'Saisissez le numéro au format international (ex. +242 06 600 00 00).',
    };
  }
  const digits = normalizePhoneDigits(trimmed.startsWith('00') ? trimmed.slice(2) : trimmed);
  if (digits.length < 8 || digits.length > 15) {
    return {
      valid: false,
      normalized: '',
      error: 'Le numéro international doit contenir entre 8 et 15 chiffres.',
    };
  }
  return {
    valid: true,
    normalized: `+${digits}`,
  };
}

export function getPhoneLast4(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  return digits.slice(-4);
}

export function hoursUntilArrival(debutIso: string): number {
  const [y, m, d] = debutIso.split('-').map(Number);
  const arrivalMs = new Date(y, m - 1, d, 12, 0, 0).getTime();
  return (arrivalMs - Date.now()) / 3600000;
}

export function getNextMatricule(type: BienType | string, biens: Bien[]): string {
  if (type !== 'Appartement' && type !== 'Voiture') {
    throw new Error(
      `Type hors périmètre CERIM : "${type}". Seuls "Appartement" et "Voiture" sont autorisés.`
    );
  }
  const prefix = type === 'Appartement' ? 'AP' : 'VO';
  let maxNum = 0;
  for (const b of biens) {
    if (b.matricule.startsWith(prefix)) {
      const n = parseInt(b.matricule.slice(prefix.length), 10);
      if (!Number.isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  return `${prefix}${maxNum + 1}`;
}

export function getOccupiedDatesSet(
  bien: Bien,
  extraBlocked: string[] = [],
  activeReservations: Reservation[] = []
): Set<string> {
  const occupied = new Set<string>();
  const allRanges = [
    ...bien.reservations,
    ...activeReservations
      .filter((r) => r.matricule === bien.matricule && ACTIVE_BLOCKING_STATUSES.has(r.statut))
      .map((r) => ({ debut: r.debut, fin: r.fin })),
  ];

  for (const r of allRanges) {
    let curr = r.debut;
    let safety = 0;
    while (curr <= r.fin && safety < 730) {
      occupied.add(curr);
      curr = addDaysIso(curr, 1);
      safety++;
    }
  }
  for (const d of bien.bloques) {
    occupied.add(d);
  }
  for (const d of extraBlocked) {
    occupied.add(d);
  }
  return occupied;
}

export function isDateOccupied(
  bien: Bien,
  isoDate: string,
  extraBlocked: string[] = [],
  activeReservations: Reservation[] = []
): boolean {
  return getOccupiedDatesSet(bien, extraBlocked, activeReservations).has(isoDate);
}

export function isRangeAvailable(
  bien: Bien,
  debut: string,
  fin: string,
  extraBlocked: string[] = [],
  activeReservations: Reservation[] = []
): boolean {
  if (!debut || !fin || debut > fin) return false;
  const occupied = getOccupiedDatesSet(bien, extraBlocked, activeReservations);
  let curr = debut;
  let safety = 0;
  while (curr <= fin && safety < 730) {
    if (occupied.has(curr)) return false;
    curr = addDaysIso(curr, 1);
    safety++;
  }
  return true;
}

export function isAvailableToday(
  bien: Bien,
  extraBlocked: string[] = [],
  activeReservations: Reservation[] = []
): boolean {
  return !isDateOccupied(bien, getTodayIso(), extraBlocked, activeReservations);
}

export function computeEstimate(
  prix: number,
  periode: BienPeriode,
  debut: string,
  fin: string
): { units: number; dureeLabel: string; total: number } {
  const spanDays = Math.max(0, diffDays(debut, fin));
  if (periode === 'nuit') {
    const nights = Math.max(1, spanDays);
    return {
      units: nights,
      dureeLabel: `${nights} nuit${nights > 1 ? 's' : ''}`,
      total: nights * prix,
    };
  }
  if (periode === 'jour') {
    const days = spanDays + 1;
    return {
      units: days,
      dureeLabel: `${days} jour${days > 1 ? 's' : ''}`,
      total: days * prix,
    };
  }
  const days = spanDays + 1;
  const monthsRatio = Math.max(days / 30, 1 / 30);
  const total = Math.round(monthsRatio * prix);
  return {
    units: days,
    dureeLabel: `${days} jour${days > 1 ? 's' : ''} (tarif mensuel)`,
    total,
  };
}

export function filterAndSortBiens(
  biens: Bien[],
  filters: SearchFilters,
  blockedMap: Record<string, string[]>,
  activeReservations: Reservation[] = []
): Bien[] {
  const filtered = biens.filter((bien) => {
    if (filters.type !== 'Tous' && bien.type !== filters.type) return false;
    if (filters.ville !== 'Toutes' && bien.ville !== filters.ville) return false;
    if (filters.budgetMax !== null && filters.budgetMax > 0 && bien.prix > filters.budgetMax) {
      return false;
    }
    if (filters.chambresMin && filters.chambresMin > 0) {
      if (bien.type !== 'Appartement' || bien.chambres < filters.chambresMin) return false;
    }
    if (filters.carburant && filters.carburant !== 'Tous') {
      if (bien.type !== 'Voiture' || bien.carburant !== filters.carburant) return false;
    }
    if (filters.boite && filters.boite !== 'Toutes') {
      if (bien.type !== 'Voiture' || bien.boite !== filters.boite) return false;
    }
    if (filters.debut && filters.fin) {
      const extra = blockedMap[bien.matricule] || [];
      if (!isRangeAvailable(bien, filters.debut, filters.fin, extra, activeReservations)) {
        return false;
      }
    } else if (filters.debut && !filters.fin) {
      const extra = blockedMap[bien.matricule] || [];
      if (isDateOccupied(bien, filters.debut, extra, activeReservations)) {
        return false;
      }
    }
    return true;
  });

  const statutRank: Record<string, number> = { Vedette: 0, Nouveau: 1, Populaire: 2 };
  return [...filtered].sort((a, b) => {
    if (filters.sort === 'prix-asc') {
      return a.prix - b.prix || a.matricule.localeCompare(b.matricule);
    }
    if (filters.sort === 'prix-desc') {
      return b.prix - a.prix || a.matricule.localeCompare(b.matricule);
    }
    if (filters.sort === 'chambres-desc') {
      const aCh = a.type === 'Appartement' ? a.chambres : -1;
      const bCh = b.type === 'Appartement' ? b.chambres : -1;
      if (bCh !== aCh) return bCh - aCh;
      return a.prix - b.prix;
    }
    if (filters.sort === 'chambres-asc') {
      const aCh = a.type === 'Appartement' ? a.chambres : Number.MAX_SAFE_INTEGER;
      const bCh = b.type === 'Appartement' ? b.chambres : Number.MAX_SAFE_INTEGER;
      if (aCh !== bCh) return aCh - bCh;
      return a.prix - b.prix;
    }
    if (filters.sort === 'carburant') {
      if (a.type === 'Voiture' && b.type !== 'Voiture') return -1;
      if (a.type !== 'Voiture' && b.type === 'Voiture') return 1;
      if (a.type === 'Voiture' && b.type === 'Voiture') {
        const cmp = a.carburant.localeCompare(b.carburant, 'fr');
        if (cmp !== 0) return cmp;
      }
      return a.prix - b.prix;
    }
    if (filters.sort === 'recents') {
      return (
        b.date_publication.localeCompare(a.date_publication) ||
        a.matricule.localeCompare(b.matricule)
      );
    }
    if (filters.sort === 'anciens') {
      return (
        a.date_publication.localeCompare(b.date_publication) ||
        a.matricule.localeCompare(b.matricule)
      );
    }
    return (statutRank[a.statut] ?? 3) - (statutRank[b.statut] ?? 3);
  });
}

// Toujours utiliser CERIM_WHATSAPP par défaut — jamais de numéro fournisseur côté client
export function buildCerimWhatsAppUrl(text: string): string {
  const cleanNumber = CERIM_WHATSAPP.replace(/[^\d]/g, '');
  const truncated = text.length > 1450 ? `${text.slice(0, 1447)}...` : text;
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(truncated)}`;
}

// Alias rétrocompatible qui force toujours l'usage du canal CERIM si aucun numéro n'est CERIM
export function buildWhatsAppUrl(_phoneNumber: string | undefined, text: string): string {
  return buildCerimWhatsAppUrl(text);
}

export function getBienUrl(matricule: string): string {
  const encoded = encodeURIComponent(matricule);
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}${window.location.pathname}#/bien/${encoded}`;
  }
  return `#/bien/${encoded}`;
}

export function getSuiviUrl(code?: string): string {
  const suffix = code ? `#/suivi?code=${encodeURIComponent(code)}` : '#/suivi';
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}${window.location.pathname}${suffix}`;
  }
  return suffix;
}
