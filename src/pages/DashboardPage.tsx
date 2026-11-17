import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Lock,
  LogOut,
  MessageCircle,
  MessageSquareText,
  MousePointerClick,
  Plus,
  Receipt,
  Search,
  Settings,
  ShieldAlert,
  ShieldBan,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  AdminSettings,
  Bien,
  BienPeriode,
  BienType,
  BienVille,
  ChecklistItemState,
  ClientSuggestion,
  Reservation,
  StatutReservation,
} from '../types';
import { AvailabilityCalendar } from '../components/AvailabilityCalendar';
import { ReceiptModal } from '../components/ReceiptModal';
import {
  computeSupplierMetrics,
  getChecklistTemplate,
  reservationService,
} from '../services/reservationGateway';
import {
  buildCerimWhatsAppUrl,
  formatDateTimeFr,
  formatFcfa,
  formatIsoFr,
  getNextMatricule,
  getPhoneLast4,
  getTodayIso,
  STATUT_LABELS,
} from '../utils/dataHelpers';
import { buildAdminSeoConfig, usePageSeo } from '../utils/seo';

const PAGE_LABELS: Record<string, string> = {
  home: 'Accueil',
  recherche: 'Recherche & Carte',
  detail: 'Fiches biens',
  suivi: 'Suivi client',
  contact: 'Contact',
  admin: 'Administration',
  checkin: 'Check-in sur place',
};

const STATUT_BADGE_CLASS: Record<StatutReservation, string> = {
  en_attente_client: 'bg-amber-50 text-amber-800 border-amber-200',
  demandee: 'bg-sky-50 text-sky-800 border-sky-200',
  confirmee: 'bg-[#20B8A6]/15 text-[#0C7A6D] border-[#20B8A6]',
  bien_pret: 'bg-[#20B8A6]/25 text-[#123B63] border-[#20B8A6]',
  arrivee: 'bg-[#123B63] text-white border-[#123B63]',
  terminee: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  annulee: 'bg-slate-100 text-slate-600 border-slate-200',
  refusee: 'bg-rose-50 text-rose-700 border-rose-200',
  no_show: 'bg-rose-100 text-rose-900 border-rose-300',
};

