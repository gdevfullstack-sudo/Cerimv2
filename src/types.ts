export type TypeBien = 'Appartement' | 'Voiture';
export type BienType = TypeBien;
export type BienStatut = 'Vedette' | 'Nouveau' | 'Populaire';
export type PeriodeTarif = 'nuit' | 'jour' | 'mois';
export type BienPeriode = PeriodeTarif;
export type BienVille = 'Brazzaville' | 'Pointe-Noire';

export interface PlageDates {
  debut: string; // ISO YYYY-MM-DD, bornes incluses
  fin: string; // ISO YYYY-MM-DD, bornes incluses
}

export type DateRange = PlageDates;

export interface BienBase {
  matricule: string;
  type: TypeBien;
  statut: BienStatut;
  titre: string;
  prix: number; // FCFA
  devise: 'FCFA';
  periode: PeriodeTarif;
  ville: BienVille;
  quartier: string; // jamais l'adresse exacte côté public
  resume: string;
  description: string;
  photos: string[];
  localisation: {
    lat: number;
    lng: number;
  };
  reservations: PlageDates[];
  bloques: string[];
  date_publication: string;
  fournisseurId: string; // identifiant interne opaque, jamais affiché au client
}

export interface AppartementBien extends BienBase {
  type: 'Appartement';
  chambres: number;
  surface: number;
}

export interface VoitureBien extends BienBase {
  type: 'Voiture';
  marque: string;
  modele: string;
  annee: number;
  boite: 'Automatique' | 'Manuelle';
  carburant: 'Essence' | 'Diesel' | 'Hybride';
  places: number;
}

export type Bien = AppartementBien | VoitureBien;

export type StatutReservation =
  | 'en_attente_client' // demande reçue, le client doit répondre « OUI »
  | 'demandee' // client confirmé, en attente du fournisseur
  | 'confirmee' // le fournisseur a confirmé
  | 'bien_pret' // le fournisseur a validé la checklist
  | 'arrivee' // check-in effectué
  | 'terminee'
  | 'annulee'
  | 'refusee'
  | 'no_show';

export type ReservationAuteur = 'client' | 'cerim' | 'fournisseur' | 'systeme';

export interface ReservationHistoriqueEntry {
  statut: StatutReservation;
  date: string;
  auteur: ReservationAuteur;
  note?: string;
}

export interface ChecklistItemState {
  id: string;
  label: string;
  checked: boolean;
}

export interface ChecklistValidation {
  valideeLe: string;
  items: ChecklistItemState[];
}

export interface PaiementSurPlace {
  montant: number;
  mode: 'Especes' | 'Mobile Money sur place';
  encaissePar: 'CERIM' | 'FOURNISSEUR';
  date: string;
}

export interface PhotosEtat {
  avant: string[];
  apres: string[];
}

export interface Reservation {
  id: string;
  code: string; // ex. CER-AP1-0042
  matricule: string;
  titre: string;
  ville: BienVille;
  quartier: string;
  client: {
    nom: string;
    prenom?: string;
    telephone: string;
    pieceIdentite?: string; // DataURL compressée <= 1 Mo
    message?: string;
  };
  debut: string;
  fin: string;
  dureeLabel: string;
  totalEstime: number;
  creneauArrivee?: string; // ex. « 14h–16h »
  statut: StatutReservation;
  historique: ReservationHistoriqueEntry[];
  alternativePropose?: string; // matricule d'un bien équivalent
  remplacementDeCode?: string;
  checklist?: ChecklistValidation;
  paiementSurPlace?: PaiementSurPlace;
  photosEtat?: PhotosEtat;
  expiresAt?: string; // ISO expiry pour double confirmation client (2h)
  supplierDeadlineAt?: string; // ISO deadline réponse fournisseur (30 min)
  avisDemande?: boolean;
  creeLe: string;
}

export interface AccesInfo {
  adresseExacte: string;
  consignesAcces: string;
  pointRendezVous: string;
  contactCerim: string;
}

export interface WhatsAppSimLog {
  id: string;
  codeReservation: string;
  destinataireRole: 'client' | 'fournisseur' | 'cerim';
  destinataireLabel: string; // jamais de vrai numéro fournisseur affiché
  categorie:
    | 'demande_oui'
    | 'notification_creation'
    | 'rappel_j2'
    | 'rappel_j1'
    | 'rappel_jourj'
    | 'confirmation'
    | 'remplacement'
    | 'annulation'
    | 'recu_paiement';
  message: string;
  date: string;
}

export interface AdminSettings {
  cancellationHours: number; // défaut: 24h
  clientConfirmTimeoutMinutes: number; // défaut: 120 min (2h)
  supplierTimeoutMinutes: number; // défaut: 30 min
  encaissementPar: 'CERIM' | 'FOURNISSEUR'; // configurable Lot 3.2
}

export interface BlacklistEntry {
  id: string;
  telephone: string;
  motif: string;
  ajouteLe: string;
}

export interface SupplierMetrics {
  fournisseurId: string;
  totalDemandes: number;
  confirmees: number;
  tauxConfirmation: number;
  refusOuTimeouts: number;
  bienPretManquants: number;
  delaiMoyenMinutes: number | null;
}

export interface ReviewRecord {
  id: string;
  reservationId: string;
  reservationCode?: string;
  matricule: string;
  titre: string;
  note: number; // 1 à 5
  commentaire: string;
  date: string;
  statut: 'en attente'; // modération back-office uniquement, jamais publié sur le site
}

export interface VisitHistoryItem {
  matricule: string;
  visitedAt: string;
}

export type SearchSortOption =
  | 'recommandes'
  | 'prix-asc'
  | 'prix-desc'
  | 'chambres-desc'
  | 'chambres-asc'
  | 'carburant'
  | 'recents'
  | 'anciens';

export interface SearchFilters {
  type: 'Tous' | TypeBien;
  ville: 'Toutes' | BienVille;
  budgetMax: number | null;
  debut: string;
  fin: string;
  sort: SearchSortOption;
  chambresMin?: number | null;
  carburant?: 'Tous' | 'Essence' | 'Diesel' | 'Hybride';
  boite?: 'Toutes' | 'Automatique' | 'Manuelle';
}

export type InteractionKind = 'views' | 'galleryOpens' | 'calendarSelections' | 'whatsappClicks';

export interface PropertyInteractionStats {
  views: number;
  galleryOpens: number;
  calendarSelections: number;
  whatsappClicks: number;
  lastInteractionAt: string;
}

export interface PlatformAnalytics {
  totalVisits: number;
  pageViews: Record<string, number>;
  dailyVisits: Record<string, number>;
}

export interface ClientSuggestion {
  id: string;
  nom: string;
  contact: string;
  ville: 'Brazzaville' | 'Pointe-Noire' | 'Autre';
  sujet: string;
  matricule?: string;
  message: string;
  date: string;
  statut: 'Nouvelle' | 'Lue' | 'Traitée';
}

export type ToastType = 'success' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

export type LegalTab = 'cgv' | 'cgu' | 'confidentialite' | 'cookies' | 'mentions';

export interface CookieConsentState {
  essential: true;
  analytics: boolean;
  updatedAt: string;
}
