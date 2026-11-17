import {
  AccesInfo,
  AdminSettings,
  Bien,
  BlacklistEntry,
  ChecklistItemState,
  PaiementSurPlace,
  Reservation,
  ReservationAuteur,
  StatutReservation,
  SupplierMetrics,
  TypeBien,
  WhatsAppSimLog,
} from '../types';
import { CERIM_WHATSAPP_DISPLAY } from '../data/biens';
import {
  computeEstimate,
  formatFcfa,
  formatIsoFr,
  getPhoneLast4,
  hoursUntilArrival,
  isRangeAvailable,
  normalizePhoneDigits,
  validateInternationalPhone,
} from '../utils/dataHelpers';
import {
  loadAdminSettings,
  loadBlacklist,
  loadCatalogBlocks,
  loadReservations,
  loadWhatsAppLogs,
  saveAdminSettings,
  saveBlacklist,
  saveReservations,
  saveWhatsAppLogs,
} from '../utils/storage';

// Transitions strictement autorisées par le modèle métier CERIM
export const ALLOWED_TRANSITIONS: Record<StatutReservation, ReadonlyArray<StatutReservation>> = {
  en_attente_client: ['demandee', 'annulee'],
  demandee: ['confirmee', 'refusee', 'annulee'],
  confirmee: ['bien_pret', 'annulee', 'no_show'],
  bien_pret: ['arrivee', 'annulee', 'no_show'],
  arrivee: ['terminee'],
  terminee: [],
  annulee: [],
  refusee: [],
  no_show: [],
};

export function isTransitionAllowed(from: StatutReservation, to: StatutReservation): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getChecklistTemplate(type: TypeBien): ChecklistItemState[] {
  if (type === 'Appartement') {
    return [
      { id: 'propre', label: 'Logement propre et linge préparé', checked: false },
      { id: 'cles', label: 'Clés disponibles pour la remise', checked: false },
      { id: 'eau_elec', label: 'Eau & électricité vérifiées', checked: false },
      { id: 'clim', label: 'Climatisation fonctionnelle', checked: false },
      { id: 'wifi', label: 'Wi-Fi opérationnel', checked: false },
    ];
  }
  return [
    { id: 'propre', label: 'Véhicule propre (intérieur & extérieur)', checked: false },
    { id: 'carburant', label: 'Plein de carburant effectué', checked: false },
    { id: 'documents', label: 'Documents à bord (carte grise, assurance)', checked: false },
    { id: 'pneus_niveaux', label: 'Pneus & niveaux vérifiés', checked: false },
    { id: 'cles', label: 'Clés principales et double disponibles', checked: false },
  ];
}

// Base d'accès confidentielle côté serveur uniquement (jamais exposée dans BIENS_DATA)
// En aperçu, ce registre simule la réponse protégée GET /api/reservations/:code (statut >= confirmee).
const MOCK_PRIVATE_ACCESS_STORE: Record<string, Omit<AccesInfo, 'contactCerim'>> = {
  AP1: {
    adresseExacte: 'Immeuble Le Fleuve, Avenue de la République (accès B), Plateau — Brazzaville',
    consignesAcces: 'Présentez votre code CERIM au poste de sécurité à l’entrée principale.',
    pointRendezVous: 'Hall d’accueil Immeuble Le Fleuve, à l’heure de votre créneau.',
  },
  AP2: {
    adresseExacte: 'Résidence Océane, Boulevard de la Côte Sauvage (lot 14) — Pointe-Noire',
    consignesAcces: 'Le gardien CERIM vous remettra le badge du portail et les clés.',
    pointRendezVous: 'Portail principal Résidence Océane.',
  },
  AP3: {
    adresseExacte: 'Allée de la Corniche, Résidence Mpila Est (Appt 4B) — Brazzaville',
    consignesAcces: 'Sonnez à l’interphone CERIM puis présentez votre pièce d’identité.',
    pointRendezVous: 'Entrée de la résidence côté Corniche.',
  },
  AP4: {
    adresseExacte: 'Avenue Charles-de-Gaulle, Résidence Horizon (3e étage) — Pointe-Noire',
    consignesAcces: 'Parking intérieur sécurisé inclus sur présentation de votre QR code.',
    pointRendezVous: 'Accueil de la Résidence Horizon.',
  },
  VO1: {
    adresseExacte: 'Point de remise CERIM Centre-ville / Hall Départ Aéroport Maya-Maya — Brazzaville',
    consignesAcces: 'Inspection visuelle et état des lieux photos avant remise des clés.',
    pointRendezVous: 'Espace d’accueil CERIM Maya-Maya ou Centre-ville selon votre créneau.',
  },
  VO2: {
    adresseExacte: 'Station TotalEnergies Moungali — Point de remise CERIM — Brazzaville',
    consignesAcces: 'Inspection et règlement sur place avant départ avec votre code CERIM.',
    pointRendezVous: 'Espace client à proximité de l’entrée principale.',
  },
  VO3: {
    adresseExacte: 'Point de remise CERIM Loandjili — Avenue de l’Indépendance — Pointe-Noire',
    consignesAcces: 'Vérification du plein et des papiers à bord lors du check-in.',
    pointRendezVous: 'Esplanade de la station partenaire CERIM Loandjili.',
  },
  VO4: {
    adresseExacte: 'Point de remise CERIM Rond-point Kassai — Centre-ville — Pointe-Noire',
    consignesAcces: 'Remise des clés après validation de la pièce d’identité et paiement sur place.',
    pointRendezVous: 'Rond-point Kassai côté centre-ville.',
  },
};

export interface CreateReservationInput {
  bien: Bien;
  nom: string;
  prenom: string;
  telephone: string;
  debut: string;
  fin: string;
  creneauArrivee: string;
  message?: string;
  pieceIdentite?: string;
  accepteCgv: boolean;
  honeypot?: string;
  remplacementDeCode?: string;
}

export interface CreateReservationResult {
  reservation: Reservation;
}

export interface ConsultReservationResult {
  reservation: Reservation;
  bien?: Bien;
  alternatives: Bien[];
}

export interface CancelReservationResult {
  reservation: Reservation;
  gratuite: boolean;
  message: string;
}