export const DashboardPage: React.FC = () => {
  const {
    route,
    navigate,
    allBiens,
    reservations,
    refreshReservations,
    whatsappLogs,
    blacklist,
    addToBlacklist,
    removeFromBlacklist,
    adminSettings,
    updateAdminSettings,
    reviews,
    extraBiens,
    addCatalogBien,
    catalogBlocks,
    toggleCatalogBlockDate,
    isAdmin,
    loginAdmin,
    logoutAdmin,
    analytics,
    interactions,
    suggestions,
    updateSuggestionStatus,
    deleteSuggestion,
    showToast,
  } = useApp();

  const adminSeo = useMemo(() => buildAdminSeoConfig(), []);
  usePageSeo(adminSeo);

  const [adminCode, setAdminCode] = useState('');
  const [authError, setAuthError] = useState('');

  const activeTab = route.adminTab || 'reservations';
  const todayIso = getTodayIso();

  // Reservations filters & selected dossier
  const [resQuery, setResQuery] = useState('');
  const [resStatusFilter, setResStatusFilter] = useState<'Tous' | StatutReservation>('Tous');
  const [resVilleFilter, setResVilleFilter] = useState<'Toutes' | BienVille>('Toutes');
  const [resDateFilter, setResDateFilter] = useState('');
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [actionBusy, setActionBusy] = useState(false);

  // Interactive Checklist modal inside drawer
  const [checklistTargetCode, setChecklistTargetCode] = useState<string | null>(null);
  const [checklistDraft, setChecklistDraft] = useState<ChecklistItemState[]>([]);

  // Receipt modal
  const [receiptTarget, setReceiptTarget] = useState<Reservation | null>(null);

  // WhatsApp console filter
  const [waRoleFilter, setWaRoleFilter] = useState<'tous' | 'client' | 'fournisseur' | 'cerim'>(
    'tous'
  );
  const [waCodeQuery, setWaCodeQuery] = useState('');

  // Analytics & suggestions filters
  const [interactionQuery, setInteractionQuery] = useState('');
  const [interactionTypeFilter, setInteractionTypeFilter] = useState<'Tous' | BienType>('Tous');
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState<
    'Toutes' | ClientSuggestion['statut']
  >('Toutes');

  // Blacklist form
  const [blPhone, setBlPhone] = useState('');
  const [blMotif, setBlMotif] = useState('');

  // Catalog form (fournisseurId opaque uniquement, jamais de WhatsApp fournisseur)
  const [newType, setNewType] = useState<BienType>('Appartement');
  const [newTitre, setNewTitre] = useState('');
  const [newVille, setNewVille] = useState<BienVille>('Brazzaville');
  const [newQuartier, setNewQuartier] = useState('');
  const [newPrix, setNewPrix] = useState('50000');
  const [newPeriode, setNewPeriode] = useState<BienPeriode>('nuit');
  const [newFournisseurId, setNewFournisseurId] = useState('SUP-01');
  const [newResume, setNewResume] = useState('');
  const [newChambres, setNewChambres] = useState('2');
  const [newSurface, setNewSurface] = useState('75');
  const [newMarque, setNewMarque] = useState('Toyota');
  const [newModele, setNewModele] = useState('RAV4');
  const [newBoite, setNewBoite] = useState<'Automatique' | 'Manuelle'>('Automatique');
  const [newPlaces, setNewPlaces] = useState('5');
  const [addedMatricule, setAddedMatricule] = useState('');
  const [selectedCalMatricule, setSelectedCalMatricule] = useState<string>(
    allBiens[0]?.matricule || 'AP1'
  );

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!loginAdmin(adminCode)) {
      setAuthError('Code d’accès administrateur incorrect.');
    } else {
      setAdminCode('');
    }
  };

  // Tableau du jour
  const todayBoard = useMemo(() => {
    const arrivals = reservations.filter(
      (r) =>
        r.debut === todayIso &&
        ['confirmee', 'bien_pret', 'arrivee'].includes(r.statut)
    );
    const departures = reservations.filter(
      (r) => r.fin === todayIso && r.statut === 'arrivee'
    );
    const missingChecklist = reservations.filter((r) => r.statut === 'confirmee');
    return { arrivals, departures, missingChecklist };
  }, [reservations, todayIso]);

  // Filtered Reservations
  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      if (resStatusFilter !== 'Tous' && r.statut !== resStatusFilter) return false;
      if (resVilleFilter !== 'Toutes' && r.ville !== resVilleFilter) return false;
      if (resDateFilter && (r.debut > resDateFilter || r.fin < resDateFilter)) return false;
      if (resQuery.trim()) {
        const q = resQuery.trim().toLowerCase();
        return (
          r.code.toLowerCase().includes(q) ||
          r.matricule.toLowerCase().includes(q) ||
          r.titre.toLowerCase().includes(q) ||
          r.client.nom.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reservations, resStatusFilter, resVilleFilter, resDateFilter, resQuery]);

  const activeReservation = useMemo(() => {
    if (!selectedCode) return filteredReservations[0] || null;
    return (
      reservations.find((r) => r.code === selectedCode) ||
      filteredReservations[0] ||
      null
    );
  }, [reservations, filteredReservations, selectedCode]);

  const supplierMetrics = useMemo(
    () => computeSupplierMetrics(allBiens, reservations),
    [allBiens, reservations]
  );

  const filteredWaLogs = useMemo(() => {
    return whatsappLogs.filter((log) => {
      if (waRoleFilter !== 'tous' && log.destinataireRole !== waRoleFilter) return false;
      if (waCodeQuery.trim()) {
        return log.codeReservation.toLowerCase().includes(waCodeQuery.trim().toLowerCase());
      }
      return true;
    });
  }, [whatsappLogs, waRoleFilter, waCodeQuery]);

  // Aggregated KPIs
  const activeReservationsCount = useMemo(
    () =>
      reservations.filter((r) =>
        ['en_attente_client', 'demandee', 'confirmee', 'bien_pret', 'arrivee'].includes(r.statut)
      ).length,
    [reservations]
  );

  const totalCollectedFcfa = useMemo(
    () => reservations.reduce((sum, r) => sum + (r.paiementSurPlace?.montant || 0), 0),
    [reservations]
  );

  const noShowCount = useMemo(
    () => reservations.filter((r) => r.statut === 'no_show').length,
    [reservations]
  );

  const todayVisits = analytics.dailyVisits[todayIso] || 0;
  const totalInteractionsAll = useMemo(() => {
    return Object.values(interactions).reduce(
      (sum, s) => sum + s.views + s.galleryOpens + s.calendarSelections + s.whatsappClicks,
      0
    );
  }, [interactions]);

  const propertyStatsRows = useMemo(() => {
    return allBiens
      .map((bien) => {
        const s = interactions[bien.matricule] || {
          views: 0,
          galleryOpens: 0,
          calendarSelections: 0,
          whatsappClicks: 0,
          lastInteractionAt: '',
        };
        const total = s.views + s.galleryOpens + s.calendarSelections + s.whatsappClicks;
        return { bien, stats: s, total };
      })
      .filter(({ bien }) => {
        if (interactionTypeFilter !== 'Tous' && bien.type !== interactionTypeFilter) return false;
        if (interactionQuery.trim()) {
          const q = interactionQuery.toLowerCase();
          return (
            bien.matricule.toLowerCase().includes(q) ||
            bien.titre.toLowerCase().includes(q) ||
            bien.ville.toLowerCase().includes(q) ||
            bien.quartier.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.total - a.total);
  }, [allBiens, interactions, interactionQuery, interactionTypeFilter]);

  const maxPropertyInteractions = useMemo(
    () => Math.max(1, ...propertyStatsRows.map((r) => r.total)),
    [propertyStatsRows]
  );

  const filteredSuggestions = useMemo(() => {
    if (suggestionStatusFilter === 'Toutes') return suggestions;
    return suggestions.filter((s) => s.statut === suggestionStatusFilter);
  }, [suggestions, suggestionStatusFilter]);

  const totalPageViews = useMemo(
    () => Object.values(analytics.pageViews).reduce((a, b) => a + b, 0),
    [analytics.pageViews]
  );

  const runAction = async (fn: () => Promise<unknown>, successTitle: string) => {
    setActionBusy(true);
    try {
      await fn();
      refreshReservations();
      showToast({ title: successTitle, type: 'success' });
    } catch (err) {
      showToast({
        title: 'Action impossible',
        description: err instanceof Error ? err.message : 'Erreur inattendue.',
        type: 'warning',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const openChecklistModal = (res: Reservation) => {
    const bien = allBiens.find((b) => b.matricule === res.matricule);
    setChecklistDraft(
      res.checklist?.items || getChecklistTemplate(bien?.type || 'Appartement')
    );
    setChecklistTargetCode(res.code);
  };

  const handleSaveChecklist = async () => {
    if (!checklistTargetCode) return;
    await runAction(
      () => reservationService.validerChecklist(checklistTargetCode, checklistDraft, allBiens),
      'Checklist validée — Bien prêt'
    );
    setChecklistTargetCode(null);
  };

  const handleExportCsv = () => {
    const header = [
      'Code',
      'Matricule',
      'Titre',
      'Ville',
      'Client',
      'Tel4',
      'Debut',
      'Fin',
      'Creneau',
      'Statut',
      'Estimation_FCFA',
      'Encaisse_FCFA',
      'Encaisse_Par',
    ];
    const rows = filteredReservations.map((r) => [
      r.code,
      r.matricule,
      `"${r.titre.replace(/"/g, '""')}"`,
      r.ville,
      `"${r.client.nom.replace(/"/g, '""')}"`,
      getPhoneLast4(r.client.telephone),
      r.debut,
      r.fin,
      r.creneauArrivee || '',
      r.statut,
      String(r.totalEstime),
      String(r.paiementSurPlace?.montant || 0),
      r.paiementSurPlace?.encaissePar || '',
    ]);
    const csv = [header.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cerim-reservations-${todayIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const payload = {
      reservations,
      whatsappLogs,
      blacklist,
      adminSettings,
      analytics,
      interactions,
      suggestions,
      reviews,
      annoncesAjoutees: extraBiens,
      joursBloques: catalogBlocks,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cerim-admin-export-${todayIso}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddListing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitre.trim() || !newQuartier.trim() || !newPrix) return;

    const matricule = getNextMatricule(newType, allBiens);
    const base = {
      matricule,
      type: newType,
      statut: 'Nouveau' as const,
      titre: newTitre.trim(),
      prix: Number(newPrix),
      devise: 'FCFA' as const,
      periode: newPeriode,
      ville: newVille,
      quartier: newQuartier.trim(),
      resume:
        newResume.trim() || `${newType} géré par CERIM, réservation avec paiement sur place.`,
      description:
        newResume.trim() ||
        `${newType} situé à ${newQuartier.trim()}, ${newVille}. Géré par CERIM — paiement sur place à l'arrivée.`,
      photos: [
        newType === 'Appartement'
          ? '/src/assets/images/apt_brazza_salon_1794704004033.jpg'
          : '/src/assets/images/car_suv_executive_1794704004462.jpg',
      ],
      localisation:
        newVille === 'Brazzaville'
          ? { lat: -4.2634, lng: 15.2429 }
          : { lat: -4.7761, lng: 11.8635 },
      reservations: [],
      bloques: [],
      date_publication: todayIso,
      fournisseurId: newFournisseurId.trim() || 'SUP-01',
    };

    const newBien: Bien =
      newType === 'Appartement'
        ? {
            ...base,
            type: 'Appartement',
            chambres: Number(newChambres) || 1,
            surface: Number(newSurface) || 50,
          }
        : {
            ...base,
            type: 'Voiture',
            marque: newMarque.trim() || 'Toyota',
            modele: newModele.trim() || 'RAV4',
            annee: 2024,
            boite: newBoite,
            carburant: 'Essence',
            places: Number(newPlaces) || 5,
          };

    addCatalogBien(newBien);
    setSelectedCalMatricule(matricule);
    setAddedMatricule(matricule);
    setNewTitre('');
    setNewQuartier('');
    setNewResume('');
  };

  const handleAddBlacklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blPhone.trim()) return;
    addToBlacklist(blPhone.trim(), blMotif.trim());
    setBlPhone('');
    setBlMotif('');
  };

  const adminWaUrl = useMemo(() => {
    const msg = `Synthèse CERIM (${todayIso}) : ${activeReservationsCount} réservation(s) active(s), ${formatFcfa(totalCollectedFcfa)} encaissés sur place, ${todayBoard.missingChecklist.length} checklist(s) à valider.`;
    return buildCerimWhatsAppUrl(msg);
  }, [todayIso, activeReservationsCount, totalCollectedFcfa, todayBoard.missingChecklist.length]);

  const calendarBien =
    allBiens.find((b) => b.matricule === selectedCalMatricule) || allBiens[0];

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="bg-white rounded-2xl border border-[#DBE6EC] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-full bg-[#123B63] text-[#20B8A6] flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-semibold text-[#123B63] tracking-tight">
              Back-Office CERIM
            </h1>
            <p className="text-sm text-[#5A7084]">
              Accès réservé à l’équipe CERIM : réservations, SLA fournisseurs, check-in sur place
              et paramètres.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-code" className="block text-xs font-semibold text-[#123B63]">
                Code d’accès administrateur
              </label>
              <input
                id="admin-code"
                type="password"
                required
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="Entrez le code administrateur"
                className="w-full min-h-[44px] px-3.5 rounded-lg border border-[#DBE6EC] text-sm text-[#0F2233] focus:border-[#20B8A6] focus:outline-none"
              />
            </div>

            {authError && (
              <p
                role="alert"
                className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
              >
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold transition-colors"
            >
              Accéder au back-office
            </button>
          </form>

          <p className="text-xs text-center text-[#5A7084] pt-2 border-t border-[#DBE6EC]">
            Code aperçu : <span className="font-semibold text-[#123B63] tabular-nums">CERIM2026</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#DBE6EC]">
        <div>
          <p className="text-xs font-medium text-[#5A7084]">Opérations CERIM · Interlocuteur unique</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#123B63] tracking-tight mt-0.5">
            Back-office Réservations &amp; Opérations
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate({ page: 'checkin' })}
            className="min-h-[40px] inline-flex items-center gap-2 px-3.5 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs font-semibold transition-colors"
          >
            <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
            <span>Check-in sur place</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 rounded-lg border border-[#DBE6EC] bg-white hover:border-[#123B63] text-[#123B63] text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 rounded-lg border border-[#DBE6EC] bg-white hover:border-[#123B63] text-[#123B63] text-xs font-semibold transition-colors"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={logoutAdmin}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-[#123B63] hover:bg-[#0B2A47] text-white text-xs font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4 text-[#20B8A6]" aria-hidden="true" />
            <span>Verrouiller</span>
          </button>
        </div>
      </div>

      {/* Tableau du jour */}
      <section
        aria-label="Tableau du jour"
        className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#123B63] text-white rounded-xl p-4 sm:p-5"
      >
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#20B8A6]">
            Arrivées du jour ({formatIsoFr(todayIso)})
          </p>
          <p className="text-2xl font-bold tabular-nums">{todayBoard.arrivals.length}</p>
          <p className="text-xs text-white/75 truncate">
            {todayBoard.arrivals.length > 0
              ? todayBoard.arrivals.map((r) => `${r.code} (${r.creneauArrivee || '—'})`).join(' · ')
              : 'Aucune arrivée prévue aujourd’hui'}
          </p>
        </div>

        <div className="space-y-1 md:border-l md:border-white/15 md:pl-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#20B8A6]">
            Départs du jour
          </p>
          <p className="text-2xl font-bold tabular-nums">{todayBoard.departures.length}</p>
          <p className="text-xs text-white/75 truncate">
            {todayBoard.departures.length > 0
              ? todayBoard.departures.map((r) => r.code).join(' · ')
              : 'Aucun check-out prévu aujourd’hui'}
          </p>
        </div>

        <div className="space-y-1 md:border-l md:border-white/15 md:pl-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
            Checklists « Bien prêt » à valider
          </p>
          <p className="text-2xl font-bold tabular-nums">{todayBoard.missingChecklist.length}</p>
          <p className="text-xs text-white/75 truncate">
            {todayBoard.missingChecklist.length > 0
              ? todayBoard.missingChecklist.map((r) => r.code).join(' · ')
              : 'Toutes les réservations confirmées sont prêtes'}
          </p>
        </div>
      </section>

      {/* 4 KPI Summary */}
      <section aria-label="Indicateurs clés" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#DBE6EC] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#5A7084]">
            <span>Réservations actives</span>
            <Calendar className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
          </div>
          <p className="text-2xl font-semibold text-[#123B63] tabular-nums">
            {activeReservationsCount}
          </p>
          <p className="text-xs text-[#5A7084] tabular-nums">
            {reservations.length} dossiers au total
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#DBE6EC] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#5A7084]">
            <span>Encaissements sur place</span>
            <Receipt className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
          </div>
          <p className="text-2xl font-semibold text-[#123B63] tabular-nums">
            {formatFcfa(totalCollectedFcfa)}
          </p>
          <p className="text-xs text-[#5A7084]">
            Mode par défaut : {adminSettings.encaissementPar}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#DBE6EC] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#5A7084]">
            <span>No-show &amp; Liste noire</span>
            <ShieldBan className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
          </div>
          <p className="text-2xl font-semibold text-[#123B63] tabular-nums">{noShowCount}</p>
          <p className="text-xs text-[#5A7084] tabular-nums">
            {blacklist.length} numéro(s) bloqué(s)
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#DBE6EC] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#5A7084]">
            <span>Visites &amp; Interactions</span>
            <MousePointerClick className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
          </div>
          <p className="text-2xl font-semibold text-[#123B63] tabular-nums">
            {analytics.totalVisits}
          </p>
          <p className="text-xs text-[#5A7084] tabular-nums">
            {todayVisits} aujourd&apos;hui · {totalInteractionsAll} interactions
          </p>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Sections back-office CERIM"
        className="flex flex-wrap items-center gap-1 p-1 bg-white rounded-lg border border-[#DBE6EC]"
      >
        {(
          [
            { id: 'reservations', label: `Réservations (${reservations.length})`, icon: Calendar },
            { id: 'fournisseurs', label: 'SLA Fournisseurs', icon: Building2 },
            { id: 'whatsapp', label: `WhatsApp (${whatsappLogs.length})`, icon: MessageCircle },
            { id: 'analytics', label: 'Audience & Avis', icon: BarChart3 },
            { id: 'catalogue', label: 'Catalogue & Dates', icon: Plus },
            { id: 'parametres', label: 'Paramètres & No-Show', icon: Settings },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              onClick={() => navigate({ page: 'admin', adminTab: tab.id })}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-semibold transition-colors ${
                isCurrent ? 'bg-[#123B63] text-white' : 'text-[#5A7084] hover:text-[#123B63]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: RESERVATIONS */}
      {activeTab === 'reservations' && (
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-[#DBE6EC] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search
                className="w-4 h-4 text-[#5A7084] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={resQuery}
                onChange={(e) => setResQuery(e.target.value)}
                placeholder="Code CER, client, matricule..."
                aria-label="Filtrer les réservations"
                className="w-full min-h-[40px] pl-9 pr-3 rounded-lg border border-[#DBE6EC] text-xs"
              />
            </div>

            <select
              value={resStatusFilter}
              onChange={(e) => setResStatusFilter(e.target.value as 'Tous' | StatutReservation)}
              aria-label="Filtrer par statut"
              className="min-h-[40px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-xs font-medium"
            >
              <option value="Tous">Tous les statuts</option>
              {(Object.keys(STATUT_LABELS) as StatutReservation[]).map((st) => (
                <option key={st} value={st}>
                  {STATUT_LABELS[st]}
                </option>
              ))}
            </select>

            <select
              value={resVilleFilter}
              onChange={(e) => setResVilleFilter(e.target.value as 'Toutes' | BienVille)}
              aria-label="Filtrer par ville"
              className="min-h-[40px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-xs font-medium"
            >
              <option value="Toutes">Toutes les villes</option>
              <option value="Brazzaville">Brazzaville</option>
              <option value="Pointe-Noire">Pointe-Noire</option>
            </select>

            <input
              type="date"
              value={resDateFilter}
              onChange={(e) => setResDateFilter(e.target.value)}
              aria-label="Filtrer par date de séjour"
              className="min-h-[40px] px-3 rounded-lg border border-[#DBE6EC] text-xs"
            />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* List table */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-[#DBE6EC] overflow-hidden">
              {filteredReservations.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-sm font-semibold text-[#123B63]">
                    Aucune réservation enregistrée sur ces critères
                  </p>
                  <p className="text-xs text-[#5A7084]">
                    Créez une réservation depuis la fiche d&apos;un bien pour tester tout le cycle
                    Lot 1 → Lot 3.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F2F7F9] border-b border-[#DBE6EC] text-[11px] font-semibold text-[#5A7084]">
                        <th className="py-3 px-3">Code / Bien</th>
                        <th className="py-3 px-3">Client</th>
                        <th className="py-3 px-3">Dates</th>
                        <th className="py-3 px-3">Statut</th>
                        <th className="py-3 px-3 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DBE6EC] text-xs">
                      {filteredReservations.map((r) => {
                        const isSel = activeReservation?.code === r.code;
                        return (
                          <tr
                            key={r.id}
                            onClick={() => setSelectedCode(r.code)}
                            className={`cursor-pointer transition-colors ${
                              isSel ? 'bg-[#20B8A6]/10' : 'hover:bg-[#F2F7F9]/60'
                            }`}
                          >
                            <td className="py-3 px-3">
                              <p className="font-bold text-[#123B63] tabular-nums">{r.code}</p>
                              <p className="text-[11px] text-[#5A7084] truncate max-w-[160px]">
                                [{r.matricule}] {r.titre}
                              </p>
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-medium text-[#0F2233]">{r.client.nom}</p>
                              <p className="text-[11px] text-[#5A7084] tabular-nums">
                                ****{getPhoneLast4(r.client.telephone)} · {r.creneauArrivee || '—'}
                              </p>
                            </td>
                            <td className="py-3 px-3 tabular-nums whitespace-nowrap text-[#0F2233]">
                              {formatIsoFr(r.debut)} → {formatIsoFr(r.fin)}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold whitespace-nowrap ${
                                  STATUT_BADGE_CLASS[r.statut]
                                }`}
                              >
                                {r.statut}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-semibold text-[#123B63] tabular-nums whitespace-nowrap">
                              {formatFcfa(r.paiementSurPlace?.montant || r.totalEstime)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Selected dossier detail & state machine actions */}
            <aside className="lg:col-span-5 bg-white rounded-xl border border-[#DBE6EC] p-5 space-y-5">
              {!activeReservation ? (
                <p className="text-xs text-[#5A7084]">
                  Sélectionnez une réservation dans le tableau pour gérer ses transitions.
                </p>
              ) : (
                <>
                  <div className="space-y-1 pb-3 border-b border-[#DBE6EC]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#123B63] tabular-nums">
                        {activeReservation.code}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                          STATUT_BADGE_CLASS[activeReservation.statut]
                        }`}
                      >
                        {STATUT_LABELS[activeReservation.statut]}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#0F2233]">
                      [{activeReservation.matricule}] {activeReservation.titre} ·{' '}
                      {activeReservation.ville}
                    </p>
                    <p className="text-xs text-[#5A7084]">
                      Client : <strong className="text-[#123B63]">{activeReservation.client.nom}</strong>{' '}
                      ({activeReservation.client.telephone})
                    </p>
                    {activeReservation.alternativePropose && (
                      <p className="text-xs font-semibold text-[#0C7A6D]">
                        Alternative proposée : {activeReservation.alternativePropose}
                      </p>
                    )}
                  </div>

                  {activeReservation.client.pieceIdentite && (
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#F2F7F9] border border-[#DBE6EC]">
                      <span className="text-xs font-medium text-[#123B63]">
                        Pièce d&apos;identité jointe
                      </span>
                      <img
                        src={activeReservation.client.pieceIdentite}
                        alt="Pièce d'identité client"
                        className="h-12 w-16 object-cover rounded border border-[#DBE6EC]"
                      />
                    </div>
                  )}

                  {/* Valid State Machine Actions */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5A7084]">
                      Actions autorisées
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {activeReservation.statut === 'en_attente_client' && (
                        <>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() =>
                              runAction(
                                () =>
                                  reservationService.confirmerClient(
                                    activeReservation.code,
                                    allBiens
                                  ),
                                'Réponse OUI confirmée — Dispatch WhatsApp x3'
                              )
                            }
                            className="px-3 py-2 rounded-lg bg-[#20B8A6] text-[#123B63] text-xs font-semibold"
                          >
                            Simuler « OUI » client
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() =>
                              runAction(
                                () =>
                                  reservationService.annuler(
                                    activeReservation.code,
                                    '',
                                    'cerim',
                                    'Annulée par CERIM'
                                  ),
                                'Réservation annulée'
                              )
                            }
                            className="px-3 py-2 rounded-lg border border-[#DBE6EC] text-xs font-semibold text-rose-700"
                          >
                            Annuler
                          </button>
                        </>
                      )}

                      {activeReservation.statut === 'demandee' && (
                        <>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() =>
                              runAction(
                                () =>
                                  reservationService.confirmerFournisseur(
                                    activeReservation.code,
                                    allBiens
                                  ),
                                'Disponibilité confirmée (accès débloqué dans /suivi)'
                              )
                            }
                            className="px-3 py-2 rounded-lg bg-[#20B8A6] text-[#123B63] text-xs font-semibold"
                          >
                            Confirmer (fournisseur)
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() =>
                              runAction(
                                () =>
                                  reservationService.refuserFournisseur(
                                    activeReservation.code,
                                    allBiens,
                                    'refus'
                                  ),
                                'Refus traité — recherche d’alternative exécutée'
                              )
                            }
                            className="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold"
                          >
                            Refus fournisseur
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() =>
                              runAction(
                                () =>
                                  reservationService.refuserFournisseur(
                                    activeReservation.code,
                                    allBiens,
                                    'timeout'
                                  ),
                                'Silence 30 min simulé — alternative proposée'
                              )
                            }
                            className="px-3 py-2 rounded-lg border border-amber-300 text-amber-800 text-xs font-semibold"
                          >
                            Simuler silence 30 min
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() =>
                              runAction(
                                () =>
                                  reservationService.annuler(
                                    activeReservation.code,
                                    '',
                                    'cerim',
                                    'Annulée par CERIM'
                                  ),
                                'Réservation annulée'
                              )
                            }
                            className="px-3 py-2 rounded-lg border border-[#DBE6EC] text-xs font-semibold text-[#5A7084]"
                          >
                            Annuler
                          </button>
                        </>
                      )}

                      {activeReservation.statut === 'confirmee' && (
                        <>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => openChecklistModal(activeReservation)}
                            className="px-3 py-2 rounded-lg bg-[#20B8A6] text-[#123B63] text-xs font-semibold"
                          >
                            Valider checklist (« Bien prêt »)
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() =>
                              runAction(
                                () =>
                                  reservationService.enregistrerNoShow(activeReservation.code),
                                'No-show enregistré'
                              )
                            }
                            className="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold"
                          >
                            Marquer No-Show
                          </button>
                        </>
                      )}

                      {activeReservation.statut === 'bien_pret' && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              navigate({ page: 'checkin', trackingCode: activeReservation.code })
                            }
                            className="px-3 py-2 rounded-lg bg-[#20B8A6] text-[#123B63] text-xs font-semibold"
                          >
                            Passer au Check-in sur place
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() =>
                              runAction(
                                () =>
                                  reservationService.enregistrerNoShow(activeReservation.code),
                                'No-show enregistré'
                              )
                            }
                            className="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold"
                          >
                            Marquer No-Show
                          </button>
                        </>
                      )}

                      {activeReservation.statut === 'arrivee' && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate({ page: 'checkin', trackingCode: activeReservation.code })
                          }
                          className="px-3 py-2 rounded-lg bg-[#123B63] text-white text-xs font-semibold"
                        >
                          Check-out / Photos après
                        </button>
                      )}

                      {activeReservation.paiementSurPlace && (
                        <button
                          type="button"
                          onClick={() => setReceiptTarget(activeReservation)}
                          className="px-3 py-2 rounded-lg border border-[#123B63] text-[#123B63] text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Receipt className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Voir Reçu</span>
                        </button>
                      )}
                    </div>

                    {/* Simulated reminders for confirmed / ready bookings */}
                    {(activeReservation.statut === 'confirmee' ||
                      activeReservation.statut === 'bien_pret') && (
                      <div className="pt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-[#5A7084] inline-flex items-center gap-1 mr-1">
                          <Bell className="w-3 h-3" aria-hidden="true" />
                          Rappels :
                        </span>
                        {(['rappel_j2', 'rappel_j1', 'rappel_jourj'] as const).map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            disabled={actionBusy}
                            onClick={() =>
                              runAction(
                                () =>
                                  reservationService.envoyerRappelSimule(
                                    activeReservation.code,
                                    kind,
                                    allBiens
                                  ),
                                `Rappel ${kind.replace('rappel_', '').toUpperCase()} journalisé`
                              )
                            }
                            className="px-2 py-1 rounded border border-[#DBE6EC] bg-[#F2F7F9] hover:border-[#20B8A6] text-[11px] font-semibold text-[#123B63]"
                          >
                            {kind === 'rappel_j2' ? 'J-2' : kind === 'rappel_j1' ? 'J-1' : 'Jour J'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Checklist inline panel if opened */}
                  {checklistTargetCode === activeReservation.code && (
                    <div className="p-3.5 rounded-xl bg-[#F2F7F9] border border-[#20B8A6] space-y-3">
                      <p className="text-xs font-semibold text-[#123B63]">
                        Checklist préparatoire ({activeReservation.code})
                      </p>
                      <div className="space-y-1.5">
                        {checklistDraft.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 text-xs text-[#0F2233] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={(e) =>
                                setChecklistDraft((prev) =>
                                  prev.map((x) =>
                                    x.id === item.id ? { ...x, checked: e.target.checked } : x
                                  )
                                )
                              }
                              className="w-4 h-4 accent-[#20B8A6]"
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!checklistDraft.every((i) => i.checked) || actionBusy}
                          onClick={handleSaveChecklist}
                          className="px-3 py-1.5 rounded-lg bg-[#20B8A6] text-[#123B63] text-xs font-semibold disabled:opacity-45"
                        >
                          Confirmer « Bien prêt »
                        </button>
                        <button
                          type="button"
                          onClick={() => setChecklistTargetCode(null)}
                          className="px-3 py-1.5 rounded-lg border border-[#DBE6EC] bg-white text-xs text-[#5A7084]"
                        >
                          Fermer
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Audit Timeline */}
                  <div className="space-y-2 pt-2 border-t border-[#DBE6EC]">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5A7084]">
                      Historique ({activeReservation.historique.length})
                    </p>
                    <ol className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {activeReservation.historique.map((h, i) => (
                        <li
                          key={`${h.date}-${i}`}
                          className="text-xs bg-[#F2F7F9] rounded-lg px-2.5 py-2 border border-[#DBE6EC]"
                        >
                          <div className="flex justify-between gap-2 font-semibold text-[#123B63]">
                            <span>{h.statut}</span>
                            <span className="text-[11px] text-[#5A7084] tabular-nums">
                              {formatDateTimeFr(h.date)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#5A7084]">
                            Par {h.auteur} {h.note ? `— ${h.note}` : ''}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}
            </aside>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIER SLA METRICS */}
      {activeTab === 'fournisseurs' && (
        <section className="bg-white rounded-xl border border-[#DBE6EC] overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-[#DBE6EC] space-y-1">
            <h2 className="text-lg font-semibold text-[#123B63]">
              Suivi de performance fournisseurs (identifiants internes opaques)
            </h2>
            <p className="text-xs text-[#5A7084]">
              Aucun numéro de téléphone fournisseur n’est stocké dans le navigateur. Les indicateurs
              agrègent la réactivité et le respect de la checklist par identifiant opaque.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F2F7F9] border-b border-[#DBE6EC] text-xs font-semibold text-[#5A7084]">
                  <th className="py-3 px-4">Fournisseur ID</th>
                  <th className="py-3 px-4 text-right">Demandes</th>
                  <th className="py-3 px-4 text-right">Confirmées</th>
                  <th className="py-3 px-4 text-right">Taux confirmation</th>
                  <th className="py-3 px-4 text-right">Délai moyen</th>
                  <th className="py-3 px-4 text-right">Refus / Timeouts</th>
                  <th className="py-3 px-4 text-right">Checklists manquantes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DBE6EC] text-sm">
                {supplierMetrics.map((m) => (
                  <tr key={m.fournisseurId} className="hover:bg-[#F2F7F9]/60">
                    <td className="py-3 px-4 font-semibold text-[#123B63]">{m.fournisseurId}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{m.totalDemandes}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#0C7A6D] font-semibold">
                      {m.confirmees}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-[#123B63]">
                      {m.tauxConfirmation}%
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#5A7084]">
                      {m.delaiMoyenMinutes !== null ? `${m.delaiMoyenMinutes} min` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-rose-700 font-medium">
                      {m.refusOuTimeouts}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {m.bienPretManquants > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                          {m.bienPretManquants}
                        </span>
                      ) : (
                        <span className="text-[#0C7A6D]">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: WHATSAPP SIMULATION CONSOLE */}
      {activeTab === 'whatsapp' && (
        <section className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#123B63]">
                Journal des notifications WhatsApp (Mode Aperçu)
              </h2>
              <p className="text-xs text-[#5A7084]">
                Visualisez les envois simultanés (Client + Fournisseur via ID opaque + copie CERIM),
                les rappels J-2 / J-1 / Jour J et les reçus. En production, cet envoi passe par
                l&apos;API Cloud Meta dans <code className="text-[#123B63]">worker/</code>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={waCodeQuery}
                onChange={(e) => setWaCodeQuery(e.target.value)}
                placeholder="Code CER..."
                aria-label="Filtrer par code"
                className="min-h-[38px] px-3 rounded-lg border border-[#DBE6EC] text-xs"
              />
              <select
                value={waRoleFilter}
                onChange={(e) =>
                  setWaRoleFilter(e.target.value as 'tous' | 'client' | 'fournisseur' | 'cerim')
                }
                aria-label="Filtrer par destinataire"
                className="min-h-[38px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-xs font-medium"
              >
                <option value="tous">Tous les destinataires</option>
                <option value="client">Clients</option>
                <option value="fournisseur">Fournisseurs (ID opaque)</option>
                <option value="cerim">Copie CERIM</option>
              </select>
            </div>
          </div>

          {filteredWaLogs.length === 0 ? (
            <p className="text-sm text-[#5A7084]">
              Aucun message simulé enregistré pour le moment.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {filteredWaLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-white border border-[#123B63] text-[#123B63] font-semibold tabular-nums">
                        {log.codeReservation}
                      </span>
                      <span className="font-semibold text-[#0C7A6D] capitalize">
                        {log.destinataireRole}
                      </span>
                      <span className="text-[#5A7084]">· {log.destinataireLabel}</span>
                    </div>
                    <span className="text-[11px] text-[#5A7084] tabular-nums">
                      {formatDateTimeFr(log.date)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#0F2233] leading-relaxed">{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 4: ANALYTICS & SUGGESTIONS & PRIVATE REVIEWS */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          <section className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#123B63]">Répartition des visites par page</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(PAGE_LABELS).map(([key, label]) => {
                const count = analytics.pageViews[key] || 0;
                const pct = totalPageViews > 0 ? Math.round((count / totalPageViews) * 100) : 0;
                return (
                  <div
                    key={key}
                    className="p-3.5 rounded-lg bg-[#F2F7F9] border border-[#DBE6EC] space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#123B63]">{label}</span>
                      <span className="text-[#5A7084] tabular-nums">{pct}%</span>
                    </div>
                    <p className="text-xl font-semibold text-[#123B63] tabular-nums">{count}</p>
                    <progress
                      value={pct}
                      max={100}
                      className="w-full h-1.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-[#DBE6EC] [&::-webkit-progress-value]:bg-[#20B8A6] [&::-moz-progress-bar]:bg-[#20B8A6]"
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#DBE6EC] overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-[#DBE6EC] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-[#123B63]">Interactions par bien</h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={interactionQuery}
                  onChange={(e) => setInteractionQuery(e.target.value)}
                  placeholder="Filtrer matricule, ville..."
                  aria-label="Filtrer les biens"
                  className="min-h-[38px] px-3 rounded-lg border border-[#DBE6EC] text-xs"
                />
                <select
                  value={interactionTypeFilter}
                  onChange={(e) => setInteractionTypeFilter(e.target.value as 'Tous' | BienType)}
                  aria-label="Filtrer par catégorie"
                  className="min-h-[38px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-xs font-medium text-[#123B63]"
                >
                  <option value="Tous">Tous</option>
                  <option value="Appartement">Appartements</option>
                  <option value="Voiture">Voitures</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#DBE6EC] bg-[#F2F7F9] text-xs font-semibold text-[#5A7084]">
                    <th className="py-3 px-4">Bien</th>
                    <th className="py-3 px-4">Ville</th>
                    <th className="py-3 px-4 text-right">Vues</th>
                    <th className="py-3 px-4 text-right">Galerie</th>
                    <th className="py-3 px-4 text-right">Calendrier</th>
                    <th className="py-3 px-4 text-right">Réservations</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Fiche</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DBE6EC] text-sm">
                  {propertyStatsRows.map(({ bien, stats, total }) => {
                    const ratio = Math.round((total / maxPropertyInteractions) * 100);
                    return (
                      <tr key={bien.matricule} className="hover:bg-[#F2F7F9]/60">
                        <td className="py-3 px-4 font-medium text-[#123B63]">
                          [{bien.matricule}] {bien.titre}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#5A7084]">{bien.ville}</td>
                        <td className="py-3 px-4 text-right tabular-nums">{stats.views}</td>
                        <td className="py-3 px-4 text-right tabular-nums">{stats.galleryOpens}</td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {stats.calendarSelections}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold text-[#0C7A6D]">
                          {stats.whatsappClicks}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <progress
                              value={ratio}
                              max={100}
                              className="w-16 h-1.5 rounded-full overflow-hidden hidden sm:inline-block [&::-webkit-progress-bar]:bg-[#DBE6EC] [&::-webkit-progress-value]:bg-[#20B8A6] [&::-moz-progress-bar]:bg-[#20B8A6]"
                            />
                            <span className="font-semibold text-[#123B63] tabular-nums">
                              {total}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => navigate({ page: 'detail', matricule: bien.matricule })}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0C7A6D]"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Voir</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#123B63]">
                Suggestions clients ({filteredSuggestions.length})
              </h2>
              <div className="inline-flex items-center gap-1 p-1 bg-[#F2F7F9] rounded-lg border border-[#DBE6EC]">
                {(['Toutes', 'Nouvelle', 'Lue', 'Traitée'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSuggestionStatusFilter(st)}
                    className={`min-h-[32px] px-3 rounded-md text-xs font-semibold ${
                      suggestionStatusFilter === st
                        ? 'bg-[#123B63] text-white'
                        : 'text-[#5A7084]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredSuggestions.length === 0 ? (
              <p className="text-xs text-[#5A7084]">Aucune suggestion enregistrée.</p>
            ) : (
              <div className="space-y-3">
                {filteredSuggestions.map((sug) => (
                  <div
                    key={sug.id}
                    className="p-4 rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] flex flex-col md:flex-row md:items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[#0C7A6D]">
                        {sug.statut} · {sug.sujet} ({sug.ville})
                      </p>
                      <p className="text-sm text-[#0F2233]">{sug.message}</p>
                      <p className="text-xs text-[#5A7084]">
                        Par {sug.nom} ({sug.contact}) · {formatIsoFr(sug.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {sug.statut !== 'Traitée' && (
                        <button
                          type="button"
                          onClick={() => updateSuggestionStatus(sug.id, 'Traitée')}
                          className="min-h-[34px] px-3 rounded-lg bg-[#20B8A6] text-[#123B63] text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Traitée</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteSuggestion(sug.id)}
                        aria-label="Supprimer"
                        className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg border border-[#DBE6EC] bg-white text-[#5A7084]"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[#123B63]">
                Avis privés après séjour ({reviews.length})
              </h2>
              <p className="text-xs text-[#5A7084]">
                Collectés sur <code className="text-[#123B63]">#/suivi</code> après check-out —
                réservés au suivi qualité interne CERIM (jamais publiés sur le site).
              </p>
            </div>
            {reviews.length === 0 ? (
              <p className="text-xs text-[#5A7084]">Aucun avis reçu pour le moment.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-lg bg-[#F2F7F9] border border-[#DBE6EC] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#123B63]">
                        [{rev.matricule}] {rev.reservationCode || ''}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[#0C7A6D] tabular-nums">
                        <Star className="w-3.5 h-3.5" aria-hidden="true" />
                        {rev.note}/5
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#123B63]">{rev.titre}</p>
                    {rev.commentaire && <p className="text-xs text-[#0F2233]">« {rev.commentaire} »</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 5: CATALOGUE & BLOCKING */}
      {activeTab === 'catalogue' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-6 bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#0C7A6D]" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-[#123B63]">
                  Ajouter un bien au catalogue
                </h2>
              </div>

              <form onSubmit={handleAddListing} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="n-type" className="block text-xs font-semibold text-[#123B63]">
                      Catégorie
                    </label>
                    <select
                      id="n-type"
                      value={newType}
                      onChange={(e) => {
                        const t = e.target.value as BienType;
                        setNewType(t);
                        setNewPeriode(t === 'Appartement' ? 'nuit' : 'jour');
                      }}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm"
                    >
                      <option value="Appartement">Appartement</option>
                      <option value="Voiture">Voiture</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="n-ville" className="block text-xs font-semibold text-[#123B63]">
                      Ville
                    </label>
                    <select
                      id="n-ville"
                      value={newVille}
                      onChange={(e) => setNewVille(e.target.value as BienVille)}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm"
                    >
                      <option value="Brazzaville">Brazzaville</option>
                      <option value="Pointe-Noire">Pointe-Noire</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label htmlFor="n-titre" className="block text-xs font-semibold text-[#123B63]">
                      Titre de l’annonce *
                    </label>
                    <input
                      id="n-titre"
                      type="text"
                      required
                      value={newTitre}
                      onChange={(e) => setNewTitre(e.target.value)}
                      placeholder="Ex: Appartement meublé Bacongo"
                      className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="n-sup" className="block text-xs font-semibold text-[#123B63]">
                      Fournisseur ID (opaque)
                    </label>
                    <input
                      id="n-sup"
                      type="text"
                      required
                      value={newFournisseurId}
                      onChange={(e) => setNewFournisseurId(e.target.value)}
                      placeholder="SUP-01"
                      className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-sm uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="n-quartier" className="block text-xs font-semibold text-[#123B63]">
                      Quartier *
                    </label>
                    <input
                      id="n-quartier"
                      type="text"
                      required
                      value={newQuartier}
                      onChange={(e) => setNewQuartier(e.target.value)}
                      placeholder="Ex: Plateau"
                      className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="n-prix" className="block text-xs font-semibold text-[#123B63]">
                      Prix (FCFA) *
                    </label>
                    <input
                      id="n-prix"
                      type="number"
                      required
                      min={1000}
                      value={newPrix}
                      onChange={(e) => setNewPrix(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-sm tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="n-per" className="block text-xs font-semibold text-[#123B63]">
                      Période
                    </label>
                    <select
                      id="n-per"
                      value={newPeriode}
                      onChange={(e) => setNewPeriode(e.target.value as BienPeriode)}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm"
                    >
                      <option value="nuit">Nuit</option>
                      <option value="jour">Jour</option>
                      <option value="mois">Mois</option>
                    </select>
                  </div>
                </div>

                {newType === 'Appartement' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      aria-label="Chambres"
                      min={1}
                      value={newChambres}
                      onChange={(e) => setNewChambres(e.target.value)}
                      className="min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-sm tabular-nums"
                    />
                    <input
                      type="number"
                      aria-label="Surface m2"
                      min={15}
                      value={newSurface}
                      onChange={(e) => setNewSurface(e.target.value)}
                      className="min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-sm tabular-nums"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      aria-label="Marque"
                      value={newMarque}
                      onChange={(e) => setNewMarque(e.target.value)}
                      className="min-h-[40px] px-2.5 rounded-lg border border-[#DBE6EC] text-xs"
                    />
                    <input
                      type="text"
                      aria-label="Modèle"
                      value={newModele}
                      onChange={(e) => setNewModele(e.target.value)}
                      className="min-h-[40px] px-2.5 rounded-lg border border-[#DBE6EC] text-xs"
                    />
                    <select
                      aria-label="Boîte"
                      value={newBoite}
                      onChange={(e) => setNewBoite(e.target.value as 'Automatique' | 'Manuelle')}
                      className="min-h-[40px] px-2 rounded-lg border border-[#DBE6EC] bg-white text-xs"
                    >
                      <option value="Automatique">Automatique</option>
                      <option value="Manuelle">Manuelle</option>
                    </select>
                    <input
                      type="number"
                      aria-label="Places"
                      min={2}
                      max={9}
                      value={newPlaces}
                      onChange={(e) => setNewPlaces(e.target.value)}
                      className="min-h-[40px] px-2.5 rounded-lg border border-[#DBE6EC] text-xs tabular-nums"
                    />
                  </div>
                )}

                <input
                  type="text"
                  value={newResume}
                  onChange={(e) => setNewResume(e.target.value)}
                  placeholder="Résumé court..."
                  aria-label="Résumé court"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-sm"
                />

                <button
                  type="submit"
                  className="w-full min-h-[46px] rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold transition-colors"
                >
                  Ajouter au catalogue CERIM
                </button>

                {addedMatricule && (
                  <p className="text-xs font-semibold text-[#0C7A6D]">
                    Bien {addedMatricule} ajouté au catalogue.
                  </p>
                )}
              </form>
            </section>

            <section className="lg:col-span-6 bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#0C7A6D]" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-[#123B63]">
                  Bloquer / débloquer des dates
                </h2>
              </div>

              <select
                value={calendarBien?.matricule || ''}
                onChange={(e) => setSelectedCalMatricule(e.target.value)}
                aria-label="Bien sélectionné"
                className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm"
              >
                {allBiens.map((b) => (
                  <option key={b.matricule} value={b.matricule}>
                    {b.matricule} — {b.titre} ({b.fournisseurId})
                  </option>
                ))}
              </select>

              {calendarBien && (
                <AvailabilityCalendar
                  bien={calendarBien}
                  extraBlocked={catalogBlocks[calendarBien.matricule] || []}
                  activeReservations={reservations}
                  mode="block"
                  onToggleBlockDate={(iso) => toggleCatalogBlockDate(calendarBien.matricule, iso)}
                />
              )}
            </section>
          </div>

          <section className="bg-white rounded-xl border border-[#DBE6EC] p-5 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-[#5A7084]">
              Biens ajoutés ({extraBiens.length}) · Réservations suivies ({reservations.length})
            </p>
            <div className="flex items-center gap-2">
              <a
                href={adminWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] inline-flex items-center gap-2 px-4 rounded-lg bg-[#20B8A6] text-[#123B63] text-xs font-semibold"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                <span>Envoyer synthèse WhatsApp CERIM</span>
              </a>
              <button
                type="button"
                onClick={() => navigate({ page: 'recherche' })}
                className="min-h-[40px] inline-flex items-center gap-1 px-3.5 rounded-lg border border-[#DBE6EC] text-xs font-semibold text-[#123B63]"
              >
                <span>Catalogue public</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TAB 6: PARAMÈTRES & LISTE NOIRE */}
      {activeTab === 'parametres' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-6 bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#0C7A6D]" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-[#123B63]">Paramètres opérationnels</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="set-enc"
                  className="block text-xs font-semibold text-[#123B63]"
                >
                  Encaissement sur place par défaut (ENCAISSEMENT_PAR)
                </label>
                <select
                  id="set-enc"
                  value={adminSettings.encaissementPar}
                  onChange={(e) =>
                    updateAdminSettings({
                      encaissementPar: e.target.value as AdminSettings['encaissementPar'],
                    })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm"
                >
                  <option value="CERIM">CERIM (encaissement par équipe CERIM)</option>
                  <option value="FOURNISSEUR">FOURNISSEUR (encaissement sur place)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label htmlFor="set-cancel" className="block text-xs font-semibold text-[#123B63]">
                    Annulation gratuite (h)
                  </label>
                  <input
                    id="set-cancel"
                    type="number"
                    min={1}
                    value={adminSettings.cancellationHours}
                    onChange={(e) =>
                      updateAdminSettings({ cancellationHours: Number(e.target.value) || 24 })
                    }
                    className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="set-oui" className="block text-xs font-semibold text-[#123B63]">
                    Délai OUI client (min)
                  </label>
                  <input
                    id="set-oui"
                    type="number"
                    min={15}
                    value={adminSettings.clientConfirmTimeoutMinutes}
                    onChange={(e) =>
                      updateAdminSettings({
                        clientConfirmTimeoutMinutes: Number(e.target.value) || 120,
                      })
                    }
                    className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="set-sup" className="block text-xs font-semibold text-[#123B63]">
                    Délai fournisseur (min)
                  </label>
                  <input
                    id="set-sup"
                    type="number"
                    min={5}
                    value={adminSettings.supplierTimeoutMinutes}
                    onChange={(e) =>
                      updateAdminSettings({
                        supplierTimeoutMinutes: Number(e.target.value) || 30,
                      })
                    }
                    className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="lg:col-span-6 bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-[#123B63]">
                Liste noire anti no-show ({blacklist.length})
              </h2>
            </div>

            <form onSubmit={handleAddBlacklist} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <input
                type="tel"
                required
                value={blPhone}
                onChange={(e) => setBlPhone(e.target.value)}
                placeholder="+242 06 ..."
                aria-label="Numéro à bloquer"
                className="sm:col-span-2 min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-xs tabular-nums"
              />
              <input
                type="text"
                value={blMotif}
                onChange={(e) => setBlMotif(e.target.value)}
                placeholder="Motif (ex: No-show répété)"
                aria-label="Motif du blocage"
                className="sm:col-span-2 min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-xs"
              />
              <button
                type="submit"
                className="min-h-[42px] px-3 rounded-lg bg-[#123B63] text-white text-xs font-semibold hover:bg-[#0B2A47]"
              >
                Bloquer
              </button>
            </form>

            {blacklist.length === 0 ? (
              <p className="text-xs text-[#5A7084]">
                Aucun numéro bloqué. Les numéros ajoutés ici reçoivent le message neutre «
                Réservation impossible, contactez CERIM ».
              </p>
            ) : (
              <div className="space-y-2">
                {blacklist.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-lg bg-[#F2F7F9] border border-[#DBE6EC] flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#123B63] tabular-nums">
                        {entry.telephone}
                      </p>
                      <p className="text-[11px] text-[#5A7084]">
                        {entry.motif} · {formatIsoFr(entry.ajouteLe)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromBlacklist(entry.id)}
                      className="min-h-[34px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-xs font-semibold text-[#123B63] hover:border-rose-300 hover:text-rose-700"
                    >
                      Débloquer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <ReceiptModal
        reservation={receiptTarget}
        isOpen={Boolean(receiptTarget)}
        onClose={() => setReceiptTarget(null)}
      />
    </div>
  );
};
