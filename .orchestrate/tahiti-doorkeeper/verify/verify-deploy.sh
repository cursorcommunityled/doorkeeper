#!/usr/bin/env bash
# Verifier script for deploy-cloudflare acceptance criteria
set -euo pipefail

BASE_URL="${BASE_URL:-https://tahiti-meetup-doorkeeper.pf-container-routes.workers.dev}"

echo "=== HTTPS HEAD / ==="
STATUS=$(curl -sI -o /dev/null -w "%{http_code}" "$BASE_URL/")
echo "HTTP $STATUS"
test "$STATUS" = "200"

echo "=== Branding ==="
BODY=$(curl -s "$BASE_URL/")
echo "$BODY" | grep -q "CURSOR"
echo "$BODY" | grep -q "Tahiti Meetup"
echo "branding: ok"

echo "=== Static assets ==="
for path in "/script.js" "/styles.css" "/assets/cursor-logo.png" "/assets/fonts/CursorGothic-Regular.woff2" "/demo/person.webm"; do
  code=$(curl -sI -o /dev/null -w "%{http_code}" "$BASE_URL$path")
  echo "$path -> $code"
  test "$code" = "200"
done

echo "=== Demo mode ==="
DEMO_STATUS=$(curl -sI -o /dev/null -w "%{http_code}" "$BASE_URL/?demo")
echo "/?demo -> $DEMO_STATUS"
test "$DEMO_STATUS" = "200"

echo "ALL CHECKS PASSED"