export interface ReservationGateway {
  creerReservation(
    input: CreateReservationInput,
    allBiens: Bien[]
  ): Promise<CreateReservationResult>;
  confirmerClient(code: string, allBiens: Bien[]): Promise<Reservation>;
  consulter(code: string, tel4: string, allBiens: Bien[]): Promise<ConsultReservationResult>;
  getAcces(code: string, tel4: string): Promise<AccesInfo | null>;
  annuler(
    code: string,
    tel4: string,
    auteur?: ReservationAuteur,
    motif?: string
  ): Promise<CancelReservationResult>;
  ajouterPieceIdentite(code: string, tel4: string, dataUrl: string): Promise<Reservation>;
  confirmerFournisseur(code: string, allBiens: Bien[]): Promise<Reservation>;
  refuserFournisseur(
    code: string,
    allBiens: Bien[],
    raison?: 'refus' | 'timeout'
  ): Promise<Reservation>;
  validerChecklist(
    code: string,
    items: ChecklistItemState[],
    allBiens: Bien[]
  ): Promise<Reservation>;
  repondreAlternative(
    code: string,
    tel4: string,
    accepter: boolean,
    allBiens: Bien[]
  ): Promise<{ original: Reservation; nouvelle?: Reservation }>;
  enregistrerArrivee(params: {
    code: string;
    photosAvant: string[];
    paiement: Omit<PaiementSurPlace, 'date'>;
    allBiens: Bien[];
  }): Promise<Reservation>;
  terminerSejour(params: { code: string; photosApres: string[] }): Promise<Reservation>;
  enregistrerNoShow(code: string, note?: string): Promise<Reservation>;
  envoyerRappelSimule(
    code: string,
    typeRappel: 'rappel_j2' | 'rappel_j1' | 'rappel_jourj',
    allBiens: Bien[]
  ): Promise<WhatsAppSimLog[]>;
  purgeExpired(allBiens: Bien[]): Promise<number>;
}

const MAX_ACTIVE_PENDING_PER_PHONE = 2;

function applySafeTransition(
  res: Reservation,
  nextStatut: StatutReservation,
  auteur: ReservationAuteur,
  note?: string
): Reservation {
  if (!isTransitionAllowed(res.statut, nextStatut)) {
    console.warn(
      `[CERIM Audit] Transition refusée sur ${res.code} : ${res.statut} -> ${nextStatut} (auteur: ${auteur})`
    );
    throw new Error(`Transition de statut non autorisée (${res.statut} → ${nextStatut}).`);
  }
  const nowIso = new Date().toISOString();
  return {
    ...res,
    statut: nextStatut,
    historique: [
      ...res.historique,
      {
        statut: nextStatut,
        date: nowIso,
        auteur,
        ...(note ? { note } : {}),
      },
    ],
  };
}

function generateUniqueCode(matricule: string, existing: Reservation[]): string {
  const used = new Set(existing.map((r) => r.code.toUpperCase()));
  for (let i = 0; i < 40; i++) {
    const num = String(Math.floor(1 + Math.random() * 9999)).padStart(4, '0');
    const candidate = `CER-${matricule}-${num}`;
    if (!used.has(candidate)) return candidate;
  }
  return `CER-${matricule}-${Date.now().toString().slice(-4)}`;
}

function findEquivalentAlternatives(
  sourceBien: Bien,
  debut: string,
  fin: string,
  allBiens: Bien[],
  allReservations: Reservation[]
): Bien[] {
  const minPrice = sourceBien.prix * 0.8;
  const maxPrice = sourceBien.prix * 1.2;
  const blockedMap = loadCatalogBlocks();

  return allBiens
    .filter((b) => {
      if (b.matricule === sourceBien.matricule) return false;
      if (b.type !== sourceBien.type) return false;
      if (b.ville !== sourceBien.ville) return false;
      if (b.prix < minPrice || b.prix > maxPrice) return false;
      const extra = blockedMap[b.matricule] || [];
      return isRangeAvailable(b, debut, fin, extra, allReservations);
    })
    .sort((a, b) => Math.abs(a.prix - sourceBien.prix) - Math.abs(b.prix - sourceBien.prix));
}

function appendWaLogs(newLogs: WhatsAppSimLog[]): void {
  const existing = loadWhatsAppLogs();
  saveWhatsAppLogs([...newLogs, ...existing]);
}

