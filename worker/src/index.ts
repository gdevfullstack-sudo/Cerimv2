/**
 * CERIM — Cloudflare Worker (Passerelle API D1 + Webhook WhatsApp Meta Cloud + Cron rappels)
 * Aucune clé, jeton ou numéro de fournisseur n'est codé en dur ici :
 * tout provient des Cloudflare Worker Secrets configurés via `wrangler secret put`.
 */

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

export interface Env {
  DB?: D1Database;
  RATE_LIMIT_KV?: KVNamespace;
  // Secrets Cloudflare obligatoires :
  META_WHATSAPP_TOKEN: string;
  META_PHONE_NUMBER_ID: string;
  META_VERIFY_TOKEN: string;
  META_APP_SECRET: string;
  TURNSTILE_SECRET_KEY?: string;
  SUPPLIER_PHONES_JSON: string; // JSON: { "SUP-01": "+242...", ... } — JAMAIS exposé au client
  CERIM_DISPATCH_PHONE: string; // Numéro interne de l'équipe CERIM pour copie de suivi
  ADMIN_TOKEN: string;
  // Variables non sensibles (wrangler.toml) :
  CANCELLATION_HOURS: string;
  CLIENT_CONFIRM_MINUTES: string;
  SUPPLIER_TIMEOUT_MINUTES: string;
  ENCAISSEMENT_PAR: 'CERIM' | 'FOURNISSEUR';
}

type StatutReservation =
  | 'en_attente_client'
  | 'demandee'
  | 'confirmee'
  | 'bien_pret'
  | 'arrivee'
  | 'terminee'
  | 'annulee'
  | 'refusee'
  | 'no_show';

type ReservationAuteur = 'client' | 'cerim' | 'fournisseur' | 'systeme';
type TypeBien = 'Appartement' | 'Voiture';
type PeriodeTarif = 'nuit' | 'jour' | 'mois';

interface HistoriqueEntry {
  statut: StatutReservation;
  date: string;
  auteur: ReservationAuteur;
  note?: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

interface PaiementSurPlace {
  montant: number;
  mode: 'Especes' | 'Mobile Money sur place';
  encaissePar: 'CERIM' | 'FOURNISSEUR';
  date: string;
}

interface PhotosEtat {
  avant: string[];
  apres: string[];
}

interface ReservationRow {
  id: string;
  code: string;
  matricule: string;
  titre: string;
  ville: string;
  quartier: string;
  fournisseur_id: string;
  client_nom: string;
  client_prenom: string;
  client_telephone: string;
  piece_identite: string | null;
  client_message: string | null;
  debut: string;
  fin: string;
  duree_label: string;
  total_estime: number;
  creneau_arrivee: string | null;
  statut: StatutReservation;
  historique_json: string;
  checklist_json: string | null;
  alternative_propose: string | null;
  remplacement_de_code: string | null;
  paiement_json: string | null;
  photos_etat_json: string | null;
  expires_at: string | null;
  supplier_deadline_at: string | null;
  cree_le: string;
}

interface BlacklistRow {
  id: string;
  telephone: string;
  motif: string;
  ajoute_le: string;
}

interface WhatsAppLogRow {
  id: string;
  code_reservation: string;
  destinataire_role: 'client' | 'fournisseur' | 'cerim';
  destinataire_label: string;
  categorie: string;
  message: string;
  date: string;
}

interface AdminSettingsRow {
  cancellation_hours: number;
  client_confirm_minutes: number;
  supplier_timeout_minutes: number;
  encaissement_par: 'CERIM' | 'FOURNISSEUR';
}

interface CatalogMetaItem {
  matricule: string;
  type: TypeBien;
  titre: string;
  ville: 'Brazzaville' | 'Pointe-Noire';
  quartier: string;
  prix: number;
  periode: PeriodeTarif;
  fournisseurId: string;
  reservations: Array<{ debut: string; fin: string }>;
  bloques: string[];
}

const ALLOWED_TRANSITIONS: Record<StatutReservation, ReadonlyArray<StatutReservation>> = {
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

const ACTIVE_BLOCKING_SQL_LIST = `'en_attente_client', 'demandee', 'confirmee', 'bien_pret', 'arrivee'`;

// Catalogue serveur autoritaire pour calcul tarifaire, fournisseurId opaque et remplacements équivalents
const CATALOG_META: Record<string, CatalogMetaItem> = {
  AP1: {
    matricule: 'AP1',
    type: 'Appartement',
    titre: 'Appartement lumineux vue fleuve — Plateau',
    ville: 'Brazzaville',
    quartier: 'Centre-ville / Plateau',
    prix: 55000,
    periode: 'nuit',
    fournisseurId: 'SUP-01',
    reservations: [
      { debut: '2026-11-18', fin: '2026-11-21' },
      { debut: '2026-12-03', fin: '2026-12-06' },
    ],
    bloques: ['2026-11-25'],
  },
  AP2: {
    matricule: 'AP2',
    type: 'Appartement',
    titre: 'Suite côtière avec balcon — Côte Sauvage',
    ville: 'Pointe-Noire',
    quartier: 'Côte Sauvage',
    prix: 65000,
    periode: 'nuit',
    fournisseurId: 'SUP-02',
    reservations: [{ debut: '2026-11-13', fin: '2026-11-16' }],
    bloques: [],
  },
  AP3: {
    matricule: 'AP3',
    type: 'Appartement',
    titre: 'Studio résidentiel équipé — Mpila',
    ville: 'Brazzaville',
    quartier: 'Mpila',
    prix: 450000,
    periode: 'mois',
    fournisseurId: 'SUP-01',
    reservations: [],
    bloques: ['2026-11-28', '2026-11-29'],
  },
  AP4: {
    matricule: 'AP4',
    type: 'Appartement',
    titre: 'Grand appartement familial — Centre-ville',
    ville: 'Pointe-Noire',
    quartier: 'Centre-ville',
    prix: 78000,
    periode: 'nuit',
    fournisseurId: 'SUP-02',
    reservations: [{ debut: '2026-11-22', fin: '2026-11-26' }],
    bloques: [],
  },
  VO1: {
    matricule: 'VO1',
    type: 'Voiture',
    titre: 'SUV 4x4 Tout-Terrain Executive',
    ville: 'Brazzaville',
    quartier: 'Bacongo / Centre-ville',
    prix: 75000,
    periode: 'jour',
    fournisseurId: 'SUP-03',
    reservations: [{ debut: '2026-11-19', fin: '2026-11-21' }],
    bloques: [],
  },
  VO2: {
    matricule: 'VO2',
    type: 'Voiture',
    titre: 'Berline Urbaine Confort',
    ville: 'Brazzaville',
    quartier: 'Moungali',
    prix: 45000,
    periode: 'jour',
    fournisseurId: 'SUP-03',
    reservations: [{ debut: '2026-11-14', fin: '2026-11-15' }],
    bloques: ['2026-11-27'],
  },
  VO3: {
    matricule: 'VO3',
    type: 'Voiture',
    titre: 'SUV 4x4 Missions & Côte',
    ville: 'Pointe-Noire',
    quartier: 'Loandjili',
    prix: 80000,
    periode: 'jour',
    fournisseurId: 'SUP-04',
    reservations: [{ debut: '2026-11-24', fin: '2026-11-27' }],
    bloques: [],
  },
  VO4: {
    matricule: 'VO4',
    type: 'Voiture',
    titre: 'Berline Affaires Centre-Ville',
    ville: 'Pointe-Noire',
    quartier: 'Centre-ville',
    prix: 40000,
    periode: 'jour',
    fournisseurId: 'SUP-04',
    reservations: [],
    bloques: [],
  },
};

// Base privée des adresses exactes (jamais retournée avant le statut 'confirmee')
const PRIVATE_ACCESS_MAP: Record<
  string,
  { adresseExacte: string; consignesAcces: string; pointRendezVous: string }
> = {
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

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function isAdminAuthorized(request: Request, env: Env): boolean {
  if (!env.ADMIN_TOKEN) return false;
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice('Bearer '.length).trim();
  return constantTimeEqual(token, env.ADMIN_TOKEN);
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

function validateInternationalPhone(phone: string): {
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
  return { valid: true, normalized: `+${digits}` };
}

function diffDays(debutIso: string, finIso: string): number {
  const [y1, m1, d1] = debutIso.split('-').map(Number);
  const [y2, m2, d2] = finIso.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate()
  ).padStart(2, '0')}`;
}

function computeEstimate(
  prix: number,
  periode: PeriodeTarif,
  debut: string,
  fin: string
): { dureeLabel: string; total: number } {
  const spanDays = Math.max(0, diffDays(debut, fin));
  if (periode === 'nuit') {
    const nights = Math.max(1, spanDays);
    return {
      dureeLabel: `${nights} nuit${nights > 1 ? 's' : ''}`,
      total: nights * prix,
    };
  }
  if (periode === 'jour') {
    const days = spanDays + 1;
    return {
      dureeLabel: `${days} jour${days > 1 ? 's' : ''}`,
      total: days * prix,
    };
  }
  const days = spanDays + 1;
  const monthsRatio = Math.max(days / 30, 1 / 30);
  return {
    dureeLabel: `${days} jour${days > 1 ? 's' : ''} (tarif mensuel)`,
    total: Math.round(monthsRatio * prix),
  };
}

function hoursUntilArrival(debutIso: string): number {
  const [y, m, d] = debutIso.split('-').map(Number);
  const arrivalMs = Date.UTC(y, m - 1, d, 12, 0, 0);
  return (arrivalMs - Date.now()) / 3600000;
}

function formatFcfa(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToReservation(row: ReservationRow, includeIdentity = true): Record<string, unknown> {
  // Ne JAMAIS inclure fournisseur_id dans la réponse client
  return {
    id: row.id,
    code: row.code,
    matricule: row.matricule,
    titre: row.titre,
    ville: row.ville,
    quartier: row.quartier,
    client: {
      nom: row.client_nom,
      prenom: row.client_prenom,
      telephone: row.client_telephone,
      ...(includeIdentity && row.piece_identite ? { pieceIdentite: row.piece_identite } : {}),
      ...(row.client_message ? { message: row.client_message } : {}),
    },
    debut: row.debut,
    fin: row.fin,
    dureeLabel: row.duree_label,
    totalEstime: row.total_estime,
    creneauArrivee: row.creneau_arrivee || undefined,
    statut: row.statut,
    historique: parseJsonSafe<HistoriqueEntry[]>(row.historique_json, []),
    alternativePropose: row.alternative_propose || undefined,
    remplacementDeCode: row.remplacement_de_code || undefined,
    checklist: parseJsonSafe(row.checklist_json, undefined),
    paiementSurPlace: parseJsonSafe(row.paiement_json, undefined),
    photosEtat: parseJsonSafe(row.photos_etat_json, undefined),
    expiresAt: row.expires_at || undefined,
    supplierDeadlineAt: row.supplier_deadline_at || undefined,
    creeLe: row.cree_le,
  };
}

async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=') || !appSecret) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = `sha256=${toHex(sigBuf)}`;
  return constantTimeEqual(expected, signatureHeader);
}

async function verifyTurnstile(
  token: string | undefined,
  secret: string | undefined,
  ip: string
): Promise<boolean> {
  if (!secret) return true; // Désactivé uniquement si clé Turnstile non configurée
  if (!token) return false;
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  formData.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}

async function checkRateLimit(
  kv: KVNamespace | undefined,
  key: string,
  limit: number,
  ttlSeconds: number
): Promise<boolean> {
  if (!kv) return true;
  const currentRaw = await kv.get(key);
  const count = currentRaw ? parseInt(currentRaw, 10) : 0;
  if (count >= limit) return false;
  await kv.put(key, String(count + 1), { expirationTtl: ttlSeconds });
  return true;
}

async function sendWhatsAppTemplate(
  env: Env,
  toPhone: string,
  templateName: string,
  bodyParams: string[]
): Promise<void> {
  if (!env.META_WHATSAPP_TOKEN || !env.META_PHONE_NUMBER_ID || !toPhone) return;
  const cleanTo = normalizePhoneDigits(toPhone);
  if (!cleanTo) return;
  await fetch(`https://graph.facebook.com/v21.0/${env.META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.META_WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'fr' },
        components: [
          {
            type: 'body',
            parameters: bodyParams.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    }),
  });
}

