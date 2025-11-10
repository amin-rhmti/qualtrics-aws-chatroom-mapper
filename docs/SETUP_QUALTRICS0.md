# Qualtrics Setup

## Embedded Data (ED)

Inputs you should create and/or set:
- `serverURL` (string) → e.g., `https://kr98xfirp7.execute-api.us-east-1.amazonaws.com/default`
- `experimentalUnitID` (string) → from an earlier text question
- `typed_name` (string) → from an earlier text question
- `ResponseID` (string) → built-in by Qualtrics
- Will be **filled by mapper**:
  - `groupID` (string)
  - `participantRole` (string)
  - `chatName` (optional)
  - any optional fields like `condition`, `section`
- Chat control:
  - `chatDuration` (integer seconds)
- Outputs:
  - `chatTranscript` (long text)
  - `chatStatus` (`timer` | `exitButton` | `unload` | `error`)

## Mapper Page (JS)
On the page after ID entry, run a short JS to fetch mapping and set ED.

```js
Qualtrics.SurveyEngine.addOnload(function () {
  var id = "${e://Field/experimentalUnitID}".trim();
  var base = "${e://Field/serverURL}";
  if (!id || !base) return;

  var url = base + "/individual_group_matching?experimentalUnitID=" + encodeURIComponent(id);

  fetch(url, { method: "GET" })
    .then(r => r.ok ? r.json() : Promise.reject(r))
    .then(data => {
      // Save the important pieces
      Qualtrics.SurveyEngine.setEmbeddedData("groupID", data.groupID || "");
      Qualtrics.SurveyEngine.setEmbeddedData("participantRole", data.participantRole || "");
      if (data.chatName) Qualtrics.SurveyEngine.setEmbeddedData("chatName", data.chatName);
      // Optional extras pass-through (condition/section/extra_read_*)
      ["condition","section","extra_read_1","extra_read_2","extra_read_3"].forEach(k => {
        if (data[k] != null) Qualtrics.SurveyEngine.setEmbeddedData(k, data[k]);
      });

      // Optional: write-back confirmation (mapper telemetry)
      var writeUrl = base + "/individual_group_matching?experimentalUnitID=" + encodeURIComponent(id) + "&lookup_confirmed=1";
      fetch(writeUrl, { method: "POST" }).catch(()=>{});
    })
    .catch(async (res) => {
      Qualtrics.SurveyEngine.setEmbeddedData("groupID", "");
      // show a friendly error or route to a fallback
      console.error("Mapper error", res && res.status);
    });
});
```

## Chat Page (JS outline)
- Poll every ~1–1.5s:
  - POST `${serverURL}/chat?groupID=${groupID}&name=${typed_name}&participantRole=${participantRole}` (no `mode` → poll)
- Send:
  - POST `${serverURL}/chat?mode=2&groupID=${groupID}&name=${typed_name}&participantRole=${participantRole}&addText=${encodeURIComponent(text)}`
- Finish:
  - POST `${serverURL}/complete` with any extra params you want (or leave as-is).

**Timer UI**  
Use your existing snippet (turns red in the last 10 seconds). It updates `ui.timer` and calls `endChatEarly()` at 0.

**Required HTML element IDs (expected by your JS):**  
`warninglog`, `chatInstructions`, `chatHeader`, `exitButton`, `timer`, `chatDisplay`, `chatInput`, `inputField`, `submitButton`.