function makeLogId(): string {
  return `wa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildSimultaneousDispatchLogs(
  res: Reservation,
  bien: Bien | undefined
): WhatsAppSimLog[] {
  const now = new Date().toISOString();
  const clientFirstName = res.client.prenom?.trim() || res.client.nom.split(' ')[0] || 'Client';
  const supplierId = bien?.fournisseurId || 'SUP-INTERNE';
  const periodStr =
    res.debut === res.fin
      ? formatIsoFr(res.debut)
      : `${formatIsoFr(res.debut)} → ${formatIsoFr(res.fin)}`;

  return [
    {
      id: makeLogId(),
      codeReservation: res.code,
      destinataireRole: 'client',
      destinataireLabel: `Client (${res.client.nom})`,
      categorie: 'notification_creation',
      message: `CERIM · Demande ${res.code} confirmée par vos soins pour ${bien?.titre || res.titre} (${periodStr}, créneau ${res.creneauArrivee || 'à préciser'}). Estimation : ${formatFcfa(res.totalEstime)} — paiement sur place à votre arrivée. Notre équipe revient vers vous sous 30 min.`,
      date: now,
    },
    {
      id: makeLogId(),
      codeReservation: res.code,
      destinataireRole: 'fournisseur',
      destinataireLabel: `Fournisseur [${supplierId}] (numéro masqué côté client)`,
      categorie: 'notification_creation',
      message: `CERIM · Demande ${res.code} sur votre bien ${res.matricule} : client ${clientFirstName}, dates ${periodStr}, arrivée prévue ${res.creneauArrivee || 'non précisée'}. Merci de répondre CONFIRMER ou REFUSER sous 30 min.`,
      date: now,
    },
    {
      id: makeLogId(),
      codeReservation: res.code,
      destinataireRole: 'cerim',
      destinataireLabel: 'Équipe CERIM (copie de contrôle)',
      categorie: 'notification_creation',
      message: `[SUIVI CERIM] Dossier ${res.code} (${res.matricule} / ${supplierId}) transmis au fournisseur. Période ${periodStr} · Créneau ${res.creneauArrivee || '—'} · Total sur place ${formatFcfa(res.totalEstime)}.`,
      date: now,
    },
  ];
}

export class MockGateway implements ReservationGateway {
  async purgeExpired(allBiens: Bien[]): Promise<number> {
    const now = Date.now();
    const list = loadReservations();
    let changed = 0;

    const updated = list.map((res) => {
      if (res.statut === 'en_attente_client' && res.expiresAt) {
        if (new Date(res.expiresAt).getTime() <= now) {
          changed++;
          const next = applySafeTransition(
            res,
            'annulee',
            'systeme',
            'Expirée automatiquement (aucune confirmation OUI sous 2 heures).'
          );
          appendWaLogs([
            {
              id: makeLogId(),
              codeReservation: next.code,
              destinataireRole: 'client',
              destinataireLabel: `Client (${next.client.nom})`,
              categorie: 'annulation',
              message: `CERIM · Votre demande ${next.code} a expiré faute de réponse OUI sous 2h. Les dates ont été libérées.`,
              date: new Date().toISOString(),
            },
          ]);
          return next;
        }
      }
      if (res.statut === 'demandee' && res.supplierDeadlineAt && !res.alternativePropose) {
        if (new Date(res.supplierDeadlineAt).getTime() <= now) {
          changed++;
          const bien = allBiens.find((b) => b.matricule === res.matricule);
          const alts = bien
            ? findEquivalentAlternatives(bien, res.debut, res.fin, allBiens, list)
            : [];
          const next = applySafeTransition(
            res,
            'refusee',
            'systeme',
            'Aucune réponse fournisseur dans le délai imparti (30 min).'
          );
          if (alts[0]) {
            next.alternativePropose = alts[0].matricule;
          }
          return next;
        }
      }
      return res;
    });

    if (changed > 0) {
      saveReservations(updated);
    }
    return changed;
  }

  async creerReservation(
    input: CreateReservationInput,
    allBiens: Bien[]
  ): Promise<CreateReservationResult> {
    if (input.honeypot && input.honeypot.trim().length > 0) {
      throw new Error('Requête rejetée.');
    }

    await this.purgeExpired(allBiens);

    if (!input.accepteCgv) {
      throw new Error(
        'Vous devez accepter les CGV et la politique d’annulation avant de réserver.'
      );
    }
    if (!input.nom.trim() || !input.prenom.trim()) {
      throw new Error('Veuillez renseigner votre nom et votre prénom.');
    }

    const phoneValidation = validateInternationalPhone(input.telephone);
    if (!phoneValidation.valid) {
      throw new Error(phoneValidation.error || 'Numéro international invalide.');
    }
    const normalizedPhone = phoneValidation.normalized;
    const digits = normalizePhoneDigits(normalizedPhone);

    // Vérification liste noire (message neutre obligatoire)
    const blacklist = loadBlacklist();
    const isBlocked = blacklist.some(
      (entry) => normalizePhoneDigits(entry.telephone) === digits
    );
    if (isBlocked) {
      throw new Error('Réservation impossible, contactez CERIM.');
    }

    const existing = loadReservations();

    // Limite anti-abus : max 2 réservations en attente par numéro
    const pendingCount = existing.filter(
      (r) =>
        normalizePhoneDigits(r.client.telephone) === digits &&
        (r.statut === 'en_attente_client' || r.statut === 'demandee')
    ).length;

    if (pendingCount >= MAX_ACTIVE_PENDING_PER_PHONE && !input.remplacementDeCode) {
      throw new Error(
        `Limite atteinte : vous avez déjà ${MAX_ACTIVE_PENDING_PER_PHONE} réservations en attente avec ce numéro. Confirmez ou annulez une demande existante avant d’en créer une nouvelle.`
      );
    }

    // Disponibilité réelle (hors créneaux expirés)
    const blockedMap = loadCatalogBlocks();
    const extraBlocked = blockedMap[input.bien.matricule] || [];
    if (!isRangeAvailable(input.bien, input.debut, input.fin, extraBlocked, existing)) {
      throw new Error(
        'Ces dates ne sont plus disponibles sur ce bien. Choisissez une autre période.'
      );
    }

    const settings = loadAdminSettings();
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(
      now.getTime() + settings.clientConfirmTimeoutMinutes * 60 * 1000
    ).toISOString();

    const est = computeEstimate(input.bien.prix, input.bien.periode, input.debut, input.fin);
    const code = generateUniqueCode(input.bien.matricule, existing);

    const created: Reservation = {
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      matricule: input.bien.matricule,
      titre: input.bien.titre,
      ville: input.bien.ville,
      quartier: input.bien.quartier,
      client: {
        nom: `${input.prenom.trim()} ${input.nom.trim()}`.trim(),
        prenom: input.prenom.trim(),
        telephone: normalizedPhone,
        ...(input.pieceIdentite ? { pieceIdentite: input.pieceIdentite } : {}),
        ...(input.message?.trim() ? { message: input.message.trim() } : {}),
      },
      debut: input.debut,
      fin: input.fin,
      dureeLabel: est.dureeLabel,
      totalEstime: est.total,
      creneauArrivee: input.creneauArrivee,
      statut: 'en_attente_client',
      historique: [
        {
          statut: 'en_attente_client',
          date: nowIso,
          auteur: 'client',
          note: input.remplacementDeCode
            ? `Créée suite à proposition d'alternative pour ${input.remplacementDeCode}`
            : 'Demande créée — en attente de réponse « OUI » du client (sous 2h).',
        },
      ],
      ...(input.remplacementDeCode ? { remplacementDeCode: input.remplacementDeCode } : {}),
      expiresAt,
      creeLe: nowIso,
    };

    saveReservations([created, ...existing]);

    appendWaLogs([
      {
        id: makeLogId(),
        codeReservation: created.code,
        destinataireRole: 'client',
        destinataireLabel: `Client (${created.client.nom})`,
        categorie: 'demande_oui',
        message: `CERIM · Votre demande ${created.code} pour ${input.bien.titre} est enregistrée (paiement sur place : ${formatFcfa(created.totalEstime)}). Répondez « OUI » sous 2 heures pour la valider.`,
        date: nowIso,
      },
    ]);

    return { reservation: created };
  }

  async confirmerClient(code: string, allBiens: Bien[]): Promise<Reservation> {
    await this.purgeExpired(allBiens);
    const list = loadReservations();
    const idx = list.findIndex((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (idx === -1) throw new Error('Réservation introuvable.');

    const current = list[idx];
    const settings = loadAdminSettings();
    const next = applySafeTransition(
      current,
      'demandee',
      'client',
      'Le client a confirmé sa demande (« OUI »).'
    );
    next.supplierDeadlineAt = new Date(
      Date.now() + settings.supplierTimeoutMinutes * 60 * 1000
    ).toISOString();

    const updatedList = [...list];
    updatedList[idx] = next;
    saveReservations(updatedList);

    const bien = allBiens.find((b) => b.matricule === next.matricule);
    appendWaLogs(buildSimultaneousDispatchLogs(next, bien));

    return next;
  }

  async consulter(
    code: string,
    tel4: string,
    allBiens: Bien[]
  ): Promise<ConsultReservationResult> {
    await this.purgeExpired(allBiens);
    const cleanCode = code.trim().toUpperCase();
    const cleanTel4 = tel4.replace(/[^\d]/g, '');
    if (!cleanCode || cleanTel4.length !== 4) {
      throw new Error('Indiquez votre code de réservation et les 4 derniers chiffres du téléphone.');
    }

    const list = loadReservations();
    const found = list.find((r) => r.code.toUpperCase() === cleanCode);
    if (!found || getPhoneLast4(found.client.telephone) !== cleanTel4) {
      throw new Error('Aucune réservation ne correspond à ce code et ces 4 derniers chiffres.');
    }

    const bien = allBiens.find((b) => b.matricule === found.matricule);
    const alternatives =
      found.statut === 'refusee' && bien
        ? findEquivalentAlternatives(bien, found.debut, found.fin, allBiens, list)
        : [];

    return { reservation: found, bien, alternatives };
  }

  async getAcces(code: string, tel4: string): Promise<AccesInfo | null> {
    const cleanCode = code.trim().toUpperCase();
    const cleanTel4 = tel4.replace(/[^\d]/g, '');
    const list = loadReservations();
    const found = list.find((r) => r.code.toUpperCase() === cleanCode);
    if (!found || getPhoneLast4(found.client.telephone) !== cleanTel4) {
      return null;
    }

    // L'adresse exacte n'est accessible qu'à partir du statut 'confirmee'
    const allowed: StatutReservation[] = ['confirmee', 'bien_pret', 'arrivee', 'terminee'];
    if (!allowed.includes(found.statut)) {
      return null;
    }

    const privateInfo = MOCK_PRIVATE_ACCESS_STORE[found.matricule] || {
      adresseExacte: `${found.quartier}, ${found.ville} — Adresse communiquée par votre référent CERIM`,
      consignesAcces: 'Présentez votre code et votre QR code à votre arrivée.',
      pointRendezVous: `Point de rendez-vous CERIM (${found.quartier}, ${found.ville}).`,
    };

    return {
      ...privateInfo,
      contactCerim: CERIM_WHATSAPP_DISPLAY,
    };
  }

  async annuler(
    code: string,
    tel4: string,
    auteur: ReservationAuteur = 'client',
    motif?: string
  ): Promise<CancelReservationResult> {
    const list = loadReservations();
    const idx = list.findIndex((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (idx === -1) throw new Error('Réservation introuvable.');

    const current = list[idx];
    if (auteur === 'client' && getPhoneLast4(current.client.telephone) !== tel4.replace(/[^\d]/g, '')) {
      throw new Error('Vérification téléphonique invalide.');
    }

    const settings = loadAdminSettings();
    const hrsLeft = hoursUntilArrival(current.debut);

    if (
      auteur === 'client' &&
      (current.statut === 'confirmee' || current.statut === 'bien_pret') &&
      hrsLeft < settings.cancellationHours
    ) {
      const noShowRes = applySafeTransition(
        current,
        'no_show',
        'client',
        `Annulation tardive (< ${settings.cancellationHours}h avant arrivée) — no-show enregistré.`
      );
      const updated = [...list];
      updated[idx] = noShowRes;
      saveReservations(updated);
      appendWaLogs([
        {
          id: makeLogId(),
          codeReservation: noShowRes.code,
          destinataireRole: 'cerim',
          destinataireLabel: 'Équipe CERIM (alerte annulation tardive)',
          categorie: 'annulation',
          message: `[ALERTE < ${settings.cancellationHours}H] ${noShowRes.code} passée en no-show suite à une annulation tardive.`,
          date: new Date().toISOString(),
        },
      ]);
      return {
        reservation: noShowRes,
        gratuite: false,
        message: `Délai d’annulation gratuite dépassé (< ${settings.cancellationHours}h avant l’arrivée). Un no-show a été enregistré ; contactez CERIM si besoin.`,
      };
    }

    const cancelled = applySafeTransition(
      current,
      'annulee',
      auteur,
      motif || 'Annulation gratuite dans les délais autorisés.'
    );
    const updated = [...list];
    updated[idx] = cancelled;
    saveReservations(updated);

    appendWaLogs([
      {
        id: makeLogId(),
        codeReservation: cancelled.code,
        destinataireRole: 'client',
        destinataireLabel: `Client (${cancelled.client.nom})`,
        categorie: 'annulation',
        message: `CERIM · Votre réservation ${cancelled.code} a bien été annulée sans frais.`,
        date: new Date().toISOString(),
      },
      {
        id: makeLogId(),
        codeReservation: cancelled.code,
        destinataireRole: 'fournisseur',
        destinataireLabel: `Fournisseur (${cancelled.matricule})`,
        categorie: 'annulation',
        message: `CERIM · La réservation ${cancelled.code} sur ${cancelled.matricule} a été annulée. Les dates sont de nouveau libres.`,
        date: new Date().toISOString(),
      },
    ]);

    return {
      reservation: cancelled,
      gratuite: true,
      message: 'Réservation annulée gratuitement. Les dates ont été libérées.',
    };
  }

  async ajouterPieceIdentite(
    code: string,
    tel4: string,
    dataUrl: string
  ): Promise<Reservation> {
    const list = loadReservations();
    const idx = list.findIndex((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (idx === -1) throw new Error('Réservation introuvable.');
    const current = list[idx];
    if (getPhoneLast4(current.client.telephone) !== tel4.replace(/[^\d]/g, '')) {
      throw new Error('Vérification téléphonique invalide.');
    }
    const updatedRes: Reservation = {
      ...current,
      client: {
        ...current.client,
        pieceIdentite: dataUrl,
      },
    };
    const updated = [...list];
    updated[idx] = updatedRes;
    saveReservations(updated);
    return updatedRes;
  }

  async confirmerFournisseur(code: string, allBiens: Bien[]): Promise<Reservation> {
    const list = loadReservations();
    const idx = list.findIndex((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (idx === -1) throw new Error('Réservation introuvable.');

    const current = list[idx];
    const next = applySafeTransition(
      current,
      'confirmee',
      'fournisseur',
      'Disponibilité confirmée par le fournisseur.'
    );
    const bien = allBiens.find((b) => b.matricule === next.matricule);
    next.checklist = {
      valideeLe: '',
      items: getChecklistTemplate(bien?.type || 'Appartement'),
    };

    const updated = [...list];
    updated[idx] = next;
    saveReservations(updated);

    appendWaLogs([
      {
        id: makeLogId(),
        codeReservation: next.code,
        destinataireRole: 'client',
        destinataireLabel: `Client (${next.client.nom})`,
        categorie: 'confirmation',
        message: `CERIM · Bonne nouvelle ! Votre réservation ${next.code} (${next.titre}) est CONFIRMÉE. Consultez l'adresse exacte et votre QR code dans /suivi. Paiement sur place : ${formatFcfa(next.totalEstime)}.`,
        date: new Date().toISOString(),
      },
    ]);

    return next;
  }

  async refuserFournisseur(
    code: string,
    allBiens: Bien[],
    raison: 'refus' | 'timeout' = 'refus'
  ): Promise<Reservation> {
    const list = loadReservations();
    const idx = list.findIndex((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (idx === -1) throw new Error('Réservation introuvable.');

    const current = list[idx];
    const next = applySafeTransition(
      current,
      'refusee',
      raison === 'timeout' ? 'systeme' : 'fournisseur',
      raison === 'timeout'
        ? 'Délai fournisseur (30 min) dépassé — recherche automatique d’alternative.'
        : 'Bien indisponible signalé par le fournisseur.'
    );

    const bien = allBiens.find((b) => b.matricule === next.matricule);
    const alternatives = bien
      ? findEquivalentAlternatives(bien, next.debut, next.fin, allBiens, list)
      : [];

    if (alternatives.length > 0) {
      next.alternativePropose = alternatives[0].matricule;
    }

    const updated = [...list];
    updated[idx] = next;
    saveReservations(updated);

    if (alternatives.length > 0) {
      const alt = alternatives[0];
      appendWaLogs([
        {
          id: makeLogId(),
          codeReservation: next.code,
          destinataireRole: 'client',
          destinataireLabel: `Client (${next.client.nom})`,
          categorie: 'remplacement',
          message: `CERIM · Le bien ${next.matricule} n'est finalement pas libre. Nous vous proposons une alternative équivalente immédiate : [${alt.matricule}] ${alt.titre} à ${formatFcfa(alt.prix)}/${alt.periode}. Acceptez ou refusez sur /suivi.`,
          date: new Date().toISOString(),
        },
      ]);
    } else {
      appendWaLogs([
        {
          id: makeLogId(),
          codeReservation: next.code,
          destinataireRole: 'client',
          destinataireLabel: `Client (${next.client.nom})`,
          categorie: 'annulation',
          message: `CERIM · Nous sommes désolés : ${next.matricule} n'est plus disponible et aucun bien équivalent n'est libre à ces dates. Notre équipe vous contacte rapidement.`,
          date: new Date().toISOString(),
        },
        {
          id: makeLogId(),
          codeReservation: next.code,
          destinataireRole: 'cerim',
          destinataireLabel: 'Alerte Équipe CERIM',
          categorie: 'remplacement',
          message: `[URGENT REMPLACEMENT] Aucune alternative automatique pour ${next.code} (${next.matricule}, ${next.ville}). Prise en charge manuelle requise.`,
          date: new Date().toISOString(),
        },
      ]);
    }

    return next;
  }

  async validerChecklist(
    code: string,
    items: ChecklistItemState[],
    allBiens: Bien[]
  ): Promise<Reservation> {
    const allChecked = items.length > 0 && items.every((it) => it.checked);
    if (!allChecked) {
      throw new Error('Tous les points de la checklist doivent être cochés avant validation.');
    }

    const list = loadReservations();
    const idx = list.findIndex((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (idx === -1) throw new Error('Réservation introuvable.');

    const current = list[idx];
    const next = applySafeTransition(
      current,
      'bien_pret',
      'fournisseur',
      'Checklist préparatoire validée — bien prêt pour l’accueil.'
    );
    next.checklist = {
      valideeLe: new Date().toISOString(),
      items,
    };

    const updated = [...list];
    updated[idx] = next;
    saveReservations(updated);

    const bien = allBiens.find((b) => b.matricule === next.matricule);
    appendWaLogs([
      {
        id: makeLogId(),
        codeReservation: next.code,
        destinataireRole: 'client',
        destinataireLabel: `Client (${next.client.nom})`,
        categorie: 'confirmation',
        message: `CERIM · Votre bien ${bien?.titre || next.titre} (${next.code}) est PRÊT pour votre arrivée (${next.creneauArrivee || 'selon horaire prévu'}).`,
        date: new Date().toISOString(),
      },
    ]);

    return next;
  }

  async repondreAlternative(
    code: string,
    tel4: string,
    accepter: boolean,
    allBiens: Bien[]
  ): Promise<{ original: Reservation; nouvelle?: Reservation }> {
    const list = loadReservations();
    const idx = list.findIndex((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (idx === -1) throw new Error('Réservation introuvable.');
    const original = list[idx];
    if (getPhoneLast4(original.client.telephone) !== tel4.replace(/[^\d]/g, '')) {
      throw new Error('Vérification téléphonique invalide.');
    }
    if (!original.alternativePropose) {
      throw new Error('Aucune alternative en attente sur cette réservation.');
    }

    if (!accepter) {
      const updatedOriginal: Reservation = {
        ...original,
        alternativePropose: undefined,
        historique: [
          ...original.historique,
          {
            statut: 'refusee',
            date: new Date().toISOString(),
            auteur: 'client',
            note: 'Alternative déclinée par le client (aucun frais).',
          },
        ],
      };
      const updated = [...list];
      updated[idx] = updatedOriginal;
      saveReservations(updated);
      return { original: updatedOriginal };
    }

    const altBien = allBiens.find((b) => b.matricule === original.alternativePropose);
    if (!altBien) {
      throw new Error('Le bien alternatif n’est plus disponible au catalogue.');
    }

    const nameParts = original.client.nom.split(' ');
    const prenom = original.client.prenom || nameParts[0] || original.client.nom;
    const nom = nameParts.slice(1).join(' ') || original.client.nom;

    const { reservation: created } = await this.creerReservation(
      {
        bien: altBien,
        nom,
        prenom,
        telephone: original.client.telephone,
        debut: original.debut,
        fin: original.fin,
        creneauArrivee: original.creneauArrivee || '14h–16h',
        message: original.client.message,
        pieceIdentite: original.client.pieceIdentite,
        accepteCgv: true,
        remplacementDeCode: original.code,
      },
      allBiens
    );

    // Le client ayant cliqué « Accepter », on confirme immédiatement côté client vers demandee
    const nouvelle = await this.confirmerClient(created.code, allBiens);
    return { original, nouvelle };
  }

  async enregistrerArrivee(params: {
    code: string;
    photosAvant: string[];
    paiement: Omit<PaiementSurPlace, 'date'>;
    allBiens: Bien[];
  }): Promise<Reservation> {
    const list = loadReservations();
    const idx = list.findIndex((r) => r.code.toUpperCase() === params.code.trim().toUpperCase());
    if (idx === -1) throw new Error('Réservation introuvable.');

    const current = list[idx];
    const nowIso = new Date().toISOString();
    const next = applySafeTransition(
      current,
      'arrivee',
      'cerim',
      `Check-in effectué · Paiement sur place ${formatFcfa(params.paiement.montant)} (${params.paiement.mode}, encaissé par ${params.paiement.encaissePar}).`
    );

    next.paiementSurPlace = {
      ...params.paiement,
      date: nowIso,
    };
    next.photosEtat = {
      avant: params.photosAvant,
      apres: current.photosEtat?.apres || [],
    };

    const updated = [...list];
    updated[idx] = next;
    saveReservations(updated);

    appendWaLogs([
      {
        id: makeLogId(),
        codeReservation: next.code,
        destinataireRole: 'client',
        destinataireLabel: `Client (${next.client.nom})`,
        categorie: 'recu_paiement',
        message: `CERIM · Reçu de paiement sur place (${next.code}) : ${formatFcfa(params.paiement.montant)} réglé par ${params.paiement.mode} le ${formatIsoFr(nowIso)}. Encaissé par : ${params.paiement.encaissePar === 'CERIM' ? 'CERIM' : 'Fournisseur'}. Bon séjour !`,
        date: nowIso,
      },
    ]);

    return next;
  }

  async terminerSejour(params: { code: string; photosApres: string[] }): Promise<Reservation> {
    const list = loadReservations();
    const idx = list.findIndex((r) => r.code.toUpperCase() === params.code.trim().toUpperCase());
    if (idx === -1) throw new Error('Réservation introuvable.');

    const current = list[idx];
    const next = applySafeTransition(
      current,
      'terminee',
      'cerim',
      'État des lieux de sortie validé et séjour terminé.'
    );
    next.photosEtat = {
      avant: current.photosEtat?.avant || [],
      apres: params.photosApres,
    };

    const updated = [...list];
    updated[idx] = next;
    saveReservations(updated);
    return next;
  }

  async enregistrerNoShow(code: string, note?: string): Promise<Reservation> {
    const list = loadReservations();
    const idx = list.findIndex((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (idx === -1) throw new Error('Réservation introuvable.');

    const current = list[idx];
    const next = applySafeTransition(
      current,
      'no_show',
      'cerim',
      note || 'Client absent à l’heure convenue (no-show enregistré).'
    );
    const updated = [...list];
    updated[idx] = next;
    saveReservations(updated);
    return next;
  }

  async envoyerRappelSimule(
    code: string,
    typeRappel: 'rappel_j2' | 'rappel_j1' | 'rappel_jourj',
    allBiens: Bien[]
  ): Promise<WhatsAppSimLog[]> {
    const list = loadReservations();
    const res = list.find((r) => r.code.toUpperCase() === code.trim().toUpperCase());
    if (!res) throw new Error('Réservation introuvable.');

    const bien = allBiens.find((b) => b.matricule === res.matricule);
    const supplierId = bien?.fournisseurId || 'SUP-INTERNE';
    const clientFirstName = res.client.prenom?.trim() || res.client.nom.split(' ')[0] || 'Client';
    const now = new Date().toISOString();
    const createdLogs: WhatsAppSimLog[] = [];

    if (typeRappel === 'rappel_j2') {
      createdLogs.push({
        id: makeLogId(),
        codeReservation: res.code,
        destinataireRole: 'fournisseur',
        destinataireLabel: `Fournisseur [${supplierId}]`,
        categorie: 'rappel_j2',
        message: `CERIM Rappel J-2 (${res.code}) : Préparez le bien ${res.matricule} pour l'arrivée de ${clientFirstName} le ${formatIsoFr(res.debut)} (${res.creneauArrivee || '—'}).`,
        date: now,
      });
    } else if (typeRappel === 'rappel_j1') {
      createdLogs.push({
        id: makeLogId(),
        codeReservation: res.code,
        destinataireRole: 'client',
        destinataireLabel: `Client (${res.client.nom})`,
        categorie: 'rappel_j1',
        message: `CERIM Rappel J-1 (${res.code}) : Votre arrivée pour ${res.titre} est prévue demain (${formatIsoFr(res.debut)}, ${res.creneauArrivee || '—'}). Montant à régler sur place : ${formatFcfa(res.totalEstime)}.`,
        date: now,
      });
      if (res.statut !== 'bien_pret') {
        createdLogs.push({
          id: makeLogId(),
          codeReservation: res.code,
          destinataireRole: 'fournisseur',
          destinataireLabel: `Fournisseur [${supplierId}] (alerte bien_pret manquant)`,
          categorie: 'rappel_j1',
          message: `CERIM Alerte J-1 (${res.code}) : La checklist « bien prêt » n'est pas encore validée pour ${res.matricule}. Merci de confirmer l'état du bien.`,
          date: now,
        });
      }
    } else {
      createdLogs.push(
        {
          id: makeLogId(),
          codeReservation: res.code,
          destinataireRole: 'client',
          destinataireLabel: `Client (${res.client.nom})`,
          categorie: 'rappel_jourj',
          message: `CERIM Jour J (${res.code}) : Bienvenue ! Rappel du lieu d'arrivée dans votre page /suivi et règlement sur place de ${formatFcfa(res.totalEstime)}.`,
          date: now,
        },
        {
          id: makeLogId(),
          codeReservation: res.code,
          destinataireRole: 'fournisseur',
          destinataireLabel: `Fournisseur [${supplierId}]`,
          categorie: 'rappel_jourj',
          message: `CERIM Jour J (${res.code}) : Arrivée aujourd'hui de ${clientFirstName} sur le créneau ${res.creneauArrivee || '—'} pour ${res.matricule}.`,
          date: now,
        }
      );
    }

    appendWaLogs(createdLogs);
    return createdLogs;
  }
}

const ADMIN_API_TOKEN_SESSION_KEY = 'cerim_admin_api_token';

export function getAdminApiToken(): string {
  try {
    return window.sessionStorage.getItem(ADMIN_API_TOKEN_SESSION_KEY) || '';
  } catch {
    return '';
  }
}

export function setAdminApiToken(token: string): void {
  try {
    const clean = token.trim();
    if (clean) {
      window.sessionStorage.setItem(ADMIN_API_TOKEN_SESSION_KEY, clean);
    } else {
      window.sessionStorage.removeItem(ADMIN_API_TOKEN_SESSION_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export class HttpGateway implements ReservationGateway {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async requestJson<T>(
    path: string,
    init?: RequestInit,
    requireAdminAuth = false
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string>) || {}),
    };
    if (requireAdminAuth) {
      const token = getAdminApiToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload?.error || 'Erreur lors de la communication avec le serveur CERIM.');
    }
    return payload as T;
  }

  async creerReservation(
    input: CreateReservationInput,
    _allBiens: Bien[]
  ): Promise<CreateReservationResult> {
    return this.requestJson<CreateReservationResult>('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({
        matricule: input.bien.matricule,
        nom: input.nom,
        prenom: input.prenom,
        telephone: input.telephone,
        debut: input.debut,
        fin: input.fin,
        creneauArrivee: input.creneauArrivee,
        message: input.message,
        pieceIdentite: input.pieceIdentite,
        accepteCgv: input.accepteCgv,
        honeypot: input.honeypot,
        remplacementDeCode: input.remplacementDeCode,
        bienMeta: {
          titre: input.bien.titre,
          ville: input.bien.ville,
          quartier: input.bien.quartier,
          prix: input.bien.prix,
          periode: input.bien.periode,
          fournisseurId: input.bien.fournisseurId,
        },
      }),
    });
  }

  async confirmerClient(code: string): Promise<Reservation> {
    return this.requestJson<Reservation>(`/api/reservations/${encodeURIComponent(code)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ reponse: 'OUI' }),
    });
  }

  async consulter(
    code: string,
    tel4: string,
    allBiens: Bien[]
  ): Promise<ConsultReservationResult> {
    const res = await this.requestJson<{
      reservation: Reservation;
      alternativeMatricule?: string;
    }>(`/api/reservations/${encodeURIComponent(code)}?tel4=${encodeURIComponent(tel4)}`);

    const bien = allBiens.find((b) => b.matricule === res.reservation.matricule);
    const altCode = res.reservation.alternativePropose || res.alternativeMatricule;
    const altBien = altCode ? allBiens.find((b) => b.matricule === altCode) : undefined;
    return {
      reservation: res.reservation,
      bien,
      alternatives: altBien ? [altBien] : [],
    };
  }

  async getAcces(code: string, tel4: string): Promise<AccesInfo | null> {
    try {
      return await this.requestJson<AccesInfo>(
        `/api/reservations/${encodeURIComponent(code)}/acces?tel4=${encodeURIComponent(tel4)}`
      );
    } catch {
      return null;
    }
  }

  async annuler(
    code: string,
    tel4: string,
    auteur: ReservationAuteur = 'client',
    motif?: string
  ): Promise<CancelReservationResult> {
    return this.requestJson<CancelReservationResult>(
      `/api/reservations/${encodeURIComponent(code)}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ tel4, auteur, motif }),
      },
      auteur !== 'client'
    );
  }

  ajouterPieceIdentite(code: string, tel4: string, dataUrl: string): Promise<Reservation> {
    return this.requestJson<Reservation>(`/api/reservations/${encodeURIComponent(code)}/identity`, {
      method: 'POST',
      body: JSON.stringify({ tel4, pieceIdentite: dataUrl }),
    });
  }

  confirmerFournisseur(code: string, _allBiens: Bien[]): Promise<Reservation> {
    return this.requestJson<Reservation>(
      `/api/reservations/${encodeURIComponent(code)}/supplier-confirm`,
      { method: 'POST', body: JSON.stringify({}) },
      true
    );
  }

  refuserFournisseur(
    code: string,
    _allBiens: Bien[],
    raison: 'refus' | 'timeout' = 'refus'
  ): Promise<Reservation> {
    return this.requestJson<Reservation>(
      `/api/reservations/${encodeURIComponent(code)}/supplier-refuse`,
      { method: 'POST', body: JSON.stringify({ raison }) },
      true
    );
  }

  validerChecklist(
    code: string,
    items: ChecklistItemState[],
    _allBiens: Bien[]
  ): Promise<Reservation> {
    return this.requestJson<Reservation>(
      `/api/reservations/${encodeURIComponent(code)}/checklist`,
      { method: 'POST', body: JSON.stringify({ items }) },
      true
    );
  }

  repondreAlternative(
    code: string,
    tel4: string,
    accepter: boolean,
    _allBiens: Bien[]
  ): Promise<{ original: Reservation; nouvelle?: Reservation }> {
    return this.requestJson<{ original: Reservation; nouvelle?: Reservation }>(
      `/api/reservations/${encodeURIComponent(code)}/alternative`,
      { method: 'POST', body: JSON.stringify({ tel4, accepter }) }
    );
  }

  enregistrerArrivee(params: {
    code: string;
    photosAvant: string[];
    paiement: Omit<PaiementSurPlace, 'date'>;
    allBiens: Bien[];
  }): Promise<Reservation> {
    return this.requestJson<Reservation>(
      `/api/reservations/${encodeURIComponent(params.code)}/checkin`,
      {
        method: 'POST',
        body: JSON.stringify({
          photosAvant: params.photosAvant,
          paiement: params.paiement,
        }),
      },
      true
    );
  }

  terminerSejour(params: { code: string; photosApres: string[] }): Promise<Reservation> {
    return this.requestJson<Reservation>(
      `/api/reservations/${encodeURIComponent(params.code)}/checkout`,
      { method: 'POST', body: JSON.stringify({ photosApres: params.photosApres }) },
      true
    );
  }

  enregistrerNoShow(code: string, note?: string): Promise<Reservation> {
    return this.requestJson<Reservation>(
      `/api/reservations/${encodeURIComponent(code)}/no-show`,
      { method: 'POST', body: JSON.stringify({ note }) },
      true
    );
  }

  async envoyerRappelSimule(
    code: string,
    typeRappel: 'rappel_j2' | 'rappel_j1' | 'rappel_jourj',
    _allBiens: Bien[]
  ): Promise<WhatsAppSimLog[]> {
    const res = await this.requestJson<{ logs: WhatsAppSimLog[] }>(
      `/api/reservations/${encodeURIComponent(code)}/reminder`,
      { method: 'POST', body: JSON.stringify({ typeRappel }) },
      true
    );
    return res.logs || [];
  }

  async purgeExpired(_allBiens: Bien[]): Promise<number> {
    if (!getAdminApiToken()) return 0;
    try {
      const res = await this.requestJson<{ changed: number }>(
        '/api/admin/purge',
        { method: 'POST', body: JSON.stringify({}) },
        true
      );
      return res.changed || 0;
    } catch {
      return 0;
    }
  }

  // Méthodes d'administration synchronisées avec Cloudflare D1
  async fetchAdminReservations(): Promise<Reservation[]> {
    const res = await this.requestJson<{ reservations: Reservation[] }>(
      '/api/admin/reservations',
      undefined,
      true
    );
    return res.reservations || [];
  }

  async fetchAdminLogs(): Promise<WhatsAppSimLog[]> {
    const res = await this.requestJson<{ logs: WhatsAppSimLog[] }>(
      '/api/admin/logs',
      undefined,
      true
    );
    return res.logs || [];
  }

  async fetchAdminBlacklist(): Promise<BlacklistEntry[]> {
    const res = await this.requestJson<{ blacklist: BlacklistEntry[] }>(
      '/api/admin/blacklist',
      undefined,
      true
    );
    return res.blacklist || [];
  }

  async addAdminBlacklist(telephone: string, motif: string): Promise<BlacklistEntry[]> {
    const res = await this.requestJson<{ blacklist: BlacklistEntry[] }>(
      '/api/admin/blacklist',
      { method: 'POST', body: JSON.stringify({ telephone, motif }) },
      true
    );
    return res.blacklist || [];
  }

  async removeAdminBlacklist(id: string): Promise<BlacklistEntry[]> {
    const res = await this.requestJson<{ blacklist: BlacklistEntry[] }>(
      `/api/admin/blacklist/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      true
    );
    return res.blacklist || [];
  }

  async fetchAdminSettings(): Promise<AdminSettings> {
    const res = await this.requestJson<{ settings: AdminSettings }>(
      '/api/admin/settings',
      undefined,
      true
    );
    return res.settings;
  }

  async updateAdminSettingsRemote(patch: Partial<AdminSettings>): Promise<AdminSettings> {
    const res = await this.requestJson<{ settings: AdminSettings }>(
      '/api/admin/settings',
      { method: 'PUT', body: JSON.stringify(patch) },
      true
    );
    return res.settings;
  }
}

export function computeSupplierMetrics(
  allBiens: Bien[],
  reservations: Reservation[]
): SupplierMetrics[] {
  const bySupplier = new Map<string, Reservation[]>();
  const bienMap = new Map(allBiens.map((b) => [b.matricule, b]));

  for (const b of allBiens) {
    if (!bySupplier.has(b.fournisseurId)) {
      bySupplier.set(b.fournisseurId, []);
    }
  }

  for (const r of reservations) {
    const b = bienMap.get(r.matricule);
    const supId = b?.fournisseurId || 'SUP-INTERNE';
    const arr = bySupplier.get(supId) || [];
    arr.push(r);
    bySupplier.set(supId, arr);
  }

  return Array.from(bySupplier.entries()).map(([fournisseurId, list]) => {
    const dispatched = list.filter((r) => r.statut !== 'en_attente_client');
    const confirmees = dispatched.filter((r) =>
      ['confirmee', 'bien_pret', 'arrivee', 'terminee', 'no_show'].includes(r.statut)
    ).length;
    const refusOuTimeouts = dispatched.filter((r) => r.statut === 'refusee').length;
    const bienPretManquants = dispatched.filter((r) => r.statut === 'confirmee').length;

    const delays: number[] = [];
    for (const r of dispatched) {
      const reqEntry = r.historique.find((h) => h.statut === 'demandee');
      const confEntry = r.historique.find((h) => h.statut === 'confirmee');
      if (reqEntry && confEntry) {
        const diffMin =
          (new Date(confEntry.date).getTime() - new Date(reqEntry.date).getTime()) / 60000;
        if (diffMin >= 0) delays.push(diffMin);
      }
    }

    const delaiMoyenMinutes =
      delays.length > 0
        ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
        : null;

    return {
      fournisseurId,
      totalDemandes: dispatched.length,
      confirmees,
      tauxConfirmation:
        dispatched.length > 0 ? Math.round((confirmees / dispatched.length) * 100) : 100,
      refusOuTimeouts,
      bienPretManquants,
      delaiMoyenMinutes,
    };
  });
}

// Helpers Admin Blacklist & Settings
export function addBlacklistPhone(telephone: string, motif: string): BlacklistEntry[] {
  const digits = normalizePhoneDigits(telephone);
  const current = loadBlacklist();
  if (current.some((e) => normalizePhoneDigits(e.telephone) === digits)) {
    return current;
  }
  const entry: BlacklistEntry = {
    id: `bl-${Date.now()}`,
    telephone: telephone.trim(),
    motif: motif.trim() || 'Incident / no-show répété',
    ajouteLe: new Date().toISOString(),
  };
  const updated = [entry, ...current];
  saveBlacklist(updated);
  return updated;
}

export function removeBlacklistPhone(id: string): BlacklistEntry[] {
  const updated = loadBlacklist().filter((e) => e.id !== id);
  saveBlacklist(updated);
  return updated;
}

export function updateAdminSettingsStore(patch: Partial<AdminSettings>): AdminSettings {
  const updated = { ...loadAdminSettings(), ...patch };
  saveAdminSettings(updated);
  return updated;
}

const GATEWAY_MODE = import.meta.env.VITE_GATEWAY_MODE || 'mock';
const API_URL = import.meta.env.VITE_API_URL || '';

export const isHttpGatewayMode = GATEWAY_MODE === 'http' && Boolean(API_URL);

export const reservationService: ReservationGateway =
  isHttpGatewayMode ? new HttpGateway(API_URL) : new MockGateway();
