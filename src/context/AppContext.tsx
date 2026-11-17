import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  AdminSettings,
  Bien,
  BlacklistEntry,
  ClientSuggestion,
  CookieConsentState,
  InteractionKind,
  LegalTab,
  PlatformAnalytics,
  PropertyInteractionStats,
  Reservation,
  ReviewRecord,
  SearchFilters,
  ToastMessage,
  ToastType,
  VisitHistoryItem,
  WhatsAppSimLog,
} from '../types';
import { BIENS_DATA } from '../data/biens';
import {
  addBlacklistPhone,
  getAdminApiToken,
  HttpGateway,
  isHttpGatewayMode,
  removeBlacklistPhone,
  reservationService,
  setAdminApiToken,
  updateAdminSettingsStore,
} from '../services/reservationGateway';
import {
  addVisitToHistory,
  clearPersonalLocalData,
  clearVisitHistory,
  loadAdminAuth,
  loadAdminSettings,
  loadAnalytics,
  loadBlacklist,
  loadCatalogBlocks,
  loadCookieConsent,
  loadExtraBiens,
  loadFavorites,
  loadHistory,
  loadInteractions,
  loadReservations,
  loadReviews,
  loadSuggestions,
  loadWhatsAppLogs,
  markSessionVisitIfNeeded,
  saveAdminAuth,
  saveAnalytics,
  saveCatalogBlocks,
  saveCookieConsent,
  saveExtraBiens,
  saveFavorites,
  saveInteractions,
  saveReviews,
  saveSuggestions,
} from '../utils/storage';
import { getTodayIso } from '../utils/dataHelpers';

export type PageName =
  | 'home'
  | 'recherche'
  | 'detail'
  | 'suivi'
  | 'contact'
  | 'admin'
  | 'checkin'
  | 'legal';

export type AdminTab =
  | 'reservations'
  | 'fournisseurs'
  | 'whatsapp'
  | 'analytics'
  | 'catalogue'
  | 'parametres';

export interface RouteState {
  page: PageName;
  matricule?: string;
  trackingCode?: string;
  adminTab?: AdminTab;
  legalTab?: LegalTab;
  filters?: Partial<SearchFilters>;
}

// Authentification locale provisoire pour l'aperçu front-end.
// À remplacer par Cloudflare Access / JWT vérifié côté Worker avant mise en production.
const ADMIN_ACCESS_CODE = 'CERIM2026';

interface AppContextValue {
  route: RouteState;
  navigate: (next: RouteState) => void;
  allBiens: Bien[];
  reservations: Reservation[];
  refreshReservations: () => void;
  whatsappLogs: WhatsAppSimLog[];
  refreshWhatsAppLogs: () => void;
  blacklist: BlacklistEntry[];
  addToBlacklist: (telephone: string, motif: string) => void;
  removeFromBlacklist: (id: string) => void;
  adminSettings: AdminSettings;
  updateAdminSettings: (patch: Partial<AdminSettings>) => void;
  history: VisitHistoryItem[];
  recordVisit: (matricule: string) => void;
  clearHistory: () => void;
  reviews: ReviewRecord[];
  addReview: (review: Omit<ReviewRecord, 'statut'>) => void;
  extraBiens: Bien[];
  addCatalogBien: (bien: Bien) => void;
  catalogBlocks: Record<string, string[]>;
  toggleCatalogBlockDate: (matricule: string, isoDate: string) => void;
  chatbotOpen: boolean;
  setChatbotOpen: (open: boolean) => void;
  // Admin & Analytics
  isAdmin: boolean;
  loginAdmin: (code: string) => boolean;
  logoutAdmin: () => void;
  analytics: PlatformAnalytics;
  interactions: Record<string, PropertyInteractionStats>;
  recordInteraction: (matricule: string, kind: InteractionKind) => void;
  suggestions: ClientSuggestion[];
  addSuggestion: (s: Omit<ClientSuggestion, 'id' | 'date' | 'statut'>) => void;
  updateSuggestionStatus: (id: string, statut: ClientSuggestion['statut']) => void;
  deleteSuggestion: (id: string) => void;
  // Favorites & Local Toasts
  favorites: string[];
  isFavorite: (matricule: string) => boolean;
  toggleFavorite: (matricule: string, titre?: string) => void;
  toasts: ToastMessage[];
  showToast: (toast: { title: string; description?: string; type?: ToastType }) => void;
  dismissToast: (id: string) => void;
  // Legal & Cookie Consent
  cookieConsent: CookieConsentState | null;
  updateCookieConsent: (analyticsAccepted: boolean) => void;
  cookieSettingsOpen: boolean;
  setCookieSettingsOpen: (open: boolean) => void;
  clearLocalPersonalData: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function parseHashToRoute(): RouteState {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw || raw === '/') return { page: 'home' };

