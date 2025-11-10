#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 --function NAME --chat-table ChatEvents --writes-table MapperWrites"; exit 1; }

FUNC=""
CHAT=""
WRITES=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --function) FUNC="$2"; shift 2;;
    --chat-table) CHAT="$2"; shift 2;;
    --writes-table) WRITES="$2"; shift 2;;
    *) usage;;
  esac
done

test -n "$FUNC" && test -n "$CHAT" && test -n "$WRITES" || usage
test -f build/lambda.zip || { echo "build/lambda.zip missing. Run scripts/zip_lambda.sh"; exit 1; }

aws lambda update-function-code --function-name "$FUNC" --zip-file fileb://build/lambda.zip >/dev/null

aws lambda update-function-configuration   --function-name "$FUNC"   --environment "Variables={DDB_TABLE_WRITES=$WRITES,CHAT_TABLE=$CHAT,RESOURCE_DIR=/var/task,CSV_FILE=individual_group_matching.csv}" >/dev/null

echo "Deployed $FUNC with CHAT_TABLE=$CHAT and DDB_TABLE_WRITES=$WRITES"
