#!/usr/bin/env bash
set -euo pipefail

BASE=""
ID=""
ROOM=""
NAME="Alice"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="$2"; shift 2;;
    --id) ID="$2"; shift 2;;
    --room) ROOM="$2"; shift 2;;
    --name) NAME="$2"; shift 2;;
    *) shift;;
  esac
done

test -n "$BASE" || { echo "--base required"; exit 1; }

echo "# 1) CORS preflight"
curl -s -i -X OPTIONS "$BASE/individual_group_matching" | sed -n '1,20p'

if [[ -n "$ID" ]]; then
  echo "# 2) Mapper GET"
  curl -s "$BASE/individual_group_matching?experimentalUnitID=$ID" | jq .
fi

if [[ -n "$ROOM" ]]; then
  echo "# 3) Chat poll"
  curl -s -X POST "$BASE/chat?groupID=$ROOM&name=$NAME&participantRole=student" | jq .

  echo "# 4) Chat send"
  curl -s -X POST "$BASE/chat?mode=2&groupID=$ROOM&name=$NAME&participantRole=student&addText=Hello%20World" | jq .
fi
