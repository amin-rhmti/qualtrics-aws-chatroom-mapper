# Qualtrics ↔ AWS Chatroom Mapper

Production-ready starter for a single AWS Lambda (`individual_group_matching`) behind API Gateway that:
- **GET `/individual_group_matching`**: lookup `experimentalUnitID` → returns `groupID`, `participantRole`, optional flags from a CSV bundled in the Lambda.
- **POST `/individual_group_matching`**: telemetry/write-backs (e.g., `lookup_confirmed`, `extra_write_*`) to a DynamoDB “mapper writes” table.
- **POST `/chat`**: poll/send chat events in a DynamoDB table.
- **POST `/complete`**: mark completion and (optionally) persist transcript/metadata.

**API Base URL (example stage):**
```
https://kr98xfirp7.execute-api.us-east-1.amazonaws.com/default
```

**CORS (returned by Lambda on relevant responses)**
```
Access-Control-Allow-Origin: https://illinois.qualtrics.com
Access-Control-Allow-Headers: Content-Type,Authorization,X-Api-Key
Access-Control-Allow-Methods: GET,POST,OPTIONS
```

---

## Quickstart (≈5–10 minutes)

### 0) Prereqs
- AWS account + IAM user/role with permissions for Lambda, API Gateway, DynamoDB, CloudWatch.
- AWS CLI configured (`aws configure`).
- Bash + `zip` (macOS/Linux or WSL).
- Your `assets/individual_group_matching.csv` and `lambda/individual_group_matching.py` (verbatim).

### 1) Create DynamoDB tables
```bash
./scripts/create_dynamodb_tables.sh   --chat-table ChatEvents   --writes-table MapperWrites
```
This creates:
- **ChatEvents**: PK = `room` (S), SK = `ts` (N) by default (or `S` if you switch in docs).
- **MapperWrites**: PK = `unitID` (S). (This is the name used by the current Lambda.)

### 2) Zip the Lambda **with the CSV at the zip root**
```bash
./scripts/zip_lambda.sh
# outputs build/lambda.zip
```

### 3) Create or Update the Lambda + Env Vars
```bash
./scripts/deploy_lambda_cli.sh   --function individual_group_matching   --chat-table ChatEvents   --writes-table MapperWrites
```

### 4) API Gateway (Lambda proxy)
- REST API → ANY/`/individual_group_matching` + ANY/`/chat` + ANY/`/complete` → **Lambda proxy** = `individual_group_matching`.
- Stage name: `default` (so your base URL matches this repo).
- OPTIONS can be passed through (Lambda returns CORS).

### 5) Wire Qualtrics
- Put the base URL in Embedded Data `serverURL`:  
  `https://kr98xfirp7.execute-api.us-east-1.amazonaws.com/default`
- Test the mapper from your browser:
  ```
  https://kr98xfirp7.execute-api.us-east-1.amazonaws.com/default/individual_group_matching?experimentalUnitID=101
  ```

---

## Data Flow (ASCII)

```
Qualtrics (browser)
    |  GET mapper, POST telemetry/chat/complete
    v
API Gateway (REST, Lambda proxy)
    v
Lambda: individual_group_matching
    |-- cold start → load CSV into memory
    |-- DDB: MapperWrites (lookup_confirmed + extra_* writes)
    '-- DDB: ChatEvents (join/message/leave, ordered by ts)
```

- CSV path inside Lambda: `/var/task/individual_group_matching.csv` (cold-loaded to memory)
- `ts` stored as **Number** or **String**; Lambda auto-detects and adapts.

---

## Where to next?
- **Qualtrics guide:** `docs/SETUP_QUALTRICS.md`
- **AWS deploy guide:** `docs/DEPLOY_AWS.md`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Testing:** `docs/TESTING.md`
- **FAQ:** `docs/FAQ.md`

MIT Licensed. PRs welcome.
