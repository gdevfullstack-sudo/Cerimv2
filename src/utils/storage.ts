import {
  AdminSettings,
  Bien,
  BlacklistEntry,
  ClientSuggestion,
  CookieConsentState,
  PlatformAnalytics,
  PropertyInteractionStats,
  Reservation,
  ReviewRecord,
  VisitHistoryItem,
  WhatsAppSimLog,
} from '../types';

const KEYS = {
  RESERVATIONS: 'cerim_reservations_v2',
  WHATSAPP_LOGS: 'cerim_whatsapp_sim_logs',
  BLACKLIST: 'cerim_blacklist',
  ADMIN_SETTINGS: 'cerim_admin_settings',
  HISTORY: 'cerim_history',
  REVIEWS: 'cerim_reviews',
  CATALOG_BIENS: 'cerim_catalog_extra_biens',
  CATALOG_BLOCKS: 'cerim_catalog_blocks',
  ANALYTICS: 'cerim_platform_analytics',
  INTERACTIONS: 'cerim_property_interactions',
  SUGGESTIONS: 'cerim_client_suggestions',
  FAVORITES: 'cerim_favorites',
  NEWSLETTER: 'cerim_newsletter_subscribers',
  COOKIE_CONSENT: 'cerim_cookie_consent',
  ADMIN_AUTH: 'cerim_admin_authenticated',
  SESSION_VISIT_FLAG: 'cerim_session_counted',
} as const;

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  cancellationHours: 24,
  clientConfirmTimeoutMinutes: 120,
  supplierTimeoutMinutes: 30,
  encaissementPar: 'CERIM',
};

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadReservations(): Reservation[] {
  return safeGet<Reservation[]>(KEYS.RESERVATIONS, []);
}

export function saveReservations(list: Reservation[]): boolean {
  return safeSet(KEYS.RESERVATIONS, list);
}

export function loadWhatsAppLogs(): WhatsAppSimLog[] {
  return safeGet<WhatsAppSimLog[]>(KEYS.WHATSAPP_LOGS, []);
}

export function saveWhatsAppLogs(logs: WhatsAppSimLog[]): boolean {
  return safeSet(KEYS.WHATSAPP_LOGS, logs.slice(0, 250));
}

export function loadBlacklist(): BlacklistEntry[] {
  return safeGet<BlacklistEntry[]>(KEYS.BLACKLIST, []);
}

export function saveBlacklist(entries: BlacklistEntry[]): boolean {
  return safeSet(KEYS.BLACKLIST, entries);
}

export function loadAdminSettings(): AdminSettings {
  return {
    ...DEFAULT_ADMIN_SETTINGS,
    ...safeGet<Partial<AdminSettings>>(KEYS.ADMIN_SETTINGS, {}),
  };
}

export function saveAdminSettings(settings: AdminSettings): boolean {
  return safeSet(KEYS.ADMIN_SETTINGS, settings);
}

export function loadHistory(): VisitHistoryItem[] {
  return safeGet<VisitHistoryItem[]>(KEYS.HISTORY, []);
}

export function addVisitToHistory(matricule: string): VisitHistoryItem[] {
  const current = loadHistory().filter((item) => item.matricule !== matricule);
  const updated = [{ matricule, visitedAt: new Date().toISOString() }, ...current].slice(0, 30);
  safeSet(KEYS.HISTORY, updated);
  return updated;
}

export function clearVisitHistory(): boolean {
  return safeSet(KEYS.HISTORY, []);
}

export function loadReviews(): ReviewRecord[] {
  return safeGet<ReviewRecord[]>(KEYS.REVIEWS, []);
}

export function saveReviews(list: ReviewRecord[]): boolean {
  return safeSet(KEYS.REVIEWS, list);
}

export function loadExtraBiens(): Bien[] {
  return safeGet<Bien[]>(KEYS.CATALOG_BIENS, []);
}

