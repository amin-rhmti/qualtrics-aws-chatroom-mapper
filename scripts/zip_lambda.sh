#!/usr/bin/env bash
set -euo pipefail
mkdir -p build

# Ensure required files
test -f lambda/individual_group_matching.py
if ! test -f assets/individual_group_matching.csv; then
  echo "WARNING: assets/individual_group_matching.csv missing; using sample."
fi

rm -f build/lambda.zip
# Put files at zip root so Lambda sees CSV at /var/task/
(
  cd lambda
  cp ../assets/individual_group_matching.csv . 2>/dev/null || true
  zip -qr ../build/lambda.zip individual_group_matching.py individual_group_matching.csv
)
echo "Wrote build/lambda.zip"
sha256sum build/lambda.zip 2>/dev/null || shasum -a 256 build/lambda.zip || true
