# Qualtrics Setup (No‑AWS Steps)

This guide is for collaborators who **won’t touch AWS**. You’ll import the chat block, wire Embedded Data (ED), paste two JavaScript snippets, and test end‑to‑end.

---

## Backend assumptions (already deployed)

- **Base URL (no trailing route):** `https://kr98xfirp7.execute-api.us-east-1.amazonaws.com/default`
- Endpoints used by the survey:
  - `GET /individual_group_matching?experimentalUnitID=...` (mapper lookup)
  - `POST /individual_group_matching` (optional write‑back/telemetry)
  - `POST /chat` (poll & send, JSON)
  - `POST /complete` (finalize, JSON)
- **CORS allowlist:** `https://illinois.qualtrics.com`

> You only need the Base URL in Qualtrics. The JS below builds the full endpoint path at runtime.

---

## 1) Import the block

### Option A — Import the provided .QSF as a stand‑alone survey
1. In Qualtrics, go to **Projects → Create Project → Survey → From a File (.QSF)**.
2. Upload `assets/Chatroom-asw_matching_final.qsf`.
3. Open the imported survey. It already contains:
   - An **ID entry** question (for `experimentalUnitID`) and its **Question JS**.
   - A **chat block** (HTML with required element IDs) and its **Question JS**.
   - Placeholder Embedded Data keys in **Survey Flow**.

### Option B — Copy the chat block into an existing survey
1. Temporarily **import** the `.QSF` as in Option A.
2. In the imported survey’s **Survey Builder**, click the chat block’s **⋮ → Copy Block to Library**.
3. Open your **target survey**, click **Add Block → From Library**, select the copied chat block.
4. Copy the **Question JS** from the imported survey’s ID entry question and paste it into your ID entry question.
5. Delete the temporary survey if you wish.

> The chat block expects specific HTML IDs (see Appendix) and the ED keys described below.

---

## 2) Survey Flow & Embedded Data (ED)

Add (or confirm) these keys in **Survey Flow → Add a New Element Here → Embedded Data** near the top **before** the chat block.

- **Inputs (set early):**
  - `serverURL` → set **value** to `https://kr98xfirp7.execute-api.us-east-1.amazonaws.com/default`
  - `experimentalUnitID` → leave blank (will be set by ID entry JS)
  - `typed_name` → set via Piped Text from your “Name” text‑entry question (e.g., `${q://QIDxx/ChoiceTextEntryValue}`)
  - `ResponseID` → use Qualtrics built‑in Piped Text `${e://Field/ResponseID}` or leave blank (Qualtrics fills at runtime)
  - `chatDuration` → integer seconds (e.g., `120`)

- **Set by mapper GET (do not prefill):**
  - `groupID`
  - `participantRole`
  - `chatName` (optional)

- **Outputs (left blank, filled by chat page):**
  - `chatTranscript`
  - `chatStatus`

**Important:** `serverURL` **must be the Base URL only** (no trailing `/individual_group_matching`, `/chat`, etc.).

Publish your survey after editing Survey Flow.

---

## 3) ID‑entry page JavaScript (mapper lookup + optional write‑back)

Attach this script to the **ID text‑entry question** (Question → **⚙ → JavaScript**). It reads the user’s ID, calls the mapper, sets EDs, optionally writes back a confirmation, and advances on success.

