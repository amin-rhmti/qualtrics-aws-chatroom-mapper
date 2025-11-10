#!/usr/bin/env bash
set -euo pipefail

usage(){ echo "Usage: $0 --chat-table ChatEvents --writes-table MapperWrites"; exit 1; }

CHAT=""
WRITES=""
REGION="${AWS_REGION:-us-east-1}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --chat-table) CHAT="$2"; shift 2;;
    --writes-table) WRITES="$2"; shift 2;;
    *) usage;;
  esac
done
test -n "$CHAT" && test -n "$WRITES" || usage

echo "Creating $CHAT (PK: room [S], SK: ts [N])"
aws dynamodb create-table   --region "$REGION"   --table-name "$CHAT"   --attribute-definitions AttributeName=room,AttributeType=S AttributeName=ts,AttributeType=N   --key-schema AttributeName=room,KeyType=HASH AttributeName=ts,KeyType=RANGE   --billing-mode PAY_PER_REQUEST >/dev/null || echo "Exists"

echo "Creating $WRITES (PK: unitID [S])"
aws dynamodb create-table   --region "$REGION"   --table-name "$WRITES"   --attribute-definitions AttributeName=unitID,AttributeType=S   --key-schema AttributeName=unitID,KeyType=HASH   --billing-mode PAY_PER_REQUEST >/dev/null || echo "Exists"

echo "Done."
