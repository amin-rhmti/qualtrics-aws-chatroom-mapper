# cURL examples

Set a shell var:
```bash
BASE="https://kr98xfirp7.execute-api.us-east-1.amazonaws.com/default"
```

Mapper:
```bash
curl -s "$BASE/individual_group_matching?experimentalUnitID=101" | jq .
```

Mapper write-back:
```bash
curl -s -X POST "$BASE/individual_group_matching?experimentalUnitID=101&lookup_confirmed=1&extra_write_1=pilot"
```

Chat poll:
```bash
curl -s -X POST "$BASE/chat?groupID=1&name=Alice&participantRole=student" | jq .
```

Chat send:
```bash
curl -s -X POST "$BASE/chat?mode=2&groupID=1&name=Alice&participantRole=student&addText=Hello%20everyone" | jq .
```

Complete:
```bash
curl -s -X POST "$BASE/complete" | jq .
```