```javascript
Qualtrics.SurveyEngine.addOnload(function () {
  var q = this;
  q.hideNextButton();

  const serverURL = "${e://Field/serverURL}";

  // Input & UI bits
  const $q = jQuery("#" + q.questionId);
  const $input = $q.find("input[type='text']").first();
  const $status = jQuery('<div id="lookupStatus" style="margin-top:8px;color:#b00;"></div>').appendTo($q.find(".QuestionBody"));
  const $btn = jQuery('<button type="button" class="btn" style="margin-top:8px;">Continue</button>').appendTo($q.find(".QuestionBody"));

  async function lookupAndAdvance() {
    const id = ($input.val() || "").trim();
    if (!id) { $status.text("Please enter your ID."); return; }

    $status.css("color", "#555").text("Checking ID…");
    try {
      const res = await fetch(serverURL + "/individual_group_matching?experimentalUnitID=" + encodeURIComponent(id), { method: "GET" });
      if (res.status === 200) {
        const data = await res.json();
        Qualtrics.SurveyEngine.setEmbeddedData("experimentalUnitID", id);
        if (data.groupID)         Qualtrics.SurveyEngine.setEmbeddedData("groupID", data.groupID);
        if (data.participantRole) Qualtrics.SurveyEngine.setEmbeddedData("participantRole", data.participantRole);
        if (data.chatName)        Qualtrics.SurveyEngine.setEmbeddedData("chatName", data.chatName);

        // Optional write‑back/telemetry
        try {
          await fetch(serverURL + "/individual_group_matching", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ experimentalUnitID: id, lookup_confirmed: true })
          });
        } catch (_) {}

        $status.css("color", "#2b6").text("ID confirmed. Moving on…");
        q.clickNextButton();
      } else if (res.status === 404) {
        $status.css("color", "#b00").text("We couldn’t find that ID. Please check with your instructor.");
      } else {
        const t = await res.text();
        $status.css("color", "#b00").text("Unexpected error (" + res.status + "): " + t);
      }
    } catch (err) {
      $status.css("color", "#b00").text("Network error. Check your connection and try again.");
    }
  }

  $btn.on("click", lookupAndAdvance);

  // Optional: Enter submits
  $input.on("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); lookupAndAdvance(); } });
});
```

**What this does**
- Reads the typed ID.
- `GET /individual_group_matching` → if 200, sets ED `groupID`, `participantRole`, `chatName` (if present).
- Optionally `POST /individual_group_matching` with `{experimentalUnitID, lookup_confirmed:true}`.
- On success, advances to the next page. On 404, shows an error and blocks advance.

---

## 4) Chat page JavaScript (poll, send, timer, finalize)

Attach this script to the **chat block’s Question** (the one with the chat HTML). It handles join, polling, sending, the countdown timer, and finalization via `/complete`.

