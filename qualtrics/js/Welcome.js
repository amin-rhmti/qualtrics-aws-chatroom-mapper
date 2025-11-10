// Welcome / Before-Block page
// - Save respondent IANA timezone to ED: chatTimeZone
// - Hush the theme's harmless "reading '0'" error on THIS page only

Qualtrics.SurveyEngine.addOnload(function () {
  // ---- hush handlers (page-scoped) ----
  function hushRejection(e) {
    var reason = e && (typeof e.reason !== 'undefined' && e.reason !== null ? e.reason : e);
    var s = String(reason).toLowerCase();
    if (s.indexOf("reading '0'") !== -1 || s.indexOf('reading "0"') !== -1) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
    }
  }
  function hushError(e) {
    var msg = String((e && e.message) || "").toLowerCase();
    if (msg.indexOf("reading '0'") !== -1 || msg.indexOf('reading "0"') !== -1) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
    }
  }
  try {
    window.addEventListener('unhandledrejection', hushRejection);
    window.addEventListener('error', hushError, true);
    window.__q_hushRejection = hushRejection;
    window.__q_hushError = hushError;
  } catch (_) {}

  // ---- detect timezone safely ----
  var tz = "UTC";
  try {
    if (window.Intl && Intl.DateTimeFormat) {
      var o = Intl.DateTimeFormat().resolvedOptions();
      if (o && o.timeZone && o.timeZone.indexOf("/") > 0) tz = o.timeZone; // e.g., "America/Chicago"
    }
  } catch (_) {}
  Qualtrics.SurveyEngine.setEmbeddedData("chatTimeZone", tz);
});

// Use the GLOBAL unload hook (not `this.addOnUnload`)
Qualtrics.SurveyEngine.addOnUnload(function () {
  try {
    if (window.__q_hushRejection) window.removeEventListener('unhandledrejection', window.__q_hushRejection);
    if (window.__q_hushError)      window.removeEventListener('error', window.__q_hushError, true);
    delete window.__q_hushRejection;
    delete window.__q_hushError;
  } catch (_) {}
});

/* Project documentation: https://github.com/amin-rhmti/qualtrics-aws-chatroom-mapper */