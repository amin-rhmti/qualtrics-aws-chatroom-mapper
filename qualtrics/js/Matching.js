/**
 * Qualtrics Question JS
 * Question: Matching
 * QuestionID: QID29
 * Source: Chatroom-asw_matching_final.qsf
 * Extracted: 2025-11-10T07:14:20.251376Z
 */

Qualtrics.SurveyEngine.addOnload(function () {
  var page = this;
  page.hideNextButton();

  const server = "${e://Field/serverURL}";                  // e.g., https://kr98xfirp7.execute-api.us-east-1.amazonaws.com/default
  const unit   = "${e://Field/experimentalUnitID}";         // your ID collected earlier

  const url = new URL(server + "/individual_group_matching");
  url.search = new URLSearchParams({ experimentalUnitID: unit }).toString();

  fetch(url.toString())
    .then(r => r.json())
    .then(d => {
      if (d.groupID && d.participantRole) {
        Qualtrics.SurveyEngine.setEmbeddedData("groupID", d.groupID);
        Qualtrics.SurveyEngine.setEmbeddedData("participantRole", d.participantRole);
        Qualtrics.SurveyEngine.setEmbeddedData("chat_ready", "1");
      } else {
        Qualtrics.SurveyEngine.setEmbeddedData("chat_ready", "0");
        alert("Mapping failed: " + JSON.stringify(d));
      }
      page.clickNextButton();
    })
    .catch(e => {
      Qualtrics.SurveyEngine.setEmbeddedData("chat_ready", "0");
      alert("Mapping error: " + e);
      page.clickNextButton();
    });
});

/* Project documentation: https://github.com/amin-rhmti/qualtrics-aws-chatroom-mapper */