```javascript
Qualtrics.SurveyEngine.addOnload(function () {
  var page = this;
  page.hideNextButton();

  /* ---------- Config from Embedded Data ---------- */
  const cfg_serverUrl   = "${e://Field/serverURL}";
  const cfg_groupId     = "${e://Field/groupID}";
  const cfg_role        = "${e://Field/participantRole}";
  const cfg_name        = "${e://Field/typed_name}";
  const cfg_pid         = "${e://Field/ResponseID}";
  const cfg_durationSec = parseInt("${e://Field/chatDuration}") || 120;

  /* ---------- Grab UI ---------- */
  const ui = {
    warning: document.getElementById("warninglog"),
    header:  document.getElementById("chatHeader"),
    timer:   document.getElementById("timer"),
    display: document.getElementById("chatDisplay"),
    input:   document.getElementById("inputField"),
    send:    document.getElementById("submitButton"),
    exit:    document.getElementById("exitButton"),
  };

  /* ---------- State ---------- */
  let stopFlag = false;
  let lastTs = 0;
  const transcript = [];
  const t0 = Date.now();

  /* ---------- Helpers ---------- */
  const api = async (path, body) => {
    const r = await fetch(cfg_serverUrl + path, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  };

  const appendLine = (plain, html) => {
    transcript.push(plain);
    if (ui.display) {
      const div = document.createElement("div");
      div.innerHTML = html;
      ui.display.appendChild(div);
      ui.display.scrollTop = ui.display.scrollHeight;
    }
  };

  const fmt = (elapsedSec, who, text) => {
    const mm = String(Math.floor(elapsedSec/60)).padStart(2,"0");
    const ss = String(elapsedSec%60).padStart(2,"0");
    return {
      plain: `${who} (${mm}:${ss}): ${text}`,
      html: `<strong>${who}</strong> (${mm}:${ss}): ${text.replace(/\\n/g,"<br>")}`
    };
  };

  /* ---------- Finalize ---------- */
  const endChat = (reason) => {
    if (stopFlag) return;
    stopFlag = true;
    const status = reason || "timer";
    try {
      Qualtrics.SurveyEngine.setEmbeddedData("chatTranscript", transcript.join("\\n"));
      Qualtrics.SurveyEngine.setEmbeddedData("chatStatus", status);
    } catch (e) {}

    window.onbeforeunload = null;
    api("/complete", {
      roomID: cfg_groupId,
      participantID: cfg_pid,
      name: cfg_name,
      role: cfg_role,
      durationSec: cfg_durationSec,
      exitReason: status,
      transcript
    }).catch(()=>{}).finally(()=>{
      page.showNextButton();
    });
  };
  window.endChatEarly = () => endChat("timer"); // used by timer snippet

  /* ---------- Join ---------- */
  api("/chat", {
    roomID: cfg_groupId,
    participantID: cfg_pid,
    name: cfg_name,
    role: cfg_role,
    since: 0,
    outgoing: { type: "join" }
  }).then((data)=>{
    if (data && typeof data.now === "number") lastTs = data.now;
  }).catch(()=>{
    appendLine("*** error ***", "<em>Join failed; reconnecting…</em>");
  });

  /* ---------- Poll loop ---------- */
  const poll = async () => {
    if (stopFlag) return;
    try {
      const data = await api("/chat", {
        roomID: cfg_groupId,
        participantID: cfg_pid,
        name: cfg_name,
        role: cfg_role,
        since: lastTs
      });
      if (Array.isArray(data.events)) {
        data.events.forEach(e => {
          lastTs = Math.max(lastTs, e.ts || 0, data.now || 0);
          if (e.type === "message") {
            const rel = Math.max(0, Math.floor((e.ts - t0)/1000));
            const who = e.name || e.role || "Anon";
            const {plain, html} = fmt(rel, who, e.text || "");
            appendLine(plain, html);
          } else if (e.type === "join") {
            const who = e.name || e.role || "Someone";
            appendLine(`*** ${who} has joined the chat ***`, `<em>*** ${who} has joined the chat ***</em>`);
          } else if (e.type === "leave") {
            const who = e.name || e.role || "Someone";
            appendLine(`*** ${who} has left the chat ***`, `<em>*** ${who} has left the chat ***</em>`);
          }
        });
      }
      if (data.roomStatus === "closed") { endChat("serverClosed"); return; }
    } catch (e) {
      if (ui.warning) ui.warning.textContent = "Reconnecting…";
    } finally {
      if (!stopFlag) setTimeout(poll, 1200);
    }
  };
  setTimeout(poll, 1000);

  /* ---------- Send ---------- */
  const send = async () => {
    if (stopFlag) return;
    const text = (ui.input && ui.input.value || "").trim();
    if (!text) return;
    ui.input.value = "";
    try {
      await api("/chat", {
        roomID: cfg_groupId,
        participantID: cfg_pid,
        name: cfg_name,
        role: cfg_role,
        since: lastTs,
        outgoing: { type: "message", text }
      });
    } catch (e) {
      if (ui.warning) ui.warning.textContent = "Message failed (retrying)…";
    }
  };
  if (ui.send) ui.send.addEventListener("click", send);
  if (ui.input) ui.input.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); send(); }
  });

  /* ---------- Exit ---------- */
  if (ui.exit) ui.exit.addEventListener("click", function(){
    endChat("exitButton");
  });

  /* ---------- Unload safety ---------- */
  window.onbeforeunload = function () { return "Leave the chat?"; };
  window.addEventListener("pagehide", function(){ endChat("unload"); });

  /* ---------- Timer (paste EXACT snippet) ---------- */
  const t0_forTimerOnly = t0; // t0 already defined; keep name for clarity
  /* ---------- Timer ---------- */
  if (cfg_durationSec >= 10 && ui.timer) {
    const tick = function () {
      if (stopFlag) return;

      const elapsed = Math.floor((Date.now() - t0)/1000);
      const remain = Math.max(0, cfg_durationSec - elapsed);

      const mm = String(Math.floor(remain/60)).padStart(2,"0");
      const ss = String(remain%60).padStart(2,"0");

      ui.timer.innerHTML = (
        remain > 10
          ? "Remaining time: " + mm + ":" + ss
          : "<span style='color:#F00;'><strong>Remaining time: " + mm + ":" + ss + "</strong></span>"
      );

      if (remain <= 0) endChatEarly();
      else setTimeout(tick, 250);
    };
    setTimeout(tick, 250);
  }
});
```

