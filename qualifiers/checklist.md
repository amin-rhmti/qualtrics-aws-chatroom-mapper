# Go/No-Go Checklist (Pre-Field)

- [ ] **CSV** bundled in Lambda zip root as `individual_group_matching.csv`.
- [ ] **Lambda env vars** set: `DDB_TABLE_WRITES`, `CHAT_TABLE`, `RESOURCE_DIR=/var/task`, `CSV_FILE=individual_group_matching.csv`.
- [ ] **DynamoDB tables** exist with correct attribute names:
      - ChatEvents: `room` (PK, S) + `ts` (SK, N or S).
      - MapperWrites: `unitID` (PK, S).
- [ ] **API Gateway** REST, Lambda proxy, stage = `default`.
- [ ] **CORS** headers verified from Lambda (OPTIONS/GET/POST).
- [ ] **Qualtrics ED** wired (`serverURL`, `experimentalUnitID`, `typed_name`, `ResponseID`, `chatDuration`).
- [ ] **Mapper page** sets `groupID` and `participantRole` from GET response.
- [ ] **Chat page** polling and send tested with two tabs.
- [ ] **Failure paths** (404 ID, network fail) show user-friendly message.
