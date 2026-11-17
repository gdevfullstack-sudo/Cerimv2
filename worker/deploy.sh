#!/usr/bin/env bash
set -euo pipefail

# Script de déploiement clé en main du Worker CERIM (Cloudflare Workers + D1 + KV + Secrets Meta)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  CERIM — Déploiement Cloudflare Worker (D1 + KV + Meta)"
echo "============================================================"

if ! command -v node >/dev/null 2>&1; then
  echo "Erreur : Node.js est requis pour exécuter ce script."
  exit 1
fi

echo "1/6 · Vérification de la session Cloudflare Wrangler..."
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  npm --prefix "$SCRIPT_DIR" install --no-audit --no-fund
fi

if ! npx wrangler whoami >/dev/null 2>&1; then
  echo ""
  echo "Vous n'êtes pas encore connecté à Cloudflare."
  echo "Exécutez d'abord : npx wrangler login"
  echo "Puis relancez   : ./deploy.sh"
  exit 1
fi

echo "2/6 · Provisioning de la base D1 'cerim_reservations'..."
D1_ID=""
if D1_LIST_JSON=$(npx wrangler d1 list --json 2>/dev/null); then
  D1_ID=$(node -e "const d=JSON.parse(process.argv[1]||'[]'); const f=d.find(x=>x.name==='cerim_reservations'); console.log(f?f.uuid||'':'');" "$D1_LIST_JSON")
fi

if [ -z "$D1_ID" ]; then
  echo "Création de la base D1 cerim_reservations..."
  npx wrangler d1 create cerim_reservations >/dev/null
  D1_LIST_JSON=$(npx wrangler d1 list --json)
  D1_ID=$(node -e "const d=JSON.parse(process.argv[1]||'[]'); const f=d.find(x=>x.name==='cerim_reservations'); console.log(f?f.uuid||'':'');" "$D1_LIST_JSON")
fi
echo "   -> D1 ID : ${D1_ID}"

echo "3/6 · Provisioning du namespace KV 'RATE_LIMIT_KV'..."
KV_ID=""
if KV_LIST_JSON=$(npx wrangler kv namespace list 2>/dev/null || npx wrangler kv:namespace list 2>/dev/null); then
  KV_ID=$(node -e "const d=JSON.parse(process.argv[1]||'[]'); const f=d.find(x=>(x.title||'').includes('RATE_LIMIT_KV')); console.log(f?f.id||'':'');" "$KV_LIST_JSON")
fi

if [ -z "$KV_ID" ]; then
  echo "Création du namespace KV RATE_LIMIT_KV..."
  npx wrangler kv namespace create RATE_LIMIT_KV >/dev/null 2>&1 || npx wrangler kv:namespace create RATE_LIMIT_KV >/dev/null
  KV_LIST_JSON=$(npx wrangler kv namespace list 2>/dev/null || npx wrangler kv:namespace list)
  KV_ID=$(node -e "const d=JSON.parse(process.argv[1]||'[]'); const f=d.find(x=>(x.title||'').includes('RATE_LIMIT_KV')); console.log(f?f.id||'':'');" "$KV_LIST_JSON")
fi
echo "   -> KV ID : ${KV_ID}"

echo "4/6 · Mise à jour automatique de wrangler.toml..."
node -e "
const fs = require('fs');
const d1Id = process.argv[1];
const kvId = process.argv[2];
const content = \`name = \"cerim-whatsapp-worker\"
main = \"src/index.ts\"
compatibility_date = \"2026-10-01\"

[vars]
CANCELLATION_HOURS = \"24\"
CLIENT_CONFIRM_MINUTES = \"120\"
SUPPLIER_TIMEOUT_MINUTES = \"30\"
ENCAISSEMENT_PAR = \"CERIM\"

[[d1_databases]]
binding = \"DB\"
database_name = \"cerim_reservations\"
database_id = \"\${d1Id}\"

[[kv_namespaces]]
binding = \"RATE_LIMIT_KV\"
id = \"\${kvId}\"

[triggers]
crons = [\"*/5 * * * *\"]
\`;
fs.writeFileSync('wrangler.toml', content, 'utf8');
" "$D1_ID" "$KV_ID"

echo "5/6 · Application du schéma SQL sur Cloudflare D1 (remote)..."
npx wrangler d1 execute cerim_reservations --remote --file=./src/schema.sql

echo "6/6 · Configuration des secrets Cloudflare (laissez vide + Entrée pour conserver l'existant)..."
prompt_secret() {
  local name="$1"
  local hint="$2"
  echo ""
  read -r -s -p "   Secret ${name} (${hint}) : " val
  echo ""
  if [ -n "$val" ]; then
    printf "%s" "$val" | npx wrangler secret put "$name"
  else
    echo "   -> Ignoré (conservé tel quel si déjà défini)."
  fi
}

prompt_secret "META_WHATSAPP_TOKEN" "Token permanent WhatsApp Cloud API"
prompt_secret "META_PHONE_NUMBER_ID" "ID du numéro WhatsApp Business"
prompt_secret "META_VERIFY_TOKEN" "Mot de passe choisi pour vérifier le webhook Meta"
prompt_secret "META_APP_SECRET" "App Secret Meta pour signature HMAC"
prompt_secret "CERIM_DISPATCH_PHONE" "Numéro WhatsApp interne CERIM ex: +242065000000"
prompt_secret "ADMIN_TOKEN" "Jeton secret utilisé pour se connecter à #/admin en mode HTTP"
prompt_secret "SUPPLIER_PHONES_JSON" "JSON sur 1 ligne ex: {\"SUP-01\":\"+24206...\"}"
prompt_secret "TURNSTILE_SECRET_KEY" "Optionnel — clé secrète Cloudflare Turnstile"

echo ""
echo "Déploiement du Worker en production..."
DEPLOY_OUT=$(npx wrangler deploy)
echo "$DEPLOY_OUT"

WORKER_URL=$(echo "$DEPLOY_OUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -n 1 || true)

echo ""
echo "============================================================"
echo "  Déploiement CERIM terminé !"
if [ -n "$WORKER_URL" ]; then
  echo "  URL Worker         : ${WORKER_URL}"
  echo "  Webhook Meta URL   : ${WORKER_URL}/api/webhook/whatsapp"
  echo ""
  echo "  Variables front-end à configurer sur votre hébergeur :"
  echo "    VITE_GATEWAY_MODE=http"
  echo "    VITE_API_URL=${WORKER_URL}"
fi
echo "============================================================"