  const [pathPart, queryPart] = raw.split('?');
  const [cleanPath, hashFrag] = pathPart.split('#');
  const params = new URLSearchParams(queryPart || '');

  if (cleanPath.startsWith('/bien/')) {
    const matricule = decodeURIComponent(cleanPath.slice('/bien/'.length));
    return { page: 'detail', matricule };
  }
  if (cleanPath === '/recherche') {
    const typeParam = params.get('type');
    const villeParam = params.get('ville');
    const debutParam = params.get('debut') || '';
    const finParam = params.get('fin') || '';
    const budgetParam = params.get('budget');
    return {
      page: 'recherche',
      filters: {
        type: typeParam === 'Appartement' || typeParam === 'Voiture' ? typeParam : 'Tous',
        ville:
          villeParam === 'Brazzaville' || villeParam === 'Pointe-Noire' ? villeParam : 'Toutes',
        debut: debutParam,
        fin: finParam,
        budgetMax: budgetParam ? Number(budgetParam) : null,
      },
    };
  }
  if (cleanPath === '/suivi') {
    return {
      page: 'suivi',
      trackingCode: params.get('code') || undefined,
    };
  }
  if (cleanPath === '/contact') return { page: 'contact' };
  if (cleanPath === '/cgv') return { page: 'legal', legalTab: 'cgv' };
  if (cleanPath === '/cgu') return { page: 'legal', legalTab: 'cgv' };
  if (cleanPath === '/confidentialite') return { page: 'legal', legalTab: 'confidentialite' };
  if (cleanPath === '/cookies') return { page: 'legal', legalTab: 'cookies' };
  if (cleanPath === '/mentions-legales') return { page: 'legal', legalTab: 'mentions' };
  if (cleanPath === '/admin/checkin') {
    return {
      page: 'checkin',
      trackingCode: params.get('code') || undefined,
    };
  }
  if (cleanPath === '/admin' || cleanPath === '/dashboard') {
    const tabParam = hashFrag || params.get('tab');
    const adminTab: AdminTab =
      tabParam === 'fournisseurs'
        ? 'fournisseurs'
        : tabParam === 'whatsapp'
          ? 'whatsapp'
          : tabParam === 'analytics' || tabParam === 'suggestions'
            ? 'analytics'
            : tabParam === 'catalogue'
              ? 'catalogue'
              : tabParam === 'parametres'
                ? 'parametres'
                : 'reservations';
    return {
      page: 'admin',
      adminTab,
    };
  }
  return { page: 'home' };
}