**What this does**
- Onload: hides Next; reads ED; sends a **join**; starts polling every ≈1.2s.
- Sending: click **Send** or press **Enter** (Shift+Enter inserts newline).
- Countdown: **last 10s turns red** (see timer code).
- Finalizes on timer end, **Exit** button, or page unload; calls `/complete`, stores transcript/status in ED, then shows Next.

---

## 5) Timer snippet (stand‑alone reference)

> This is exactly the timer code used in the chat page above (turns red in the last **10 seconds**).

```javascript
/ * ---------- Timer ---------- */
if (cfg_durationSec >= 10 && ui.timer) {
  const tick = function () {
    if (stopFlag) return;

    const elapsed = Math.floor((Date.now() - t0)/1000);
    const remain = Math.max(0, cfg_durationSec - elapsed);

    const mm = String(Math.floor(remain/60)).padStart(2,"0");
    const ss = String(remain%60).padStart(2,"0");

    ui.timer.innerHTML = (
      remain > 10
        ? "Remaining time: " + mm + ":" + ss
        : "<span style='color:#F00;'><strong>Remaining time: " + mm + ":" + ss + "</strong></span>"
    );

    if (remain <= 0) endChatEarly();
    else setTimeout(tick, 250);
  };
  const t0 = Date.now();
  setTimeout(tick, 250);
}
```

---

## 6) Save & Continue (Qualtrics)

- **Pros:** If enabled, respondents who leave and return **may** resume where they left off in the survey.
- **Cons for chat:** The chat is **real‑time and ephemeral**—a browser refresh will **not** restore the chat state. Tell users **not to refresh/minimize/leave** during the chat.
- **Recommended header note:** Add a short message in **Look & Feel → Header** such as:
  > “Please do **not** refresh, minimize, or leave the page during the chat. Your chat will end early if you do.”

---

## 7) Validation & end‑to‑end test (5 minutes)

1. In a browser, verify a known ID works (e.g., `101`):  
   `https://kr98xfirp7.execute-api.us-east-1.amazonaws.com/default/individual_group_matching?experimentalUnitID=101`
2. In your survey, enter that ID on the ID page. Confirm ED `groupID` and `participantRole` are set (use **Tools → Review Responses** or view ED on subsequent pages with `${e://Field/groupID}` piped text while testing).
3. On the chat page, send two messages. After 1–2s, they should appear in the display (poll loop).
4. Click **Exit** or let the timer end. Confirm ED `chatTranscript` and `chatStatus` are populated.
5. **Publish** the survey to make changes live.

---

## 8) Troubleshooting

- **404 on mapper GET:** The ID isn’t in the CSV or the CSV wasn’t packaged with the backend.
- **CORS error:** The page must be served from `https://illinois.qualtrics.com`. Ensure `serverURL` points to the Base URL above.
- **No chat updates:** Check that ED `groupID` is set and that the poll body includes `since:lastTs`. (If `groupID` is empty, the backend won’t return events.)
- **Timer never turns red:** Ensure `chatDuration >= 10` and that the element with ID `timer` exists in the chat block HTML.
- **Messages don’t send:** Confirm the **Send** button/Enter key is wired and that `/chat` is reachable (no mixed HTTP/HTTPS).

---

## Appendix: Minimal chat block HTML (only if you didn’t import the block)

Add a **Descriptive Text** question and paste this HTML. The JavaScript above assumes these IDs exist.

```html
<div id="warninglog" style="margin-bottom:6px; font-style:italic;"></div>
<h3 id="chatHeader">Group Chat</h3>
<div id="timer" style="margin:6px 0 10px 0;"></div>

<div id="chatDisplay" style="height:240px; overflow:auto; border:1px solid #ccc; padding:8px; border-radius:4px;"></div>

<div id="chatInput" style="margin-top:8px;">
  <textarea id="inputField" rows="2" style="width:100%;"></textarea>
  <div style="margin-top:6px; display:flex; gap:8px;">
    <button id="submitButton" type="button">Send</button>
    <button id="exitButton" type="button">Exit</button>
  </div>
</div>
```

---

### You’re done!
- Import the block, wire ED, paste the two JS snippets, and test with a known ID.
- If anything is unclear, leave comments **in the survey** next to the relevant question/block so we can adjust quickly.
