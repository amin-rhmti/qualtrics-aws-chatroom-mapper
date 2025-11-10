/**
 * Qualtrics Question JS
 * Question: Report
 * QuestionID: QID27
 * Source: Chatroom-asw_matching_final.qsf
 * Extracted: 2025-11-10T07:14:20.251376Z
 */

/* === Chat report (snapshot → ED 'chatLog' as JSON) ==========================
 * Saves the full transcript to ED 'chatLog' and also renders it on the page.
 * ========================================================================== */

Qualtrics.SurveyEngine.addOnload(function () {
  var page = this;

  var serverUrl = "${e://Field/serverURL}";
  var groupId   = "${e://Field/groupID}";
  var role      = "${e://Field/participantRole}";
  var chatName  = "${e://Field/chatName}";

  function esc(s) {
    s = (s == null ? "" : String(s));
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function timeHHMM(iso) {
    // iso is something like "2025-11-08T04:17:12.345Z"
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch(e) { return ""; }
  }

  function renderTranscript(rows, count) {
    try {
      var qc = page.getQuestionContainer();

      // status line
      var status = document.createElement("div");
      status.style.margin = "8px 0 6px 0";
      status.style.fontSize = "12px";
      status.style.color = "#555";
      status.textContent = "Transcript saved (messages: " + (count || rows.length || 0) + ").";
      qc.appendChild(status);

      // pretty box
      var box = document.createElement("div");
      box.style.cssText =
        "max-width: 760px;background:#fff;padding:12px 14px;border-radius:8px;" +
        "box-shadow:2px 2px 5px rgba(0,0,0,0.2);margin-top:6px;line-height:1.35;" +
        "white-space:normal;word-wrap:break-word;word-break:break-word;";
      if (!rows || !rows.length) {
        box.innerHTML = "<em>No messages to display.</em>";
        qc.appendChild(box);
        return;
      }

      var html = [];
      for (var i = 0; i < rows.length; i++) {
        var r    = rows[i] || {};
        var who  = esc(r.name || "");
        var role = esc(r.role || "");
        var msg  = esc(r.text || "").replace(/\n/g,"<br>");
        var tstr = timeHHMM(r.ts);
        var head = "<strong>" + who + "</strong>" + (role ? " <span style='color:#777'>[" + role + "]</span>" : "");
        if (tstr) head += " <span style='color:#999'>(" + tstr + ")</span>";
        html.push("<div style='margin:4px 0;'>" + head + ": " + msg + "</div>");
      }
      box.innerHTML = html.join("");
      qc.appendChild(box);
    } catch(e) { /* no-op */ }
  }

  function snapshotChatToED() {
    var p = new URLSearchParams({
      groupID: groupId,
      participantRole: role,
      chatName: chatName,
      mode: "0",
      export: "1",
      format: "json"  // backend returns { chatLogJSON: "<stringified array>", count: N }
    });
    return fetch(serverUrl + "/chat?" + p.toString())
      .then(function(r){ return r.json(); })
      .then(function(j){
        var payload = j.chatLogJSON || "[]";
        var count   = (typeof j.count !== "undefined") ? j.count : 0;

        // Save to EDs (unchanged)
        Qualtrics.SurveyEngine.setEmbeddedData("chatLog", payload);
        Qualtrics.SurveyEngine.setEmbeddedData("chatLogCount", String(count));

        // Parse and render
        var rows = [];
        try {
          // chatLogJSON is a *string* containing a JSON array
          rows = JSON.parse(payload);
          if (!Array.isArray(rows)) rows = [];
        } catch(e) { rows = []; }

        renderTranscript(rows, count);
      })
      .catch(function(e){
        console.warn("[CHAT REPORT] snapshot error:", e);
        // still show a minimal status line
        try {
          var qc = page.getQuestionContainer();
          var status = document.createElement("div");
          status.style.marginTop = "8px";
          status.style.fontSize = "12px";
          status.style.color = "#a00";
          status.textContent = "Transcript could not be loaded. You may proceed.";
          qc.appendChild(status);
        } catch(_) {}
      });
  }

  snapshotChatToED();
});

/* Project documentation: https://github.com/amin-rhmti/qualtrics-aws-chatroom-mapper */