function routeToHash(r: RouteState): string {
  if (r.page === 'home') return '#/';
  if (r.page === 'contact') return '#/contact';
  if (r.page === 'suivi') {
    return r.trackingCode ? `#/suivi?code=${encodeURIComponent(r.trackingCode)}` : '#/suivi';
  }
  if (r.page === 'checkin') {
    return r.trackingCode
      ? `#/admin/checkin?code=${encodeURIComponent(r.trackingCode)}`
      : '#/admin/checkin';
  }
  if (r.page === 'legal') {
    if (r.legalTab === 'confidentialite') return '#/confidentialite';
    if (r.legalTab === 'cookies') return '#/cookies';
    if (r.legalTab === 'mentions') return '#/mentions-legales';
    return '#/cgv';
  }
  if (r.page === 'detail' && r.matricule) return `#/bien/${encodeURIComponent(r.matricule)}`;
  if (r.page === 'admin') {
    if (r.adminTab && r.adminTab !== 'reservations') {
      return `#/admin#${r.adminTab}`;
    }
    return '#/admin';
  }
  if (r.page === 'recherche') {
    const p = new URLSearchParams();
    if (r.filters?.type && r.filters.type !== 'Tous') p.set('type', r.filters.type);
    if (r.filters?.ville && r.filters.ville !== 'Toutes') p.set('ville', r.filters.ville);
    if (r.filters?.debut) p.set('debut', r.filters.debut);
    if (r.filters?.fin) p.set('fin', r.filters.fin);
    if (r.filters?.budgetMax) p.set('budget', String(r.filters.budgetMax));
    const q = p.toString();
    return q ? `#/recherche?${q}` : '#/recherche';
  }
  return '#/';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<RouteState>(() => parseHashToRoute());
  const [reservations, setReservations] = useState<Reservation[]>(() => loadReservations());
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppSimLog[]>(() => loadWhatsAppLogs());
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>(() => loadBlacklist());
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(() => loadAdminSettings());
  const [history, setHistory] = useState<VisitHistoryItem[]>(() => loadHistory());
  const [reviews, setReviews] = useState<ReviewRecord[]>(() => loadReviews());
  const [extraBiens, setExtraBiens] = useState<Bien[]>(() => loadExtraBiens());
  const [catalogBlocks, setCatalogBlocks] = useState<Record<string, string[]>>(() =>
    loadCatalogBlocks()
  );
  const [chatbotOpen, setChatbotOpen] = useState(false);

  const [isAdmin, setIsAdmin] = useState<boolean>(() => loadAdminAuth());
  const [analytics, setAnalytics] = useState<PlatformAnalytics>(() => loadAnalytics());
  const [interactions, setInteractions] = useState<Record<string, PropertyInteractionStats>>(() =>
    loadInteractions()
  );
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>(() => loadSuggestions());
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const [cookieConsent, setCookieConsent] = useState<CookieConsentState | null>(() =>
    loadCookieConsent()
  );
  const [cookieSettingsOpen, setCookieSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimersRef = useRef<Record<string, number>>({});

  const allBiens = useMemo(() => [...BIENS_DATA, ...extraBiens], [extraBiens]);

  const refreshReservations = useCallback(() => {
    if (isHttpGatewayMode && reservationService instanceof HttpGateway && getAdminApiToken()) {
      const httpGw = reservationService;
      void Promise.all([
        httpGw.fetchAdminReservations(),
        httpGw.fetchAdminLogs(),
        httpGw.fetchAdminBlacklist(),
        httpGw.fetchAdminSettings(),
      ])
        .then(([remoteRes, remoteLogs, remoteBl, remoteSettings]) => {
          setReservations(remoteRes);
          setWhatsappLogs(remoteLogs);
          setBlacklist(remoteBl);
          setAdminSettings(remoteSettings);
        })
        .catch(() => {
          // Si le jeton D1 est invalide ou serveur inaccessible, on conserve l'état actuel
        });
      return;
    }
    setReservations(loadReservations());
    setWhatsappLogs(loadWhatsAppLogs());
  }, []);

  const refreshWhatsAppLogs = useCallback(() => {
    if (isHttpGatewayMode && reservationService instanceof HttpGateway && getAdminApiToken()) {
      void reservationService
        .fetchAdminLogs()
        .then((remoteLogs) => setWhatsappLogs(remoteLogs))
        .catch(() => undefined);
      return;
    }
    setWhatsappLogs(loadWhatsAppLogs());
  }, []);

  useEffect(() => {
    if (isAdmin && isHttpGatewayMode) {
      refreshReservations();
    }
  }, [isAdmin, refreshReservations]);

  // Purge périodique des demandes expirées (> 2h sans OUI) pour libérer les dates automatiquement
  useEffect(() => {
    reservationService.purgeExpired(allBiens).then((changed) => {
      if (changed > 0) refreshReservations();
    });
    const interval = window.setInterval(() => {
      reservationService.purgeExpired(allBiens).then((changed) => {
        if (changed > 0) refreshReservations();
      });
    }, 30000);
    return () => window.clearInterval(interval);
  }, [allBiens, refreshReservations]);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      Object.values(timers).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    if (toastTimersRef.current[id]) {
      window.clearTimeout(toastTimersRef.current[id]);
      delete toastTimersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (opts: { title: string; description?: string; type?: ToastType }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const next: ToastMessage = {
        id,
        title: opts.title,
        description: opts.description,
        type: opts.type || 'success',
      };
      setToasts((prev) => [next, ...prev].slice(0, 4));
      toastTimersRef.current[id] = window.setTimeout(() => {
        dismissToast(id);
      }, 4200);
    },
    [dismissToast]
  );

  const isFavorite = useCallback(
    (matricule: string) => favorites.includes(matricule),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (matricule: string, titre?: string) => {
      setFavorites((prev) => {
        const exists = prev.includes(matricule);
        const updated = exists ? prev.filter((m) => m !== matricule) : [matricule, ...prev];
        saveFavorites(updated);
        showToast(
          exists
            ? {
                title: 'Retiré des favoris',
                description: titre
                  ? `${matricule} — ${titre} a été retiré de vos favoris.`
                  : `Le bien ${matricule} a été retiré de vos favoris.`,
                type: 'info',
              }
            : {
                title: 'Ajouté aux favoris',
                description: titre
                  ? `${matricule} — ${titre} a été sauvegardé dans vos favoris.`
                  : `Le bien ${matricule} a été sauvegardé dans vos favoris.`,
                type: 'success',
              }
        );
        return updated;
      });
    },
    [showToast]
  );

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHashToRoute());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Track session visit once + page views on route change (respects analytics cookie choice)
  useEffect(() => {
    if (cookieConsent && !cookieConsent.analytics) return;
    const today = getTodayIso();
    const isNewSession = markSessionVisitIfNeeded();
    setAnalytics((prev) => {
      const next: PlatformAnalytics = {
        totalVisits: prev.totalVisits + (isNewSession ? 1 : 0),
        pageViews: {
          ...prev.pageViews,
          [route.page]: (prev.pageViews[route.page] || 0) + 1,
        },
        dailyVisits: {
          ...prev.dailyVisits,
          [today]: (prev.dailyVisits[today] || 0) + (isNewSession ? 1 : 0),
        },
      };
      saveAnalytics(next);
      return next;
    });
  }, [route.page, route.matricule, cookieConsent]);

  const navigate = useCallback((next: RouteState) => {
    const hash = routeToHash(next);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      setRoute(next);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const recordVisit = useCallback((matricule: string) => {
    const updated = addVisitToHistory(matricule);
    setHistory(updated);
  }, []);

  const clearHistory = useCallback(() => {
    clearVisitHistory();
    setHistory([]);
  }, []);

  const addReview = useCallback(
    (review: Omit<ReviewRecord, 'statut'>) => {
      const entry: ReviewRecord = {
        ...review,
        statut: 'en attente',
      };
      setReviews((prev) => {
        const updated = [entry, ...prev];
        saveReviews(updated);
        return updated;
      });
      showToast({
        title: 'Avis enregistré',
        description: `Votre note de ${review.note}/5 a été transmise au back-office CERIM.`,
        type: 'success',
      });
    },
    [showToast]
  );

  const addCatalogBien = useCallback(
    (bien: Bien) => {
      setExtraBiens((prev) => {
        const updated = [...prev, bien];
        saveExtraBiens(updated);
        return updated;
      });
      showToast({
        title: 'Bien ajouté au catalogue',
        description: `${bien.matricule} — ${bien.titre} est désormais disponible.`,
        type: 'success',
      });
    },
    [showToast]
  );

  const toggleCatalogBlockDate = useCallback((matricule: string, isoDate: string) => {
    setCatalogBlocks((prev) => {
      const current = prev[matricule] || [];
      const exists = current.includes(isoDate);
      const nextList = exists ? current.filter((d) => d !== isoDate) : [...current, isoDate];
      const updated = { ...prev, [matricule]: nextList };
      saveCatalogBlocks(updated);
      return updated;
    });
  }, []);

  const addToBlacklist = useCallback(
    (telephone: string, motif: string) => {
      if (isHttpGatewayMode && reservationService instanceof HttpGateway) {
        void reservationService
          .addAdminBlacklist(telephone, motif)
          .then((list) => {
            setBlacklist(list);
            showToast({
              title: 'Numéro ajouté à la liste noire',
              description: 'Synchronisé avec la base D1 CERIM.',
              type: 'info',
            });
          })
          .catch((err) => {
            showToast({
              title: 'Action impossible',
              description: err instanceof Error ? err.message : 'Erreur serveur.',
              type: 'warning',
            });
          });
        return;
      }
      setBlacklist(addBlacklistPhone(telephone, motif));
      showToast({
        title: 'Numéro ajouté à la liste noire',
        description: 'Les nouvelles réservations depuis ce numéro seront refusées.',
        type: 'info',
      });
    },
    [showToast]
  );

  const removeFromBlacklist = useCallback(
    (id: string) => {
      if (isHttpGatewayMode && reservationService instanceof HttpGateway) {
        void reservationService
          .removeAdminBlacklist(id)
          .then((list) => setBlacklist(list))
          .catch((err) => {
            showToast({
              title: 'Action impossible',
              description: err instanceof Error ? err.message : 'Erreur serveur.',
              type: 'warning',
            });
          });
        return;
      }
      setBlacklist(removeBlacklistPhone(id));
    },
    [showToast]
  );

  const updateAdminSettings = useCallback(
    (patch: Partial<AdminSettings>) => {
      if (isHttpGatewayMode && reservationService instanceof HttpGateway) {
        void reservationService
          .updateAdminSettingsRemote(patch)
          .then((updated) => {
            setAdminSettings(updated);
            showToast({ title: 'Paramètres D1 mis à jour', type: 'success' });
          })
          .catch((err) => {
            showToast({
              title: 'Action impossible',
              description: err instanceof Error ? err.message : 'Erreur serveur.',
              type: 'warning',
            });
          });
        return;
      }
      setAdminSettings(updateAdminSettingsStore(patch));
      showToast({
        title: 'Paramètres mis à jour',
        type: 'success',
      });
    },
    [showToast]
  );

  const updateCookieConsent = useCallback(
    (analyticsAccepted: boolean) => {
      const next: CookieConsentState = {
        essential: true,
        analytics: analyticsAccepted,
        updatedAt: new Date().toISOString(),
      };
      saveCookieConsent(next);
      setCookieConsent(next);
      setCookieSettingsOpen(false);
      showToast({
        title: 'Préférences enregistrées',
        description: analyticsAccepted
          ? 'Tous les cookies (essentiels et mesure d’audience) sont activés.'
          : 'Seuls les cookies essentiels au fonctionnement sont activés.',
        type: 'success',
      });
    },
    [showToast]
  );

  const clearLocalPersonalData = useCallback(() => {
    clearPersonalLocalData();
    setHistory([]);
    setFavorites([]);
    setSuggestions([]);
    showToast({
      title: 'Données locales effacées',
      description: 'Votre historique, vos favoris et vos préférences ont été supprimés.',
      type: 'info',
    });
  }, [showToast]);

  const recordInteraction = useCallback(
    (matricule: string, kind: InteractionKind) => {
      if (!matricule) return;
      if (cookieConsent && !cookieConsent.analytics) return;
      setInteractions((prev) => {
        const existing = prev[matricule] || {
          views: 0,
          galleryOpens: 0,
          calendarSelections: 0,
          whatsappClicks: 0,
          lastInteractionAt: new Date().toISOString(),
        };
        const updated: Record<string, PropertyInteractionStats> = {
          ...prev,
          [matricule]: {
            ...existing,
            [kind]: existing[kind] + 1,
            lastInteractionAt: new Date().toISOString(),
          },
        };
        saveInteractions(updated);
        return updated;
      });
    },
    [cookieConsent]
  );

  const addSuggestion = useCallback(
    (s: Omit<ClientSuggestion, 'id' | 'date' | 'statut'>) => {
      const entry: ClientSuggestion = {
        ...s,
        id: `sug-${Date.now()}`,
        date: getTodayIso(),
        statut: 'Nouvelle',
      };
      setSuggestions((prev) => {
        const updated = [entry, ...prev];
        saveSuggestions(updated);
        return updated;
      });
      showToast({
        title: 'Message transmis à CERIM',
        description: `Votre demande (${s.sujet}) a bien été enregistrée.`,
        type: 'success',
      });
    },
    [showToast]
  );

  const updateSuggestionStatus = useCallback(
    (id: string, statut: ClientSuggestion['statut']) => {
      setSuggestions((prev) => {
        const updated = prev.map((s) => (s.id === id ? { ...s, statut } : s));
        saveSuggestions(updated);
        return updated;
      });
    },
    []
  );

  const deleteSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSuggestions(updated);
      return updated;
    });
  }, []);

  const loginAdmin = useCallback((code: string): boolean => {
    const clean = code.trim();
    if (!clean) return false;
    if (isHttpGatewayMode) {
      setAdminApiToken(clean);
      setIsAdmin(true);
      saveAdminAuth(true);
      return true;
    }
    if (clean === ADMIN_ACCESS_CODE) {
      setIsAdmin(true);
      saveAdminAuth(true);
      return true;
    }
    return false;
  }, []);

  const logoutAdmin = useCallback(() => {
    setAdminApiToken('');
    setIsAdmin(false);
    saveAdminAuth(false);
  }, []);

  return (
    <AppContext.Provider
      value={{
        route,
        navigate,
        allBiens,
        reservations,
        refreshReservations,
        whatsappLogs,
        refreshWhatsAppLogs,
        blacklist,
        addToBlacklist,
        removeFromBlacklist,
        adminSettings,
        updateAdminSettings,
        history,
        recordVisit,
        clearHistory,
        reviews,
        addReview,
        extraBiens,
        addCatalogBien,
        catalogBlocks,
        toggleCatalogBlockDate,
        chatbotOpen,
        setChatbotOpen,
        isAdmin,
        loginAdmin,
        logoutAdmin,
        analytics,
        interactions,
        recordInteraction,
        suggestions,
        addSuggestion,
        updateSuggestionStatus,
        deleteSuggestion,
        favorites,
        isFavorite,
        toggleFavorite,
        toasts,
        showToast,
        dismissToast,
        cookieConsent,
        updateCookieConsent,
        cookieSettingsOpen,
        setCookieSettingsOpen,
        clearLocalPersonalData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