async function appendWaLog(
  db: D1Database,
  entry: {
    codeReservation: string;
    destinataireRole: 'client' | 'fournisseur' | 'cerim';
    destinataireLabel: string;
    categorie: string;
    message: string;
    date?: string;
  }
): Promise<void> {
  const date = entry.date || new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO whatsapp_logs (id, code_reservation, destinataire_role, destinataire_label, categorie, message, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `wa-${crypto.randomUUID()}`,
      entry.codeReservation,
      entry.destinataireRole,
      entry.destinataireLabel,
      entry.categorie,
      entry.message,
      date
    )
    .run();
}

function getSupplierPhoneMap(env: Env): Record<string, string> {
  try {
    return JSON.parse(env.SUPPLIER_PHONES_JSON || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

async function loadEffectiveSettings(env: Env): Promise<{
  cancellationHours: number;
  clientConfirmTimeoutMinutes: number;
  supplierTimeoutMinutes: number;
  encaissementPar: 'CERIM' | 'FOURNISSEUR';
}> {
  const fallback = {
    cancellationHours: Number(env.CANCELLATION_HOURS || '24'),
    clientConfirmTimeoutMinutes: Number(env.CLIENT_CONFIRM_MINUTES || '120'),
    supplierTimeoutMinutes: Number(env.SUPPLIER_TIMEOUT_MINUTES || '30'),
    encaissementPar: env.ENCAISSEMENT_PAR === 'FOURNISSEUR' ? ('FOURNISSEUR' as const) : ('CERIM' as const),
  };
  if (!env.DB) return fallback;
  try {
    const row = await env.DB.prepare('SELECT * FROM admin_settings WHERE id = 1').first<AdminSettingsRow>();
    if (!row) return fallback;
    return {
      cancellationHours: row.cancellation_hours,
      clientConfirmTimeoutMinutes: row.client_confirm_minutes,
      supplierTimeoutMinutes: row.supplier_timeout_minutes,
      encaissementPar: row.encaissement_par === 'FOURNISSEUR' ? 'FOURNISSEUR' : 'CERIM',
    };
  } catch {
    return fallback;
  }
}

async function isRangeAvailableInDb(
  db: D1Database,
  matricule: string,
  debut: string,
  fin: string,
  ignoreCode?: string
): Promise<boolean> {
  if (!debut || !fin || debut > fin) return false;
  const meta = CATALOG_META[matricule];
  if (meta) {
    for (const r of meta.reservations) {
      if (r.debut <= fin && r.fin >= debut) return false;
    }
    for (const b of meta.bloques) {
      if (b >= debut && b <= fin) return false;
    }
  }

  const sql = ignoreCode
    ? `SELECT code FROM reservations WHERE matricule = ? AND code != ? AND statut IN (${ACTIVE_BLOCKING_SQL_LIST}) AND debut <= ? AND fin >= ? LIMIT 1`
    : `SELECT code FROM reservations WHERE matricule = ? AND statut IN (${ACTIVE_BLOCKING_SQL_LIST}) AND debut <= ? AND fin >= ? LIMIT 1`;

  const stmt = ignoreCode
    ? db.prepare(sql).bind(matricule, ignoreCode, fin, debut)
    : db.prepare(sql).bind(matricule, fin, debut);

  const overlap = await stmt.first<{ code: string }>();
  return !overlap;
}

async function findEquivalentAlternativeD1(
  db: D1Database,
  originalMatricule: string,
  debut: string,
  fin: string
): Promise<CatalogMetaItem | null> {
  const origin = CATALOG_META[originalMatricule];
  if (!origin) return null;

  const minPrice = origin.prix * 0.8;
  const maxPrice = origin.prix * 1.2;

  const candidates = Object.values(CATALOG_META)
    .filter(
      (b) =>
        b.matricule !== origin.matricule &&
        b.type === origin.type &&
        b.ville === origin.ville &&
        b.prix >= minPrice &&
        b.prix <= maxPrice
    )
    .sort((a, b) => Math.abs(a.prix - origin.prix) - Math.abs(b.prix - origin.prix));

  for (const candidate of candidates) {
    const free = await isRangeAvailableInDb(db, candidate.matricule, debut, fin);
    if (free) return candidate;
  }
  return null;
}

async function generateUniqueCodeD1(db: D1Database, matricule: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const num = Math.floor(1 + Math.random() * 9999);
    const code = `CER-${matricule}-${String(num).padStart(4, '0')}`;
    const exists = await db.prepare('SELECT id FROM reservations WHERE code = ?').bind(code).first();
    if (!exists) return code;
  }
  return `CER-${matricule}-${String(Date.now()).slice(-4)}`;
}

async function transitionToRefusedWithAlternative(
  env: Env,
  db: D1Database,
  row: ReservationRow,
  auteur: ReservationAuteur,
  note: string
): Promise<ReservationRow> {
  const nowIso = new Date().toISOString();
  const history = parseJsonSafe<HistoriqueEntry[]>(row.historique_json, []);
  history.push({ statut: 'refusee', date: nowIso, auteur, note });

  const alt = await findEquivalentAlternativeD1(db, row.matricule, row.debut, row.fin);
  const altMatricule = alt ? alt.matricule : null;

  await db
    .prepare(
      `UPDATE reservations SET statut = 'refusee', historique_json = ?, alternative_propose = ? WHERE code = ?`
    )
    .bind(JSON.stringify(history), altMatricule, row.code)
    .run();

  if (alt) {
    const msg = `CERIM · Le bien ${row.matricule} n'est finalement pas libre. Alternative équivalente immédiate : [${alt.matricule}] ${alt.titre} à ${formatFcfa(alt.prix)}/${alt.periode}. Répondez sur votre page /suivi.`;
    await Promise.all([
      sendWhatsAppTemplate(env, row.client_telephone, 'cerim_remplacement_propose', [
        row.code,
        alt.matricule,
        alt.titre,
        formatFcfa(alt.prix),
      ]),
      appendWaLog(db, {
        codeReservation: row.code,
        destinataireRole: 'client',
        destinataireLabel: `Client (${row.client_nom})`,
        categorie: 'remplacement',
        message: msg,
        date: nowIso,
      }),
    ]);
  } else {
    await Promise.all([
      sendWhatsAppTemplate(env, row.client_telephone, 'cerim_indisponible_sans_alt', [
        row.code,
        row.matricule,
      ]),
      appendWaLog(db, {
        codeReservation: row.code,
        destinataireRole: 'client',
        destinataireLabel: `Client (${row.client_nom})`,
        categorie: 'annulation',
        message: `CERIM · Nous sommes désolés : ${row.matricule} n'est plus disponible et aucun bien équivalent n'est libre à ces dates. Notre équipe vous contacte rapidement.`,
        date: nowIso,
      }),
      appendWaLog(db, {
        codeReservation: row.code,
        destinataireRole: 'cerim',
        destinataireLabel: 'Alerte Équipe CERIM',
        categorie: 'remplacement',
        message: `[URGENT REMPLACEMENT] Aucune alternative automatique pour ${row.code} (${row.matricule}, ${row.ville}). Prise en charge manuelle requise.`,
        date: nowIso,
      }),
    ]);
  }

  return {
    ...row,
    statut: 'refusee',
    historique_json: JSON.stringify(history),
    alternative_propose: altMatricule,
  };
}

async function performClientConfirm(
  env: Env,
  db: D1Database,
  row: ReservationRow
): Promise<ReservationRow> {
  if (!ALLOWED_TRANSITIONS[row.statut].includes('demandee')) {
    throw new Error(`Transition de statut non autorisée (${row.statut} → demandee).`);
  }
  const settings = await loadEffectiveSettings(env);
  const nowIso = new Date().toISOString();
  const supplierDeadlineAt = new Date(
    Date.now() + settings.supplierTimeoutMinutes * 60000
  ).toISOString();

  const history = parseJsonSafe<HistoriqueEntry[]>(row.historique_json, []);
  history.push({
    statut: 'demandee',
    date: nowIso,
    auteur: 'client',
    note: 'Confirmation client « OUI » validée — notifications simultanées envoyées.',
  });

  await db
    .prepare(
      `UPDATE reservations SET statut = 'demandee', supplier_deadline_at = ?, historique_json = ? WHERE code = ?`
    )
    .bind(supplierDeadlineAt, JSON.stringify(history), row.code)
    .run();

  const supplierPhones = getSupplierPhoneMap(env);
  const supplierPhone = supplierPhones[row.fournisseur_id] || '';
  const clientFirstName = row.client_prenom || row.client_nom.split(' ')[0] || 'Client';

  await Promise.all([
    sendWhatsAppTemplate(env, row.client_telephone, 'cerim_client_en_attente', [
      row.code,
      row.titre,
    ]),
    // Confidentialité : seul le prénom + date + créneau sont transmis au fournisseur
    sendWhatsAppTemplate(env, supplierPhone, 'cerim_fournisseur_demande', [
      row.code,
      row.matricule,
      clientFirstName,
      `${row.debut} → ${row.fin} (${row.creneau_arrivee || ''})`,
    ]),
    sendWhatsAppTemplate(env, env.CERIM_DISPATCH_PHONE, 'cerim_copie_interne', [
      row.code,
      row.matricule,
      row.fournisseur_id,
    ]),
    appendWaLog(db, {
      codeReservation: row.code,
      destinataireRole: 'client',
      destinataireLabel: `Client (${row.client_nom})`,
      categorie: 'notification_creation',
      message: `CERIM · Demande enregistrée (${row.code}) pour ${row.titre} (${row.debut} → ${row.fin}). Confirmation sous 30 min max. Paiement sur place à votre arrivée.`,
      date: nowIso,
    }),
    appendWaLog(db, {
      codeReservation: row.code,
      destinataireRole: 'fournisseur',
      destinataireLabel: `Fournisseur [${row.fournisseur_id}] (via serveur CERIM)`,
      categorie: 'notification_creation',
      message: `CERIM Mission ${row.code} · Bien ${row.matricule} demandé du ${row.debut} au ${row.fin}. Arrivée de ${clientFirstName} (${row.creneau_arrivee || '—'}). Répondez CONFIRMER ${row.code} ou REFUSER ${row.code}.`,
      date: nowIso,
    }),
    appendWaLog(db, {
      codeReservation: row.code,
      destinataireRole: 'cerim',
      destinataireLabel: 'Équipe CERIM (copie interne)',
      categorie: 'notification_creation',
      message: `[DISPATCH ${row.code}] ${row.matricule} (${row.ville}) · Client ${row.client_nom} · Fournisseur ${row.fournisseur_id} · ${formatFcfa(row.total_estime)}.`,
      date: nowIso,
    }),
  ]);

  return {
    ...row,
    statut: 'demandee',
    supplier_deadline_at: supplierDeadlineAt,
    historique_json: JSON.stringify(history),
  };
}

async function performSupplierConfirm(
  env: Env,
  db: D1Database,
  row: ReservationRow
): Promise<ReservationRow> {
  if (!ALLOWED_TRANSITIONS[row.statut].includes('confirmee')) {
    throw new Error(`Transition de statut non autorisée (${row.statut} → confirmee).`);
  }
  const nowIso = new Date().toISOString();
  const history = parseJsonSafe<HistoriqueEntry[]>(row.historique_json, []);
  history.push({
    statut: 'confirmee',
    date: nowIso,
    auteur: 'fournisseur',
    note: 'Disponibilité confirmée — adresse d’accès déverrouillée sur /suivi.',
  });

  await db
    .prepare(`UPDATE reservations SET statut = 'confirmee', historique_json = ? WHERE code = ?`)
    .bind(JSON.stringify(history), row.code)
    .run();

  await Promise.all([
    sendWhatsAppTemplate(env, row.client_telephone, 'cerim_reservation_confirmee', [
      row.code,
      row.titre,
      formatFcfa(row.total_estime),
    ]),
    appendWaLog(db, {
      codeReservation: row.code,
      destinataireRole: 'client',
      destinataireLabel: `Client (${row.client_nom})`,
      categorie: 'confirmation',
      message: `CERIM · Bonne nouvelle ! Votre réservation ${row.code} (${row.titre}) est CONFIRMÉE. Consultez /suivi pour l'adresse exacte et les consignes. Règlement sur place : ${formatFcfa(row.total_estime)}.`,
      date: nowIso,
    }),
    appendWaLog(db, {
      codeReservation: row.code,
      destinataireRole: 'cerim',
      destinataireLabel: 'Équipe CERIM',
      categorie: 'confirmation',
      message: `[CONFIRMÉE ${row.code}] Fournisseur ${row.fournisseur_id} a confirmé ${row.matricule}.`,
      date: nowIso,
    }),
  ]);

  return {
    ...row,
    statut: 'confirmee',
    historique_json: JSON.stringify(history),
  };
}

async function runMaintenanceAndReminders(env: Env): Promise<number> {
  if (!env.DB) return 0;
  const db = env.DB;
  const nowIso = new Date().toISOString();
  let changed = 0;

  // 1. Expiration double confirmation client (> 2h sans OUI)
  const expiredClient = await db
    .prepare(
      `SELECT * FROM reservations WHERE statut = 'en_attente_client' AND expires_at IS NOT NULL AND expires_at <= ?`
    )
    .bind(nowIso)
    .all<ReservationRow>();

  for (const row of expiredClient.results) {
    const history = parseJsonSafe<HistoriqueEntry[]>(row.historique_json, []);
    history.push({
      statut: 'annulee',
      date: nowIso,
      auteur: 'systeme',
      note: 'Expiration automatique (délai de confirmation OUI de 2 h dépassé).',
    });
    await db
      .prepare(`UPDATE reservations SET statut = 'annulee', historique_json = ? WHERE code = ?`)
      .bind(JSON.stringify(history), row.code)
      .run();
    await appendWaLog(db, {
      codeReservation: row.code,
      destinataireRole: 'client',
      destinataireLabel: `Client (${row.client_nom})`,
      categorie: 'annulation',
      message: `CERIM · Votre pré-demande ${row.code} a expiré faute de réponse OUI sous 2 heures. Les dates sont de nouveau libres.`,
      date: nowIso,
    });
    changed++;
  }

  // 2. Timeout fournisseur (> 30 min sans confirmation) -> refus + alternative auto
  const expiredSupplier = await db
    .prepare(
      `SELECT * FROM reservations WHERE statut = 'demandee' AND supplier_deadline_at IS NOT NULL AND supplier_deadline_at <= ?`
    )
    .bind(nowIso)
    .all<ReservationRow>();

  for (const row of expiredSupplier.results) {
    await transitionToRefusedWithAlternative(
      env,
      db,
      row,
      'systeme',
      'Délai fournisseur dépassé — recherche automatique d’alternative.'
    );
    changed++;
  }

  // 3. Rappels automatiques J-2, J-1, Jour J pour les dossiers confirmés/prêts
  const todayIso = nowIso.slice(0, 10);
  const in1Day = addDaysIso(todayIso, 1);
  const in2Days = addDaysIso(todayIso, 2);

  const upcoming = await db
    .prepare(
      `SELECT * FROM reservations WHERE statut IN ('confirmee', 'bien_pret') AND debut IN (?, ?, ?)`
    )
    .bind(todayIso, in1Day, in2Days)
    .all<ReservationRow>();

  const supplierPhones = getSupplierPhoneMap(env);

  for (const row of upcoming.results) {
    const category =
      row.debut === in2Days ? 'rappel_j2' : row.debut === in1Day ? 'rappel_j1' : 'rappel_jourj';

    const alreadySent = await db
      .prepare(`SELECT id FROM whatsapp_logs WHERE code_reservation = ? AND categorie = ? LIMIT 1`)
      .bind(row.code, category)
      .first();

    if (alreadySent) continue;

    const supplierPhone = supplierPhones[row.fournisseur_id] || '';
    const clientFirstName = row.client_prenom || row.client_nom.split(' ')[0] || 'Client';

    if (category === 'rappel_j2') {
      await Promise.all([
        sendWhatsAppTemplate(env, supplierPhone, 'cerim_rappel_j2_fournisseur', [
          row.code,
          row.matricule,
          clientFirstName,
          row.debut,
        ]),
        appendWaLog(db, {
          codeReservation: row.code,
          destinataireRole: 'fournisseur',
          destinataireLabel: `Fournisseur [${row.fournisseur_id}]`,
          categorie: 'rappel_j2',
          message: `CERIM Rappel J-2 (${row.code}) : Préparez le bien ${row.matricule} pour l'arrivée de ${clientFirstName} le ${row.debut} (${row.creneau_arrivee || '—'}).`,
          date: nowIso,
        }),
      ]);
    } else if (category === 'rappel_j1') {
      await Promise.all([
        sendWhatsAppTemplate(env, row.client_telephone, 'cerim_rappel_j1_client', [
          row.code,
          row.titre,
          row.debut,
          formatFcfa(row.total_estime),
        ]),
        appendWaLog(db, {
          codeReservation: row.code,
          destinataireRole: 'client',
          destinataireLabel: `Client (${row.client_nom})`,
          categorie: 'rappel_j1',
          message: `CERIM Rappel J-1 (${row.code}) : Votre arrivée pour ${row.titre} est prévue demain (${row.debut}, ${row.creneau_arrivee || '—'}). Montant à régler sur place : ${formatFcfa(row.total_estime)}.`,
          date: nowIso,
        }),
      ]);
      if (row.statut !== 'bien_pret') {
        await appendWaLog(db, {
          codeReservation: row.code,
          destinataireRole: 'fournisseur',
          destinataireLabel: `Fournisseur [${row.fournisseur_id}] (alerte bien_pret manquant)`,
          categorie: 'rappel_j1',
          message: `CERIM Alerte J-1 (${row.code}) : La checklist « bien prêt » n'est pas encore validée pour ${row.matricule}.`,
          date: nowIso,
        });
      }
    } else {
      await Promise.all([
        sendWhatsAppTemplate(env, row.client_telephone, 'cerim_rappel_jourj_client', [
          row.code,
          formatFcfa(row.total_estime),
        ]),
        sendWhatsAppTemplate(env, supplierPhone, 'cerim_rappel_jourj_fournisseur', [
          row.code,
          row.matricule,
          clientFirstName,
          row.creneau_arrivee || '—',
        ]),
        appendWaLog(db, {
          codeReservation: row.code,
          destinataireRole: 'client',
          destinataireLabel: `Client (${row.client_nom})`,
          categorie: 'rappel_jourj',
          message: `CERIM Jour J (${row.code}) : Bienvenue ! Rappel du lieu d'arrivée dans votre page /suivi et règlement sur place de ${formatFcfa(row.total_estime)}.`,
          date: nowIso,
        }),
        appendWaLog(db, {
          codeReservation: row.code,
          destinataireRole: 'fournisseur',
          destinataireLabel: `Fournisseur [${row.fournisseur_id}]`,
          categorie: 'rappel_jourj',
          message: `CERIM Jour J (${row.code}) : Arrivée aujourd'hui de ${clientFirstName} (${row.creneau_arrivee || '—'}) pour ${row.matricule}.`,
          date: nowIso,
        }),
      ]);
    }
  }

  return changed;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Health check
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse({ status: 'ok', service: 'cerim-whatsapp-worker', d1: Boolean(env.DB) });
    }

    // 1. Webhook vérification Meta (GET)
    if (url.pathname === '/api/webhook/whatsapp' && request.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && env.META_VERIFY_TOKEN && token === env.META_VERIFY_TOKEN && challenge) {
        return new Response(challenge, { status: 200 });
      }
      return new Response('Forbidden', { status: 403 });
    }

    // 2. Webhook entrant Meta (POST + vérification HMAC X-Hub-Signature-256)
    if (url.pathname === '/api/webhook/whatsapp' && request.method === 'POST') {
      const rawBody = await request.text();
      const signature = request.headers.get('X-Hub-Signature-256');
      const isValid = await verifyMetaSignature(rawBody, signature, env.META_APP_SECRET);
      if (!isValid) {
        return jsonResponse({ error: 'Signature invalide' }, 401);
      }

      const payload = parseJsonSafe<{
        entry?: Array<{
          changes?: Array<{
            value?: {
              messages?: Array<{ from?: string; text?: { body?: string } }>;
            };
          }>;
        }>;
      }>(rawBody, {});

      const incoming = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const textUpper = (incoming?.text?.body || '').trim().toUpperCase();

      if (env.DB && incoming?.from && textUpper) {
        const lastDigits = incoming.from.replace(/[^\d]/g, '').slice(-8);
        if (textUpper === 'OUI' && lastDigits.length >= 6) {
          const row = await env.DB.prepare(
            `SELECT * FROM reservations WHERE client_telephone LIKE ? AND statut = 'en_attente_client' ORDER BY cree_le DESC LIMIT 1`
          )
            .bind(`%${lastDigits}`)
            .first<ReservationRow>();
          if (row) {
            await performClientConfirm(env, env.DB, row);
          }
        } else if (textUpper.startsWith('CONFIRMER ')) {
          const code = textUpper.replace('CONFIRMER ', '').trim();
          const row = await env.DB.prepare(
            `SELECT * FROM reservations WHERE code = ? AND statut = 'demandee'`
          )
            .bind(code)
            .first<ReservationRow>();
          if (row) {
            await performSupplierConfirm(env, env.DB, row);
          }
        } else if (textUpper.startsWith('REFUSER ')) {
          const code = textUpper.replace('REFUSER ', '').trim();
          const row = await env.DB.prepare(
            `SELECT * FROM reservations WHERE code = ? AND statut = 'demandee'`
          )
            .bind(code)
            .first<ReservationRow>();
          if (row) {
            await transitionToRefusedWithAlternative(
              env,
              env.DB,
              row,
              'fournisseur',
              'Bien indisponible signalé par le fournisseur via WhatsApp.'
            );
          }
        }
      }
      return jsonResponse({ received: true });
    }

    // Require D1 for all stateful reservation endpoints
    if (!env.DB) {
      return jsonResponse({ error: 'Base D1 non liée dans wrangler.toml' }, 500);
    }
    const db = env.DB;

    // 3. Création réservation (anti-bot + rate limit + blacklist + max 2 en attente + chevauchement D1)
    if (url.pathname === '/api/reservations' && request.method === 'POST') {
      const ipAllowed = await checkRateLimit(env.RATE_LIMIT_KV, `ip:${ip}`, 15, 3600);
      if (!ipAllowed) {
        return jsonResponse({ error: 'Trop de tentatives. Réessayez plus tard.' }, 429);
      }

      const body = (await request.json()) as {
        matricule: string;
        nom: string;
        prenom: string;
        telephone: string;
        debut: string;
        fin: string;
        creneauArrivee?: string;
        message?: string;
        pieceIdentite?: string;
        accepteCgv?: boolean;
        honeypot?: string;
        turnstileToken?: string;
        remplacementDeCode?: string;
        bienMeta?: {
          titre?: string;
          ville?: string;
          quartier?: string;
          prix?: number;
          periode?: PeriodeTarif;
          fournisseurId?: string;
        };
      };

      if (body.honeypot && body.honeypot.trim().length > 0) {
        return jsonResponse({ error: 'Requête rejetée.' }, 400);
      }
      const turnstileOk = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
      if (!turnstileOk) {
        return jsonResponse({ error: 'Vérification anti-robot échouée.' }, 403);
      }
      if (!body.accepteCgv) {
        return jsonResponse(
          { error: 'Vous devez accepter les CGV et la politique d’annulation.' },
          400
        );
      }

      const phoneCheck = validateInternationalPhone(body.telephone || '');
      if (!phoneCheck.valid) {
        return jsonResponse({ error: phoneCheck.error || 'Téléphone invalide.' }, 400);
      }
      const normalizedPhone = phoneCheck.normalized;

      const phoneAllowed = await checkRateLimit(
        env.RATE_LIMIT_KV,
        `tel:${normalizePhoneDigits(normalizedPhone)}`,
        8,
        3600
      );
      if (!phoneAllowed) {
        return jsonResponse({ error: 'Trop de demandes pour ce numéro.' }, 429);
      }

      if (body.pieceIdentite && body.pieceIdentite.length > 1_400_000) {
        return jsonResponse({ error: 'Pièce d’identité trop volumineuse (1 Mo max).' }, 400);
      }

      // Liste noire
      const blRows = await db.prepare('SELECT telephone FROM blacklist').all<{ telephone: string }>();
      const phoneDigits = normalizePhoneDigits(normalizedPhone);
      const isBlacklisted = blRows.results.some(
        (b) => normalizePhoneDigits(b.telephone) === phoneDigits
      );
      if (isBlacklisted) {
        return jsonResponse({ error: 'Réservation impossible, contactez CERIM.' }, 403);
      }

      // Maximum 2 réservations en attente par numéro
      const pending = await db
        .prepare(
          `SELECT client_telephone FROM reservations WHERE statut IN ('en_attente_client', 'demandee')`
        )
        .all<{ client_telephone: string }>();
      const pendingCount = pending.results.filter(
        (p) => normalizePhoneDigits(p.client_telephone) === phoneDigits
      ).length;
      if (pendingCount >= 2) {
        return jsonResponse(
          {
            error:
              'Limite atteinte : vous avez déjà 2 réservations en attente avec ce numéro. Confirmez ou annulez une demande existante.',
          },
          400
        );
      }

      // Disponibilité D1 + Catalogue
      const free = await isRangeAvailableInDb(db, body.matricule, body.debut, body.fin);
      if (!free) {
        return jsonResponse(
          { error: 'Ces dates ne sont plus disponibles pour ce bien.' },
          409
        );
      }

      const catalogMeta = CATALOG_META[body.matricule];
      const titre = catalogMeta?.titre || body.bienMeta?.titre || `Bien ${body.matricule}`;
      const ville = catalogMeta?.ville || body.bienMeta?.ville || 'Brazzaville';
      const quartier = catalogMeta?.quartier || body.bienMeta?.quartier || 'Centre-ville';
      const prix = catalogMeta?.prix || Number(body.bienMeta?.prix || 50000);
      const periode: PeriodeTarif = catalogMeta?.periode || body.bienMeta?.periode || 'nuit';
      const fournisseurId = catalogMeta?.fournisseurId || body.bienMeta?.fournisseurId || 'SUP-INTERNE';

      const estimate = computeEstimate(prix, periode, body.debut, body.fin);
      const settings = await loadEffectiveSettings(env);
      const nowIso = new Date().toISOString();
      const expiresAt = new Date(
        Date.now() + settings.clientConfirmTimeoutMinutes * 60000
      ).toISOString();
      const id = `res-${crypto.randomUUID()}`;
      const code = await generateUniqueCodeD1(db, body.matricule);

      const fullName = `${(body.prenom || '').trim()} ${(body.nom || '').trim()}`.trim();
      const initialHistory: HistoriqueEntry[] = [
        {
          statut: 'en_attente_client',
          date: nowIso,
          auteur: 'client',
          note: body.remplacementDeCode
            ? `Proposition de remplacement suite au dossier ${body.remplacementDeCode}.`
            : 'Demande créée — en attente de réponse « OUI » du client (valable 2h).',
        },
      ];

      await db
        .prepare(
          `INSERT INTO reservations (
            id, code, matricule, titre, ville, quartier, fournisseur_id,
            client_nom, client_prenom, client_telephone, piece_identite, client_message,
            debut, fin, duree_label, total_estime, creneau_arrivee,
            statut, historique_json, remplacement_de_code, expires_at, cree_le
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          code,
          body.matricule,
          titre,
          ville,
          quartier,
          fournisseurId,
          fullName,
          (body.prenom || '').trim(),
          normalizedPhone,
          body.pieceIdentite || null,
          body.message?.trim() || null,
          body.debut,
          body.fin,
          estimate.dureeLabel,
          estimate.total,
          body.creneauArrivee || '13h–15h',
          'en_attente_client',
          JSON.stringify(initialHistory),
          body.remplacementDeCode || null,
          expiresAt,
          nowIso
        )
        .run();

      await Promise.all([
        sendWhatsAppTemplate(env, normalizedPhone, 'cerim_confirmation_oui', [
          (body.prenom || '').trim(),
          code,
          body.matricule,
          body.debut,
        ]),
        appendWaLog(db, {
          codeReservation: code,
          destinataireRole: 'client',
          destinataireLabel: `Client (${fullName})`,
          categorie: 'demande_oui',
          message: `CERIM · Répondez « OUI » sous 2h pour confirmer votre demande ${code} (${body.matricule} du ${body.debut} au ${body.fin}). Paiement sur place : ${formatFcfa(estimate.total)}.`,
          date: nowIso,
        }),
      ]);

      const inserted = await db
        .prepare('SELECT * FROM reservations WHERE code = ?')
        .bind(code)
        .first<ReservationRow>();

      return jsonResponse({
        reservation: inserted ? rowToReservation(inserted) : null,
      });
    }

    // 4. Confirmation client (« OUI ») -> 3 messages simultanés
    const confirmMatch = url.pathname.match(/^\/api\/reservations\/([^/]+)\/confirm$/);
    if (confirmMatch && request.method === 'POST') {
      const code = decodeURIComponent(confirmMatch[1]).toUpperCase();
      const row = await db
        .prepare('SELECT * FROM reservations WHERE code = ?')
        .bind(code)
        .first<ReservationRow>();
      if (!row) return jsonResponse({ error: 'Réservation introuvable.' }, 404);
      try {
        const updated = await performClientConfirm(env, db, row);
        return jsonResponse(rowToReservation(updated));
      } catch (err) {
        return jsonResponse(
          { error: err instanceof Error ? err.message : 'Transition impossible.' },
          400
        );
      }
    }

    // 5. Ajout pièce d'identité compressée côté client
    const identityMatch = url.pathname.match(/^\/api\/reservations\/([^/]+)\/identity$/);
    if (identityMatch && request.method === 'POST') {
      const code = decodeURIComponent(identityMatch[1]).toUpperCase();
      const body = (await request.json()) as { tel4?: string; pieceIdentite?: string };
      const row = await db
        .prepare('SELECT * FROM reservations WHERE code = ?')
        .bind(code)
        .first<ReservationRow>();
      if (!row || normalizePhoneDigits(row.client_telephone).slice(-4) !== (body.tel4 || '').replace(/[^\d]/g, '')) {
        return jsonResponse({ error: 'Vérification téléphonique invalide.' }, 403);
      }
      if (!body.pieceIdentite || body.pieceIdentite.length > 1_400_000) {
        return jsonResponse({ error: 'Image invalide ou supérieure à 1 Mo.' }, 400);
      }
      const history = parseJsonSafe<HistoriqueEntry[]>(row.historique_json, []);
      history.push({
        statut: row.statut,
        date: new Date().toISOString(),
        auteur: 'client',
        note: 'Pièce d’identité transmise par le client.',
      });
      await db
        .prepare(`UPDATE reservations SET piece_identite = ?, historique_json = ? WHERE code = ?`)
        .bind(body.pieceIdentite, JSON.stringify(history), code)
        .run();

      const updated = await db
        .prepare('SELECT * FROM reservations WHERE code = ?')
        .bind(code)
        .first<ReservationRow>();
      return jsonResponse(updated ? rowToReservation(updated) : null);
    }

    // 6. Annulation client ou admin
    const cancelMatch = url.pathname.match(/^\/api\/reservations\/([^/]+)\/cancel$/);
    if (cancelMatch && request.method === 'POST') {
      const code = decodeURIComponent(cancelMatch[1]).toUpperCase();
      const body = (await request.json()) as {
        tel4?: string;
        auteur?: ReservationAuteur;
        motif?: string;
      };
      const row = await db
        .prepare('SELECT * FROM reservations WHERE code = ?')
        .bind(code)
        .first<ReservationRow>();
      if (!row) return jsonResponse({ error: 'Réservation introuvable.' }, 404);

      const adminOk = isAdminAuthorized(request, env);
      const telOk =
        normalizePhoneDigits(row.client_telephone).slice(-4) === (body.tel4 || '').replace(/[^\d]/g, '');

      if (!adminOk && !telOk) {
        return jsonResponse({ error: 'Vérification téléphonique invalide.' }, 403);
      }

      const auteur: ReservationAuteur = adminOk && body.auteur ? body.auteur : 'client';
      const settings = await loadEffectiveSettings(env);
      const hoursLeft = hoursUntilArrival(row.debut);
      const isLateAfterConfirmation =
        (row.statut === 'confirmee' || row.statut === 'bien_pret') &&
        hoursLeft < settings.cancellationHours;

      const targetStatut: StatutReservation = isLateAfterConfirmation ? 'no_show' : 'annulee';
      if (!ALLOWED_TRANSITIONS[row.statut].includes(targetStatut)) {
        return jsonResponse(
          { error: `Transition non autorisée (${row.statut} → ${targetStatut}).` },
          400
        );
      }

      const nowIso = new Date().toISOString();
      const history = parseJsonSafe<HistoriqueEntry[]>(row.historique_json, []);
      const note = isLateAfterConfirmation
        ? `Annulation tardive (< ${settings.cancellationHours}h avant arrivée) — no-show enregistré. ${body.motif || ''}`.trim()
        : body.motif || 'Annulation confirmée sans frais.';
      history.push({ statut: targetStatut, date: nowIso, auteur, note });

      await db
        .prepare(`UPDATE reservations SET statut = ?, historique_json = ? WHERE code = ?`)
        .bind(targetStatut, JSON.stringify(history), code)
        .run();

      const supplierPhones = getSupplierPhoneMap(env);
      const supplierPhone = supplierPhones[row.fournisseur_id] || '';
      await Promise.all([
        sendWhatsAppTemplate(env, row.client_telephone, 'cerim_annulation', [row.code]),
        sendWhatsAppTemplate(env, supplierPhone, 'cerim_annulation', [row.code]),
        appendWaLog(db, {
          codeReservation: row.code,
          destinataireRole: 'client',
          destinataireLabel: `Client (${row.client_nom})`,
          categorie: 'annulation',
          message: isLateAfterConfirmation
            ? `CERIM · Votre annulation tardive (${row.code}) à moins de ${settings.cancellationHours}h de l'arrivée a été enregistrée comme no-show.`
            : `CERIM · Votre réservation ${row.code} est annulée sans frais. Les dates sont libérées.`,
          date: nowIso,
        }),
        appendWaLog(db, {
          codeReservation: row.code,
          destinataireRole: 'fournisseur',
          destinataireLabel: `Fournisseur [${row.fournisseur_id}]`,
          categorie: 'annulation',
          message: `CERIM Annulation ${row.code} : Le bien ${row.matricule} (${row.debut} → ${row.fin}) est libéré.`,
          date: nowIso,
        }),
      ]);

      const updated = await db
        .prepare('SELECT * FROM reservations WHERE code = ?')
        .bind(code)
        .first<ReservationRow>();

      return jsonResponse({
        reservation: updated ? rowToReservation(updated) : null,
        gratuite: !isLateAfterConfirmation,
        message: isLateAfterConfirmation
          ? `Annulation à moins de ${settings.cancellationHours}h avant l’arrivée : contactez CERIM, un no-show a été enregistré.`
          : 'Réservation annulée gratuitement. Les dates ont été libérées.',
      });
    }

    // 7. Réponse client à une alternative proposée
    const altMatch = url.pathname.match(/^\/api\/reservations\/([^/]+)\/alternative$/);
    if (altMatch && request.method === 'POST') {
      const code = decodeURIComponent(altMatch[1]).toUpperCase();
      const body = (await request.json()) as { tel4?: string; accepter?: boolean };
      const original = await db
        .prepare('SELECT * FROM reservations WHERE code = ?')
        .bind(code)
        .first<ReservationRow>();
      if (
        !original ||
        normalizePhoneDigits(original.client_telephone).slice(-4) !== (body.tel4 || '').replace(/[^\d]/g, '')
      ) {
        return jsonResponse({ error: 'Vérification téléphonique invalide.' }, 403);
      }
      if (!original.alternative_propose) {
        return jsonResponse({ error: 'Aucune alternative en attente sur ce dossier.' }, 400);
      }

      if (!body.accepter) {
        const history = parseJsonSafe<HistoriqueEntry[]>(original.historique_json, []);
        history.push({
          statut: 'refusee',
          date: new Date().toISOString(),
          auteur: 'client',
          note: 'Alternative déclinée par le client (aucun frais).',
        });
        await db
          .prepare(
            `UPDATE reservations SET alternative_propose = NULL, historique_json = ? WHERE code = ?`
          )
          .bind(JSON.stringify(history), code)
          .run();
        const updatedOrig = await db
          .prepare('SELECT * FROM reservations WHERE code = ?')
          .bind(code)
          .first<ReservationRow>();
        return jsonResponse({ original: updatedOrig ? rowToReservation(updatedOrig) : null });
      }

      const altMatricule = original.alternative_propose;
      const altMeta = CATALOG_META[altMatricule];
      if (!altMeta) {
        return jsonResponse({ error: 'Le bien alternatif n’est plus au catalogue.' }, 404);
      }
      const free = await isRangeAvailableInDb(db, altMatricule, original.debut, original.fin);
      if (!free) {
        return jsonResponse({ error: 'Ce bien alternatif vient d’être réservé.' }, 409);
      }

      const estimate = computeEstimate(altMeta.prix, altMeta.periode, original.debut, original.fin);
      const nowIso = new Date().toISOString();
      const newCode = await generateUniqueCodeD1(db, altMatricule);
      const newId = `res-${crypto.randomUUID()}`;
      const newHist: HistoriqueEntry[] = [
        {
          statut: 'en_attente_client',
          date: nowIso,
          auteur: 'client',
          note: `Remplacement accepté suite au dossier ${original.code}.`,
        },
      ];

      await db
        .prepare(
          `INSERT INTO reservations (
            id, code, matricule, titre, ville, quartier, fournisseur_id,
            client_nom, client_prenom, client_telephone, piece_identite, client_message,
            debut, fin, duree_label, total_estime, creneau_arrivee,
            statut, historique_json, remplacement_de_code, cree_le
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          newId,
          newCode,
          altMatricule,
          altMeta.titre,
          altMeta.ville,
          altMeta.quartier,
          altMeta.fournisseurId,
          original.client_nom,
          original.client_prenom,
          original.client_telephone,
          original.piece_identite,
          original.client_message,
          original.debut,
          original.fin,
          estimate.dureeLabel,
          estimate.total,
          original.creneau_arrivee,
          'en_attente_client',
          JSON.stringify(newHist),
          original.code,
          nowIso
        )
        .run();

      const insertedNew = await db
        .prepare('SELECT * FROM reservations WHERE code = ?')
        .bind(newCode)
        .first<ReservationRow>();

      const confirmedNew = insertedNew
        ? await performClientConfirm(env, db, insertedNew)
        : null;

      return jsonResponse({
        original: rowToReservation(original),
        nouvelle: confirmedNew ? rowToReservation(confirmedNew) : null,
      });
    }

    // 8. Routes Admin protégées par Bearer ADMIN_TOKEN
    const supplierConfirmMatch = url.pathname.match(
      /^\/api\/reservations\/([^/]+)\/supplier-confirm$/
    );
    if (supplierConfirmMatch && request.method === 'POST') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const code = decodeURIComponent(supplierConfirmMatch[1]).toUpperCase();
      const row = await db.prepare('SELECT * FROM reservations WHERE code = ?').bind(code).first<ReservationRow>();
      if (!row) return jsonResponse({ error: 'Réservation introuvable.' }, 404);
      try {
        const updated = await performSupplierConfirm(env, db, row);
        return jsonResponse(rowToReservation(updated));
      } catch (err) {
        return jsonResponse(
          { error: err instanceof Error ? err.message : 'Transition impossible.' },
          400
        );
      }
    }

    const supplierRefuseMatch = url.pathname.match(
      /^\/api\/reservations\/([^/]+)\/supplier-refuse$/
    );
    if (supplierRefuseMatch && request.method === 'POST') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const code = decodeURIComponent(supplierRefuseMatch[1]).toUpperCase();
      const body = (await request.json().catch(() => ({}))) as { raison?: 'refus' | 'timeout' };
      const row = await db.prepare('SELECT * FROM reservations WHERE code = ?').bind(code).first<ReservationRow>();
      if (!row) return jsonResponse({ error: 'Réservation introuvable.' }, 404);
      if (!ALLOWED_TRANSITIONS[row.statut].includes('refusee')) {
        return jsonResponse(
          { error: `Transition non autorisée (${row.statut} → refusee).` },
          400
        );
      }
      const raison = body.raison === 'timeout' ? 'timeout' : 'refus';
      const updated = await transitionToRefusedWithAlternative(
        env,
        db,
        row,
        raison === 'timeout' ? 'systeme' : 'fournisseur',
        raison === 'timeout'
          ? 'Délai fournisseur (30 min) dépassé — recherche automatique d’alternative.'
          : 'Bien indisponible signalé par le fournisseur.'
      );
      return jsonResponse(rowToReservation(updated));
    }

    const checklistMatch = url.pathname.match(/^\/api\/reservations\/([^/]+)\/checklist$/);
    if (checklistMatch && request.method === 'POST') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const code = decodeURIComponent(checklistMatch[1]).toUpperCase();
      const body = (await request.json()) as { items?: ChecklistItem[] };
      const items = body.items || [];
      if (items.length === 0 || !items.every((it) => it.checked)) {
        return jsonResponse(
          { error: 'Tous les points de la checklist doivent être cochés avant validation.' },
          400
        );
      }
      const row = await db.prepare('SELECT * FROM reservations WHERE code = ?').bind(code).first<ReservationRow>();
      if (!row) return jsonResponse({ error: 'Réservation introuvable.' }, 404);
      if (!ALLOWED_TRANSITIONS[row.statut].includes('bien_pret')) {
        return jsonResponse(
          { error: `Transition non autorisée (${row.statut} → bien_pret).` },
          400
        );
      }

      const nowIso = new Date().toISOString();
      const history = parseJsonSafe<HistoriqueEntry[]>(row.historique_json, []);
      history.push({
        statut: 'bien_pret',
        date: nowIso,
        auteur: 'fournisseur',
        note: 'Checklist préparatoire validée — bien prêt pour l’accueil.',
      });
      const checklistPayload = { valideeLe: nowIso, items };

      await db
        .prepare(
          `UPDATE reservations SET statut = 'bien_pret', checklist_json = ?, historique_json = ? WHERE code = ?`
        )
        .bind(JSON.stringify(checklistPayload), JSON.stringify(history), code)
        .run();

      await Promise.all([
        sendWhatsAppTemplate(env, row.client_telephone, 'cerim_bien_pret', [row.code, row.titre]),
        appendWaLog(db, {
          codeReservation: row.code,
          destinataireRole: 'client',
          destinataireLabel: `Client (${row.client_nom})`,
          categorie: 'confirmation',
          message: `CERIM · Votre bien ${row.titre} (${row.code}) est PRÊT pour votre arrivée (${row.creneau_arrivee || 'selon horaire prévu'}).`,
          date: nowIso,
        }),
      ]);

      const updated = await db.prepare('SELECT * FROM reservations WHERE code = ?').bind(code).first<ReservationRow>();
      return jsonResponse(updated ? rowToReservation(updated) : null);
    }

    const checkinMatch = url.pathname.match(/^\/api\/reservations\/([^/]+)\/checkin$/);
    if (checkinMatch && request.method === 'POST') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const code = decodeURIComponent(checkinMatch[1]).toUpperCase();
      const body = (await request.json()) as {
        photosAvant?: string[];
        paiement?: Omit<PaiementSurPlace, 'date'>;
      };
      const row = await db.prepare('SELECT * FROM reservations WHERE code = ?').bind(code).first<ReservationRow>();
      if (!row) return jsonResponse({ error: 'Réservation introuvable.' }, 404);
      if (!ALLOWED_TRANSITIONS[row.statut].includes('arrivee')) {
        return jsonResponse(
          { error: `Transition non autorisée (${row.statut} → arrivee).` },
          400
        );
      }
      if (!body.paiement) {
        return jsonResponse({ error: 'Détails du paiement sur place requis.' }, 400);
      }

      const nowIso = new Date().toISOString();
      const history = parseJsonSafe<HistoriqueEntry[]>(row.historique_json, []);
      history.push({
        statut: 'arrivee',
        date: nowIso,
        auteur: 'cerim',
        note: `Check-in effectué · Paiement sur place ${formatFcfa(body.paiement.montant)} (${body.paiement.mode}, encaissé par ${body.paiement.encaissePar}).`,
      });
      const paiement: PaiementSurPlace = { ...body.paiement, date: nowIso };
      const currentPhotos = parseJsonSafe<PhotosEtat>(row.photos_etat_json, { avant: [], apres: [] });
      const nextPhotos: PhotosEtat = {
        avant: body.photosAvant || [],
        apres: currentPhotos.apres || [],
      };

      await db
        .prepare(
          `UPDATE reservations SET statut = 'arrivee', paiement_json = ?, photos_etat_json = ?, historique_json = ? WHERE code = ?`
        )
        .bind(JSON.stringify(paiement), JSON.stringify(nextPhotos), JSON.stringify(history), code)
        .run();

      await Promise.all([
        sendWhatsAppTemplate(env, row.client_telephone, 'cerim_recu_paiement', [
          row.code,
          formatFcfa(paiement.montant),
          paiement.mode,
        ]),
        appendWaLog(db, {
          codeReservation: row.code,
          destinataireRole: 'client',
          destinataireLabel: `Client (${row.client_nom})`,
          categorie: 'recu_paiement',
          message: `CERIM · Reçu de paiement sur place (${row.code}) : ${formatFcfa(paiement.montant)} réglé par ${paiement.mode}. Encaissé par : ${paiement.encaissePar}. Bon séjour !`,
          date: nowIso,
        }),
      ]);

      const updated = await db.prepare('SELECT * FROM reservations WHERE code = ?').bind(code).first<ReservationRow>();
      return jsonResponse(updated ? rowToReservation(updated) : null);
    }

    const checkoutMatch = url.pathname.match(/^\/api\/reservations\/([^/]+)\/checkout$/);
    if (checkoutMatch && request.method === 'POST') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const code = decodeURIComponent(checkoutMatch[1]).toUpperCase();
      const body = (await request.json()) as { photosApres?: string[] };
      const row = await db.prepare('SELECT * FROM reservations WHERE code = ?').bind(code).first<ReservationRow>();
      if (!row) return jsonResponse({ error: 'Réservation introuvable.' }, 404);
      if (!ALLOWED_TRANSITIONS[row.statut].includes('terminee')) {
        return jsonResponse(
          { error: `Transition non autorisée (${row.statut} → terminee).` },
          400
        );
      }

      const nowIso = new Date().toISOString();
      const history = parseJsonSafe<HistoriqueEntry[]>(row.historique_json, []);
      history.push({
        statut: 'terminee',
        date: nowIso,
        auteur: 'cerim',
        note: 'État des lieux de sortie validé et séjour terminé.',
      });
      const currentPhotos = parseJsonSafe<PhotosEtat>(row.photos_etat_json, { avant: [], apres: [] });
      const nextPhotos: PhotosEtat = {
        avant: currentPhotos.avant || [],
        apres: body.photosApres || [],
      };

      await db
        .prepare(
          `UPDATE reservations SET statut = 'terminee', photos_etat_json = ?, historique_json = ? WHERE code = ?`
        )
        .bind(JSON.stringify(nextPhotos), JSON.stringify(history), code)
        .run();

      const updated = await db.prepare('SELECT * FROM reservations WHERE code = ?').bind(code).first<ReservationRow>();
      return jsonResponse(updated ? rowToReservation(updated) : null);
    }

    const noShowMatch = url.pathname.match(/^\/api\/reservations\/([^/]+)\/no-show$/);
    if (noShowMatch && request.method === 'POST') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const code = decodeURIComponent(noShowMatch[1]).toUpperCase();
      const body = (await request.json().catch(() => ({}))) as { note?: string };
      const row = await db.prepare('SELECT * FROM reservations WHERE code = ?').bind(code).first<ReservationRow>();
      if (!row) return jsonResponse({ error: 'Réservation introuvable.' }, 404);
      if (!ALLOWED_TRANSITIONS[row.statut].includes('no_show')) {
        return jsonResponse(
          { error: `Transition non autorisée (${row.statut} → no_show).` },
          400
        );
      }

      const nowIso = new Date().toISOString();
      const history = parseJsonSafe<HistoriqueEntry[]>(row.historique_json, []);
      history.push({
        statut: 'no_show',
        date: nowIso,
        auteur: 'cerim',
        note: body.note || 'Client absent à l’heure convenue (no-show enregistré).',
      });

      await db
        .prepare(`UPDATE reservations SET statut = 'no_show', historique_json = ? WHERE code = ?`)
        .bind(JSON.stringify(history), code)
        .run();

      const updated = await db.prepare('SELECT * FROM reservations WHERE code = ?').bind(code).first<ReservationRow>();
      return jsonResponse(updated ? rowToReservation(updated) : null);
    }

    const reminderMatch = url.pathname.match(/^\/api\/reservations\/([^/]+)\/reminder$/);
    if (reminderMatch && request.method === 'POST') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const code = decodeURIComponent(reminderMatch[1]).toUpperCase();
      const body = (await request.json()) as {
        typeRappel: 'rappel_j2' | 'rappel_j1' | 'rappel_jourj';
      };
      const row = await db.prepare('SELECT * FROM reservations WHERE code = ?').bind(code).first<ReservationRow>();
      if (!row) return jsonResponse({ error: 'Réservation introuvable.' }, 404);

      const nowIso = new Date().toISOString();
      const supplierPhones = getSupplierPhoneMap(env);
      const supplierPhone = supplierPhones[row.fournisseur_id] || '';
      const clientFirstName = row.client_prenom || row.client_nom.split(' ')[0] || 'Client';
      const createdLogs: Array<{
        id: string;
        codeReservation: string;
        destinataireRole: 'client' | 'fournisseur' | 'cerim';
        destinataireLabel: string;
        categorie: string;
        message: string;
        date: string;
      }> = [];

      if (body.typeRappel === 'rappel_j2') {
        const msg = `CERIM Rappel J-2 (${row.code}) : Préparez le bien ${row.matricule} pour l'arrivée de ${clientFirstName} le ${row.debut} (${row.creneau_arrivee || '—'}).`;
        await sendWhatsAppTemplate(env, supplierPhone, 'cerim_rappel_j2_fournisseur', [
          row.code,
          row.matricule,
          clientFirstName,
          row.debut,
        ]);
        await appendWaLog(db, {
          codeReservation: row.code,
          destinataireRole: 'fournisseur',
          destinataireLabel: `Fournisseur [${row.fournisseur_id}]`,
          categorie: 'rappel_j2',
          message: msg,
          date: nowIso,
        });
        createdLogs.push({
          id: `wa-${Date.now()}`,
          codeReservation: row.code,
          destinataireRole: 'fournisseur',
          destinataireLabel: `Fournisseur [${row.fournisseur_id}]`,
          categorie: 'rappel_j2',
          message: msg,
          date: nowIso,
        });
      } else if (body.typeRappel === 'rappel_j1') {
        const msg = `CERIM Rappel J-1 (${row.code}) : Votre arrivée pour ${row.titre} est prévue demain (${row.debut}, ${row.creneau_arrivee || '—'}). Montant à régler sur place : ${formatFcfa(row.total_estime)}.`;
        await sendWhatsAppTemplate(env, row.client_telephone, 'cerim_rappel_j1_client', [
          row.code,
          row.titre,
          row.debut,
          formatFcfa(row.total_estime),
        ]);
        await appendWaLog(db, {
          codeReservation: row.code,
          destinataireRole: 'client',
          destinataireLabel: `Client (${row.client_nom})`,
          categorie: 'rappel_j1',
          message: msg,
          date: nowIso,
        });
        createdLogs.push({
          id: `wa-${Date.now()}-c`,
          codeReservation: row.code,
          destinataireRole: 'client',
          destinataireLabel: `Client (${row.client_nom})`,
          categorie: 'rappel_j1',
          message: msg,
          date: nowIso,
        });
      } else {
        const msgC = `CERIM Jour J (${row.code}) : Bienvenue ! Rappel du lieu d'arrivée dans votre page /suivi et règlement sur place de ${formatFcfa(row.total_estime)}.`;
        const msgF = `CERIM Jour J (${row.code}) : Arrivée aujourd'hui de ${clientFirstName} (${row.creneau_arrivee || '—'}) pour ${row.matricule}.`;
        await Promise.all([
          sendWhatsAppTemplate(env, row.client_telephone, 'cerim_rappel_jourj_client', [
            row.code,
            formatFcfa(row.total_estime),
          ]),
          sendWhatsAppTemplate(env, supplierPhone, 'cerim_rappel_jourj_fournisseur', [
            row.code,
            row.matricule,
            clientFirstName,
            row.creneau_arrivee || '—',
          ]),
          appendWaLog(db, {
            codeReservation: row.code,
            destinataireRole: 'client',
            destinataireLabel: `Client (${row.client_nom})`,
            categorie: 'rappel_jourj',
            message: msgC,
            date: nowIso,
          }),
          appendWaLog(db, {
            codeReservation: row.code,
            destinataireRole: 'fournisseur',
            destinataireLabel: `Fournisseur [${row.fournisseur_id}]`,
            categorie: 'rappel_jourj',
            message: msgF,
            date: nowIso,
          }),
        ]);
        createdLogs.push(
          {
            id: `wa-${Date.now()}-c`,
            codeReservation: row.code,
            destinataireRole: 'client',
            destinataireLabel: `Client (${row.client_nom})`,
            categorie: 'rappel_jourj',
            message: msgC,
            date: nowIso,
          },
          {
            id: `wa-${Date.now()}-f`,
            codeReservation: row.code,
            destinataireRole: 'fournisseur',
            destinataireLabel: `Fournisseur [${row.fournisseur_id}]`,
            categorie: 'rappel_jourj',
            message: msgF,
            date: nowIso,
          }
        );
      }
      return jsonResponse({ logs: createdLogs });
    }

    // Endpoints Admin Back-Office
    if (url.pathname === '/api/admin/reservations' && request.method === 'GET') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const rows = await db
        .prepare('SELECT * FROM reservations ORDER BY cree_le DESC LIMIT 250')
        .all<ReservationRow>();
      return jsonResponse({
        reservations: rows.results.map((r) => rowToReservation(r)),
      });
    }

    if (url.pathname === '/api/admin/logs' && request.method === 'GET') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const rows = await db
        .prepare('SELECT * FROM whatsapp_logs ORDER BY date DESC LIMIT 250')
        .all<WhatsAppLogRow>();
      return jsonResponse({
        logs: rows.results.map((l) => ({
          id: l.id,
          codeReservation: l.code_reservation,
          destinataireRole: l.destinataire_role,
          destinataireLabel: l.destinataire_label,
          categorie: l.categorie,
          message: l.message,
          date: l.date,
        })),
      });
    }

    if (url.pathname === '/api/admin/blacklist' && request.method === 'GET') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const rows = await db
        .prepare('SELECT * FROM blacklist ORDER BY ajoute_le DESC')
        .all<BlacklistRow>();
      return jsonResponse({
        blacklist: rows.results.map((b) => ({
          id: b.id,
          telephone: b.telephone,
          motif: b.motif,
          ajouteLe: b.ajoute_le,
        })),
      });
    }

    if (url.pathname === '/api/admin/blacklist' && request.method === 'POST') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const body = (await request.json()) as { telephone: string; motif?: string };
      const tel = (body.telephone || '').trim();
      if (!tel) return jsonResponse({ error: 'Numéro requis.' }, 400);
      const id = `bl-${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();
      await db
        .prepare(
          `INSERT OR IGNORE INTO blacklist (id, telephone, motif, ajoute_le) VALUES (?, ?, ?, ?)`
        )
        .bind(id, tel, (body.motif || '').trim() || 'Incident / no-show répété', nowIso)
        .run();
      const rows = await db.prepare('SELECT * FROM blacklist ORDER BY ajoute_le DESC').all<BlacklistRow>();
      return jsonResponse({
        blacklist: rows.results.map((b) => ({
          id: b.id,
          telephone: b.telephone,
          motif: b.motif,
          ajouteLe: b.ajoute_le,
        })),
      });
    }

    const blDeleteMatch = url.pathname.match(/^\/api\/admin\/blacklist\/([^/]+)$/);
    if (blDeleteMatch && request.method === 'DELETE') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const idOrTel = decodeURIComponent(blDeleteMatch[1]);
      await db
        .prepare('DELETE FROM blacklist WHERE id = ? OR telephone = ?')
        .bind(idOrTel, idOrTel)
        .run();
      const rows = await db.prepare('SELECT * FROM blacklist ORDER BY ajoute_le DESC').all<BlacklistRow>();
      return jsonResponse({
        blacklist: rows.results.map((b) => ({
          id: b.id,
          telephone: b.telephone,
          motif: b.motif,
          ajouteLe: b.ajoute_le,
        })),
      });
    }

    if (url.pathname === '/api/admin/settings' && request.method === 'GET') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      return jsonResponse({ settings: await loadEffectiveSettings(env) });
    }

    if (url.pathname === '/api/admin/settings' && request.method === 'PUT') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const body = (await request.json()) as Partial<{
        cancellationHours: number;
        clientConfirmTimeoutMinutes: number;
        supplierTimeoutMinutes: number;
        encaissementPar: 'CERIM' | 'FOURNISSEUR';
      }>;
      const current = await loadEffectiveSettings(env);
      const next = {
        cancellationHours: Number(body.cancellationHours ?? current.cancellationHours),
        clientConfirmTimeoutMinutes: Number(
          body.clientConfirmTimeoutMinutes ?? current.clientConfirmTimeoutMinutes
        ),
        supplierTimeoutMinutes: Number(
          body.supplierTimeoutMinutes ?? current.supplierTimeoutMinutes
        ),
        encaissementPar:
          body.encaissementPar === 'FOURNISSEUR' ||
          (!body.encaissementPar && current.encaissementPar === 'FOURNISSEUR')
            ? ('FOURNISSEUR' as const)
            : ('CERIM' as const),
      };
      await db
        .prepare(
          `INSERT INTO admin_settings (id, cancellation_hours, client_confirm_minutes, supplier_timeout_minutes, encaissement_par)
           VALUES (1, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             cancellation_hours = excluded.cancellation_hours,
             client_confirm_minutes = excluded.client_confirm_minutes,
             supplier_timeout_minutes = excluded.supplier_timeout_minutes,
             encaissement_par = excluded.encaissement_par`
        )
        .bind(
          next.cancellationHours,
          next.clientConfirmTimeoutMinutes,
          next.supplierTimeoutMinutes,
          next.encaissementPar
        )
        .run();
      return jsonResponse({ settings: next });
    }

    if (url.pathname === '/api/admin/purge' && request.method === 'POST') {
      if (!isAdminAuthorized(request, env)) return jsonResponse({ error: 'Non autorisé.' }, 401);
      const changed = await runMaintenanceAndReminders(env);
      return jsonResponse({ changed });
    }

    // 9. Consultation suivi client + adresse protégée uniquement si statut >= confirmee
    const getMatch = url.pathname.match(/^\/api\/reservations\/([^/]+)(\/acces)?$/);
    if (getMatch && request.method === 'GET') {
      const code = decodeURIComponent(getMatch[1]).toUpperCase();
      const isAccesOnly = Boolean(getMatch[2]);
      const tel4 = (url.searchParams.get('tel4') || '').replace(/[^\d]/g, '');

      const row = await db
        .prepare('SELECT * FROM reservations WHERE code = ?')
        .bind(code)
        .first<ReservationRow>();

      if (!row || normalizePhoneDigits(row.client_telephone).slice(-4) !== tel4) {
        return jsonResponse({ error: 'Réservation introuvable' }, 404);
      }

      if (isAccesOnly) {
        const allowed: StatutReservation[] = ['confirmee', 'bien_pret', 'arrivee', 'terminee'];
        if (!allowed.includes(row.statut)) {
          return jsonResponse({ error: 'Adresse verrouillée jusqu’à confirmation.' }, 403);
        }
        const acces = PRIVATE_ACCESS_MAP[row.matricule] || {
          adresseExacte: `${row.quartier}, ${row.ville} (coordonnées exactes transmises par CERIM)`,
          consignesAcces: 'Présentez votre code CERIM à notre agent sur place.',
          pointRendezVous: `Point de rendez-vous CERIM — ${row.quartier}.`,
        };
        return jsonResponse({
          ...acces,
          contactCerim: env.CERIM_DISPATCH_PHONE || '+242 06 500 00 00',
        });
      }

      return jsonResponse({
        reservation: rowToReservation(row),
        alternativeMatricule: row.alternative_propose || undefined,
      });
    }

    return jsonResponse({ error: 'Route non trouvée' }, 404);
  },

  // Tâche planifiée toutes les 5 min : expiration 2h, timeout fournisseur 30 min, rappels J-2 / J-1 / Jour J
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await runMaintenanceAndReminders(env);
  },
};