export function saveExtraBiens(list: Bien[]): boolean {
  return safeSet(KEYS.CATALOG_BIENS, list);
}

export function loadCatalogBlocks(): Record<string, string[]> {
  return safeGet<Record<string, string[]>>(KEYS.CATALOG_BLOCKS, {});
}

export function saveCatalogBlocks(blocks: Record<string, string[]>): boolean {
  return safeSet(KEYS.CATALOG_BLOCKS, blocks);
}

const DEFAULT_ANALYTICS: PlatformAnalytics = {
  totalVisits: 0,
  pageViews: {
    home: 0,
    recherche: 0,
    detail: 0,
    suivi: 0,
    contact: 0,
    admin: 0,
  },
  dailyVisits: {},
};

export function loadAnalytics(): PlatformAnalytics {
  return safeGet<PlatformAnalytics>(KEYS.ANALYTICS, DEFAULT_ANALYTICS);
}

export function saveAnalytics(data: PlatformAnalytics): boolean {
  return safeSet(KEYS.ANALYTICS, data);
}

export function markSessionVisitIfNeeded(): boolean {
  try {
    const already = window.sessionStorage.getItem(KEYS.SESSION_VISIT_FLAG);
    if (already) return false;
    window.sessionStorage.setItem(KEYS.SESSION_VISIT_FLAG, '1');
    return true;
  } catch {
    return true;
  }
}

export function loadInteractions(): Record<string, PropertyInteractionStats> {
  return safeGet<Record<string, PropertyInteractionStats>>(KEYS.INTERACTIONS, {});
}

export function saveInteractions(map: Record<string, PropertyInteractionStats>): boolean {
  return safeSet(KEYS.INTERACTIONS, map);
}

export function loadSuggestions(): ClientSuggestion[] {
  return safeGet<ClientSuggestion[]>(KEYS.SUGGESTIONS, []);
}

export function saveSuggestions(list: ClientSuggestion[]): boolean {
  return safeSet(KEYS.SUGGESTIONS, list);
}

export function loadAdminAuth(): boolean {
  try {
    return window.sessionStorage.getItem(KEYS.ADMIN_AUTH) === '1';
  } catch {
    return false;
  }
}

export function saveAdminAuth(authenticated: boolean): void {
  try {
    if (authenticated) {
      window.sessionStorage.setItem(KEYS.ADMIN_AUTH, '1');
    } else {
      window.sessionStorage.removeItem(KEYS.ADMIN_AUTH);
    }
  } catch {
    // ignore storage errors
  }
}

export function loadFavorites(): string[] {
  return safeGet<string[]>(KEYS.FAVORITES, []);
}

export function saveFavorites(matricules: string[]): boolean {
  return safeSet(KEYS.FAVORITES, matricules);
}

export function loadNewsletterEmails(): string[] {
  return safeGet<string[]>(KEYS.NEWSLETTER, []);
}

export function subscribeNewsletterEmail(email: string): {
  added: boolean;
  emails: string[];
} {
  const normalized = email.trim().toLowerCase();
  const current = loadNewsletterEmails();
  if (current.includes(normalized)) {
    return { added: false, emails: current };
  }
  const updated = [normalized, ...current];
  safeSet(KEYS.NEWSLETTER, updated);
  return { added: true, emails: updated };
}

export function loadCookieConsent(): CookieConsentState | null {
  return safeGet<CookieConsentState | null>(KEYS.COOKIE_CONSENT, null);
}

export function saveCookieConsent(consent: CookieConsentState): boolean {
  return safeSet(KEYS.COOKIE_CONSENT, consent);
}

export function clearPersonalLocalData(): void {
  try {
    window.localStorage.removeItem(KEYS.HISTORY);
    window.localStorage.removeItem(KEYS.FAVORITES);
    window.localStorage.removeItem(KEYS.NEWSLETTER);
    window.localStorage.removeItem(KEYS.SUGGESTIONS);
  } catch {
    // ignore storage errors
  }
}
