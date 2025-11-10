# Architecture

## Endpoints

### GET `/individual_group_matching?experimentalUnitID=...`
- **200**: JSON subset of the CSV row (e.g., `groupID`, `participantRole`, optional `experimentalUnitID_confirmation`, any `extra_read_*` present), plus `lookup_confirmed` echo and `_persisted` flag if writes table is connected.
- **404**: when ID missing from CSV.
- **400/500**: invalid input / missing CSV.

### POST `/individual_group_matching`
- Telemetry/write-backs: the Lambda accepts querystring writes (`lookup_confirmed`, `extra_write_1..3`) and persists to the **MapperWrites** table keyed by `unitID` (string).
- Returns 200 with small confirmation/echo.

### POST `/chat`
- **Polling** (no outgoing): send query params `{ groupID, name, participantRole, ... }` and receive `{ chat: "<html>", count }` for rendering (HTML is line-broken text).
- **Sending**: `mode=2` with `addText` to write a new message. The Lambda writes to **ChatEvents** with keys `{ room=<groupID>, ts=<now ms (N or S)>, sender, role, text }`.

> The Lambda dynamically detects if `ts` is `S` or `N` on the table and writes accordingly to avoid schema mismatch.

### POST `/complete`
- Returns `{ ok: true }`. (Hook to log a final event or archive transcript if you extend it.)

## Storage

- **CSV**: bundled at `/var/task/individual_group_matching.csv`, cold-loaded into an in-memory dict keyed by `experimentalUnitID`.
- **DynamoDB**
  - **ChatEvents**: PK = `room` (String), SK = `ts` (Number or String). Items: `room`, `ts`, `sender`, `role`, `text`.
  - **MapperWrites**: PK = `unitID` (String). Attributes you may set: `lookup_confirmed`, `extra_write_1..3`.

## CORS
Returned on all relevant responses:
```
Access-Control-Allow-Origin: https://illinois.qualtrics.com
Access-Control-Allow-Headers: Content-Type,Authorization,X-Api-Key
Access-Control-Allow-Methods: GET,POST,OPTIONS
Content-Type: application/json
```

## Notes / Extensibility
- You can add more `extra_read_*` columns to the CSV and pass them through.
- Add `condition`, `section`, etc. to CSV and they’ll be available after lookup.
- For a JSON API surface, extend the Lambda to parse `event['body']` and map to the same fields.
