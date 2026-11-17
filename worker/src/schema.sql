-- CERIM — Schéma SQL Cloudflare D1 complet (Réservations, Blacklist, Logs WhatsApp, Paramètres)

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  matricule TEXT NOT NULL,
  titre TEXT NOT NULL,
  ville TEXT NOT NULL,
  quartier TEXT NOT NULL,
  fournisseur_id TEXT NOT NULL,
  client_nom TEXT NOT NULL,
  client_prenom TEXT NOT NULL,
  client_telephone TEXT NOT NULL,
  piece_identite TEXT,
  client_message TEXT,
  debut TEXT NOT NULL,
  fin TEXT NOT NULL,
  duree_label TEXT NOT NULL,
  total_estime INTEGER NOT NULL,
  creneau_arrivee TEXT,
  statut TEXT NOT NULL,
  historique_json TEXT NOT NULL,
  checklist_json TEXT,
  alternative_propose TEXT,
  remplacement_de_code TEXT,
  paiement_json TEXT,
  photos_etat_json TEXT,
  expires_at TEXT,
  supplier_deadline_at TEXT,
  cree_le TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reservations_code ON reservations(code);
CREATE INDEX IF NOT EXISTS idx_reservations_statut ON reservations(statut);
CREATE INDEX IF NOT EXISTS idx_reservations_phone ON reservations(client_telephone);
CREATE INDEX IF NOT EXISTS idx_reservations_matricule ON reservations(matricule);

CREATE TABLE IF NOT EXISTS blacklist (
  id TEXT PRIMARY KEY,
  telephone TEXT UNIQUE NOT NULL,
  motif TEXT NOT NULL,
  ajoute_le TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id TEXT PRIMARY KEY,
  code_reservation TEXT NOT NULL,
  destinataire_role TEXT NOT NULL,
  destinataire_label TEXT NOT NULL,
  categorie TEXT NOT NULL,
  message TEXT NOT NULL,
  date TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_date ON whatsapp_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_code ON whatsapp_logs(code_reservation);

CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cancellation_hours INTEGER NOT NULL DEFAULT 24,
  client_confirm_minutes INTEGER NOT NULL DEFAULT 120,
  supplier_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  encaissement_par TEXT NOT NULL DEFAULT 'CERIM'
);

INSERT OR IGNORE INTO admin_settings (
  id,
  cancellation_hours,
  client_confirm_minutes,
  supplier_timeout_minutes,
  encaissement_par
) VALUES (1, 24, 120, 30, 'CERIM');
