# CERIM — Déploiement du Worker WhatsApp (Cloudflare Workers + D1 + Meta Cloud API)

Ce dossier contient le backend léger à déployer séparément pour activer la persistance **Cloudflare D1**, les messages **WhatsApp Meta Cloud API** réels, les webhooks signés et les rappels automatiques (`J-2`, `J-1`, `Jour J`).

> **Sécurité** : aucune clé secrète ni numéro de téléphone de fournisseur ne doit figurer dans le dépôt Git. Tout passe par `wrangler secret put`.

---

## 1. Déploiement rapide en 2 commandes (script automatisé)

Depuis votre ordinateur (avec Node.js installé) :

```bash
cd worker
npx wrangler login
chmod +x deploy.sh && ./deploy.sh
```

Le script `deploy.sh` automatise :
1. L'installation de `wrangler` et la vérification de votre session Cloudflare.
2. La création de la base D1 **`cerim_reservations`** et du namespace KV **`RATE_LIMIT_KV`** (réutilisation si déjà existants).
3. L'écriture des identifiants dans `wrangler.toml`.
4. L'application complète de `./src/schema.sql` (`reservations`, `blacklist`, `whatsapp_logs`, `admin_settings`).
5. La saisie guidée des secrets via `wrangler secret put`.
6. Le déploiement final et l'affichage de l'URL du webhook Meta.

---

## 2. Pré-requis Meta Cloud API (WhatsApp Business)
1. Créer une application Meta dans [developers.facebook.com](https://developers.facebook.com/) et activer le produit **WhatsApp**.
2. Noter votre **Phone Number ID** (`META_PHONE_NUMBER_ID`), générer un **Access Token permanent** (System User) et récupérer votre **App Secret** (`META_APP_SECRET`).
3. Soumettre et faire approuver les modèles de messages (Templates, langue `fr`) :
   - `cerim_confirmation_oui` : demande de confirmation par réponse « OUI » sous 2h.
   - `cerim_client_en_attente` : accuse réception au client après réponse « OUI ».
   - `cerim_fournisseur_demande` : notification au fournisseur (contient uniquement : `{{code}}`, `{{matricule}}`, `{{prenom_client}}`, `{{dates_et_creneau}}`, avec invitation à répondre `CONFIRMER {{code}}` ou `REFUSER {{code}}`).
   - `cerim_copie_interne` : copie vers l'équipe CERIM.
   - `cerim_reservation_confirmee` : confirmation finale avec lien `/suivi`.
   - `cerim_remplacement_propose` / `cerim_indisponible_sans_alt` : proposition d'alternative équivalente (±20 %).
   - `cerim_bien_pret` : notification checklist validée.
   - `cerim_recu_paiement` / `cerim_annulation` : reçu sur place et annulation.
   - `cerim_rappel_j2_fournisseur` / `cerim_rappel_j1_client` / `cerim_rappel_jourj_client` / `cerim_rappel_jourj_fournisseur`.

Configurer ensuite le webhook dans Meta :
- **Callback URL** : `https://<votre-worker>.workers.dev/api/webhook/whatsapp`
- **Verify Token** : la valeur passée dans `META_VERIFY_TOKEN`.
- S'abonner au champ `messages`.

---

## 3. Routes exposées par le Worker

### Routes publiques / client (protégées par Turnstile + Rate Limit + `tel4`)
- `GET /api/health`
- `GET` & `POST /api/webhook/whatsapp` (signature HMAC `X-Hub-Signature-256`)
- `POST /api/reservations`
- `POST /api/reservations/:code/confirm`
- `GET /api/reservations/:code?tel4=XXXX`
- `GET /api/reservations/:code/acces?tel4=XXXX` (déverrouillé uniquement si statut `>= confirmee`)
- `POST /api/reservations/:code/cancel`
- `POST /api/reservations/:code/identity`
- `POST /api/reservations/:code/alternative`

### Routes Back-Office (protégées par `Authorization: Bearer <ADMIN_TOKEN>`)
- `GET /api/admin/reservations`, `GET /api/admin/logs`
- `GET` / `POST /api/admin/blacklist`, `DELETE /api/admin/blacklist/:id`
- `GET` / `PUT /api/admin/settings`, `POST /api/admin/purge`
- `POST /api/reservations/:code/supplier-confirm`
- `POST /api/reservations/:code/supplier-refuse`
- `POST /api/reservations/:code/checklist`
- `POST /api/reservations/:code/checkin`
- `POST /api/reservations/:code/checkout`
- `POST /api/reservations/:code/no-show`
- `POST /api/reservations/:code/reminder`

---

## 4. Basculer le front-end CERIM sur l'API réelle
Dans les variables d'environnement de déploiement du front-end :
```env
VITE_GATEWAY_MODE=http
VITE_API_URL=https://<votre-worker>.workers.dev
```

En mode `VITE_GATEWAY_MODE=http`, utilisez votre secret `ADMIN_TOKEN` sur l'écran de connexion `#/admin` et `#/admin/checkin` pour authentifier les actions du back-office.
