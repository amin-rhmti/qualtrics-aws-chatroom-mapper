/* === Complete page (notify backend, then Next) ============================= */

Qualtrics.SurveyEngine.addOnload(function () {
  var page = this;
  page.hideNextButton();

  const base = "${e://Field/serverURL}";
  const gid  = "${e://Field/groupID}";
  const pid  = "${e://Field/ResponseID}"; // Qualtrics response ID

  const params = new URLSearchParams({ groupID: gid, participantID: pid });

  fetch(base + "/complete?" + params.toString())
    .catch((e) => console.warn("[COMPLETE] error:", e))
    .finally(() => page.clickNextButton());
});

/* Project documentation: https://github.com/amin-rhmti/qualtrics-aws-chatroom-mapper */
/* Inspired by SMARTRIQS (A. Molnar, 2019). Thanks for the original idea. */