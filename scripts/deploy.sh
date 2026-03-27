#!/bin/bash
# ---------------------------------------------------------------------------
# FC Squad AI — Vercel Deployment Script
# ---------------------------------------------------------------------------
# Usage:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh          # Interactive (prompts for login)
#   ./scripts/deploy.sh --token <TOKEN>  # Non-interactive with token
# ---------------------------------------------------------------------------

set -euo pipefail

cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════════════════"
echo "  FC Squad AI — Vercel Deployment"
echo "═══════════════════════════════════════════════════"

# --- Parse arguments ---
TOKEN=""
if [[ "${1:-}" == "--token" && -n "${2:-}" ]]; then
  TOKEN="$2"
fi

# --- Authentication ---
if [[ -n "$TOKEN" ]]; then
  echo "▸ Using provided token for authentication..."
  vercel login --token "$TOKEN" 2>&1 || true
elif ! vercel whoami &>/dev/null; then
  echo ""
  echo "⚠️  Vercel authentication required."
  echo "   You can authenticate in one of two ways:"
  echo ""
  echo "   1. Get a token from https://vercel.com/account/tokens"
  echo "      Then run: ./scripts/deploy.sh --token <YOUR_TOKEN>"
  echo ""
  echo "   2. Or re-run this script to start the browser auth flow."
  echo ""
  echo "▸ Starting browser auth flow..."
  vercel login
fi

echo ""
echo "✓ Authenticated as: $(vercel whoami 2>&1 | head -1)"

# --- Link project (skip if already linked) ---
if [[ ! -f .vercel/project.json ]]; then
  echo ""
  echo "▸ Linking to Vercel..."
  vercel link --yes
else
  echo "▸ Already linked to Vercel project."
fi

# --- Deploy (production) ---
echo ""
echo "▸ Deploying to Vercel (production)..."
echo ""

vercel deploy --prod --yes \
  --build-env NODE_ENV=production

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Deployment complete!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "  1. Set environment variables in Vercel Dashboard:"
echo "     - GOOGLE_GENERATIVE_AI_KEY (for AI chat)"
echo "     - NEXON_API_KEY (for Nexon API metadata)"
echo "     - NEXON_APP_ID=258842"
echo "  2. Verify the site at the URL shown above"
echo "  3. Test key features:"
echo "     - Homepage loads"
echo "     - Player search works"
echo "     - Squad builder generates squads"
echo "     - Chat interface responds"
echo ""
