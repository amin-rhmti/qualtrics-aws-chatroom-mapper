# Testing

## Mapper
```bash
curl -sS "<BASE>/individual_group_matching?experimentalUnitID=101" | jq .
```

## Chat (two terminals)

### Poll loop (Terminal A)
```bash
watch -n 1 -- curl -sS -X POST "<BASE>/chat?groupID=1&name=Alice&participantRole=student"
```

### Send messages (Terminal B)
```bash
curl -sS -X POST "<BASE>/chat?mode=2&groupID=1&name=Bob&participantRole=student&addText=Hello%20Alice"
```

### Export JSON (optional)
```bash
curl -sS -X POST "<BASE>/chat?groupID=1&export=1&format=json" | jq -r '.chatLogJSON' | jq .
```

## Complete
```bash
curl -sS -X POST "<BASE>/complete" | jq .
```
