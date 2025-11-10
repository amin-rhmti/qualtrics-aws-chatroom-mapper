/**
 * Qualtrics Question JS
 * Question: Chat
 * QuestionID: QID13
 * Source: Chatroom-asw_matching_final.qsf
 * Extracted: 2025-11-10T07:14:20.251376Z
 */

/* === Chat page (AWS backend, polls & sends; no snapshot here) ================
 * Adds a switch: show/hide times in the visible chat, while JSON snapshot
 * always preserves precise UTC timestamps.
 * ========================================================================= */

Qualtrics.SurveyEngine.addOnload(function () {
  var page = this;
  page.hideNextButton();
  console.log("[CHAT] start");

  /* ---------- Config (from Embedded Data) ---------- */
  const cfg_serverUrl   = ("${e://Field/serverURL}" || "").trim();         // e.g., https://.../default
  const cfg_groupId     = ("${e://Field/groupID}" || "").trim();
  const cfg_role        = ("${e://Field/participantRole}" || "").trim();
  const cfg_chatName    = ("${e://Field/chatName}" || "Main").trim();
  const cfg_allowExit   = ("${e://Field/allowExitChat}" || "no").trim().toLowerCase();
  let   cfg_widthPx     = parseInt("${e://Field/chatWindowWidth}"  || "600", 10);
  let   cfg_heightPx    = parseInt("${e://Field/chatWindowHeight}" || "360", 10);
  const cfg_durationSec = parseInt("${e://Field/chatDuration}"     || "0",   10); // 0/NaN => no limit

  // Optional flag you may set on the prior page after mapping:
  const cfg_readyFlag   = ("${e://Field/chat_ready}" || "").trim(); // "1" when mapping succeeded (optional)

  // Display-time controls (harmless to backend if unsupported)
  const cfg_showTime    = ("${e://Field/chatShowTime}"   || "no").toLowerCase();   // "yes" | "no"
  const cfg_timeFormat  = ("${e://Field/chatTimeFormat}" || "hm24").toLowerCase(); // "hm24","hms24",...
  const cfg_timeZone    =  ("${e://Field/chatTimeZone}"  || "UTC");                // e.g. "America/Chicago"

  // Normalize base URL (strip trailing slashes)
  const BASE = cfg_serverUrl.replace(/\/+$/, "");

  /* ---------- DOM refs ---------- */
  const ui = {
    warning: document.getElementById("warninglog"),
    instr:   document.getElementById("chatInstructions"),
    header:  document.getElementById("chatHeader"),
    exitBtn: document.getElementById("exitButton"),
    timer:   document.getElementById("timer"),
    log:     document.getElementById("chatDisplay"),
    tray:    document.getElementById("chatInput"),
    input:   document.getElementById("inputField"),
    send:    document.getElementById("submitButton")
  };

  /* ---------- Validation & defaults ---------- */
  if (!cfg_chatName && ui.warning) {
    ui.warning.innerHTML = "ERROR: Embedded Data 'chatName' is missing; transcript may not be saved.";
  }
  if (isNaN(cfg_widthPx)  || cfg_widthPx  < 400 || cfg_widthPx  > 1200) cfg_widthPx  = 600;
  if (isNaN(cfg_heightPx) || cfg_heightPx < 240 || cfg_heightPx >  720) cfg_heightPx = 360;

  /* ---------- Styling ---------- */
  if (ui.instr) {
    const txt = "${e://Field/chatInstructions}";
    ui.instr.innerHTML = (txt ? txt : "Press Enter or click Send to post.") + "<br><br><br>";
  }
  if (ui.header) {
    ui.header.style.cssText =
      "margin:0 auto;width:" + cfg_widthPx + "px;display:flex;justify-content:space-between;";
  }
  if (ui.log) {
    ui.log.style.cssText =
      "width:" + cfg_widthPx + "px;height:" + cfg_heightPx + "px;background:#fff;padding:1em;" +
      "overflow:auto;resize:none;position:relative;margin:0 auto 5px auto;" +
      "box-shadow:2px 2px 5px 2px rgba(0,0,0,0.3);";
  }
  if (ui.tray) {
    ui.tray.style.cssText =
      "margin:0 auto;width:" + cfg_widthPx + "px;display:flex;justify-content:space-between;";
  }
  if (ui.input) {
    ui.input.setAttribute("size", String(Math.floor(cfg_widthPx/10)));
    ui.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); sendMessage(); }
    });
  }
  if (ui.send) {
    ui.send.onclick = sendMessage;
    ui.send.style.cssText =
      "color:#fff;border:none;width:200px;background:#007AC0;font-size:14px;text-transform:uppercase;" +
      "line-height:1;padding:8px 20px;margin:0 auto 0 1em;border-radius:10px;";
  }
  if (cfg_durationSec >= 10 && ui.timer) {
    ui.timer.style.cssText =
      "visibility:visible;width:" + Math.floor(cfg_widthPx/2) + "px;text-transform:uppercase;" +
      "line-height:1;padding:8px 20px;margin:0 1em 0 auto;";
  }
  if (cfg_allowExit === "yes" && ui.exitBtn) {
    ui.exitBtn.style.visibility = "visible";
    ui.exitBtn.onclick = endChatEarly;
    ui.exitBtn.style.cssText =
      "color:black;border:none;width:100px;font-size:12px;text-transform:uppercase;line-height:1;" +
      "padding:8px 20px;border-radius:10px;";
  }

  /* ---------- Guard: require IDs before polling ---------- */
  if (!BASE || !cfg_groupId || !cfg_role || (cfg_readyFlag && cfg_readyFlag !== "1")) {
    if (ui.warning) {
      ui.warning.innerHTML =
        "Setting up the chat… waiting for group assignment. If this persists, go back one page.";
    }
    if (ui.input) ui.input.disabled = true;
    if (ui.send)  ui.send.disabled  = true;
    console.warn("[CHAT] Missing server/group/role or not ready:", {
      BASE, groupID: cfg_groupId, role: cfg_role, readyFlag: cfg_readyFlag
    });
    return; // stop here to avoid 400 spam from the backend
  }

  /* ---------- State ---------- */
  let stopFlag = false;
  let pollTimer = null;
  let t0 = Date.now();

  /* ---------- Fetch helper (better errors) ---------- */
  function fetchJSON(url) {
    return fetch(url).then(async (r) => {
      const text = await r.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { error: text }; }
      if (!r.ok) throw new Error(data && data.error ? data.error : (r.status + " " + r.statusText));
      return data;
    });
  }

  /* ---------- Backend helpers ---------- */
  function chatFetch(mode, text) {
    const p = new URLSearchParams({
      groupID:         cfg_groupId,
      participantRole: cfg_role,
      chatName:        cfg_chatName,
      chatTimeFormat:  (cfg_showTime === "yes" ? cfg_timeFormat : "none"),
      timeZone:        cfg_timeZone,
      mode:            String(mode),   // 0=refresh, 2=send
      addText:         text || ""
    });
    return fetchJSON(BASE + "/chat?" + p.toString());
  }

  /* ---------- Poll loop ---------- */
  function refreshChat() {
    chatFetch(0, "").then(j => {
      if (ui.log) {
        ui.log.innerHTML = j.chat || "";
        ui.log.scrollTop = ui.log.scrollHeight - ui.log.clientHeight; // autoscroll
      }
      if (typeof j.count !== "undefined") {
        Qualtrics.SurveyEngine.setEmbeddedData("chatLogCount", String(j.count));
      }
    }).catch((e) => {
      console.warn("[CHAT] poll error:", e);
    });
  }
  function startPolling() {
    refreshChat();
    pollTimer = setInterval(function () {
      if (!stopFlag) refreshChat();
    }, 1000);
  }

  /* ---------- Send ---------- */
  function sendMessage() {
    const msg = (ui.input && ui.input.value || "").trim();
    if (!msg) return;
    chatFetch(2, msg).then(() => {
      if (ui.input) ui.input.value = "";
      refreshChat();
    }).catch((e) => {
      console.warn("[CHAT] send error:", e);
    });
  }

  /* ---------- Timer ---------- */
  if (cfg_durationSec >= 10 && ui.timer) {
    const tick = function () {
      if (stopFlag) return;
      const elapsed = Math.floor((Date.now() - t0)/1000);
      const remain = Math.max(0, cfg_durationSec - elapsed);
      const mm = String(Math.floor(remain/60)).padStart(2,"0");
      const ss = String(remain%60).padStart(2,"0");
      ui.timer.innerHTML =
        (remain > 10 ? "Remaining time: " + mm + ":" + ss
                     : "<span style='color:#F00;'><strong>Remaining time: " + mm + ":" + ss + "</strong></span>");
      if (remain <= 0) endChatEarly();
      else setTimeout(tick, 250);
    };
    setTimeout(tick, 250);
  }


  /* ---------- End / cleanup ---------- */
  function endChatEarly() {
    stopFlag = true;
    if (pollTimer) clearInterval(pollTimer);
    if (ui.input)   ui.input.disabled = true;
    if (ui.send)    ui.send.disabled  = true;

    // Optional: clear knobs
    Qualtrics.SurveyEngine.setEmbeddedData("chatWindowWidth",  "");
    Qualtrics.SurveyEngine.setEmbeddedData("chatWindowHeight", "");
    Qualtrics.SurveyEngine.setEmbeddedData("allowExitChat",    "");
    Qualtrics.SurveyEngine.setEmbeddedData("chatDuration",     "");
    Qualtrics.SurveyEngine.setEmbeddedData("chatInstructions", "");

    console.log("[CHAT] end");
    page.clickNextButton();
  }

  // go!
  startPolling();
});

/* Project documentation: https://github.com/amin-rhmti/qualtrics-aws-chatroom-mapper */
/* Inspired by SMARTRIQS (A. Molnar, 2019). Thanks for the original idea. */