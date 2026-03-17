#!/usr/bin/env bash
# Mark all "remote only" migration versions as reverted so the CLI stops
# complaining "Remote migration versions not found in local migrations directory".
# Run from repo root: ./scripts/supabase-repair-remote-migrations.sh
# Then run: npx supabase db push  (to apply any new local migrations)

set -e
cd "$(dirname "$0")/.."

echo "Fetching migration list..."
LIST=$(npx supabase migration list 2>&1) || true

# Extract remote-only versions (second column when first is empty)
VERSIONS=$(echo "$LIST" | awk -F'|' '
  $1 ~ /^[[:space:]]*$/ && $2 ~ /^[[:space:]]*[0-9]+[0-9]*[[:space:]]*$/ {
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
    if ($2 != "") print $2
  }
' | sort -u)

COUNT=$(echo "$VERSIONS" | grep -c . || true)
if [ -z "$COUNT" ] || [ "$COUNT" -eq 0 ]; then
  echo "No remote-only versions to repair."
  exit 0
fi

echo "Marking $COUNT remote-only migration(s) as reverted..."
for ver in $VERSIONS; do
  npx supabase migration repair --status reverted "$ver" 2>/dev/null || true
done
echo "Done. Run: npx supabase db push"
exit 0
