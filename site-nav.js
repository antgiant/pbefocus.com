// Shared header/footer site-listing across pbefocus.com, quiz.pbefocus.com,
// and karaoke.pbefocus.com. Include with:
//   <meta name="pbe-site" content="pbefocus|quiz|karaoke">
//   <script src="https://pbefocus.com/site-nav.js" defer></script>
// Each site's HTML keeps a static two-entry fallback (pbefocus.com + itself)
// inside a `[data-pbe-site-nav]` (header) / `[data-pbe-site-footer-nav]`
// (footer) marker -- this script replaces that with the full list of `live`
// sites, always including the current site even if it isn't live yet (so
// quiz/karaoke stay visible while under dev testing, ahead of being added
// to `live` here for everyone else once they actually go live).
(function () {
  "use strict";
  if (window.__pbeSiteNavLoaded) return;
  window.__pbeSiteNavLoaded = true;

  var SITES = [
    { id: "pbefocus", homeLabel: "Home", footerLabel: "PBEfocus.com", url: "https://pbefocus.com", live: true },
    { id: "quiz", homeLabel: "Quiz Builder", footerLabel: "Quiz Builder", url: "https://quiz.pbefocus.com", live: true },
    { id: "karaoke", homeLabel: "Karaoke", footerLabel: "Karaoke", url: "https://karaoke.pbefocus.com", live: false },
    { id: "scores", homeLabel: "Score Keeper", footerLabel: "Score Keeper", url: "https://pbe-scores.wooleys.us", live: true },
  ];

  function currentSiteId() {
    var meta = document.querySelector('meta[name="pbe-site"]');
    return meta ? meta.content : null;
  }

  function visibleSites(currentId) {
    return SITES.filter(function (site) {
      return site.live || site.id === currentId;
    });
  }

  function renderLinks(container, sites, currentId, labelKey) {
    if (!container) return;
    container.textContent = "";
    sites.forEach(function (site) {
      var isCurrent = site.id === currentId;
      var a = document.createElement("a");
      a.href = isCurrent ? "/" : site.url;
      a.textContent = site[labelKey];
      if (isCurrent) a.className = "active";
      container.appendChild(a);
    });
  }

  function init() {
    var currentId = currentSiteId();
    var sites = visibleSites(currentId);
    renderLinks(document.querySelector("[data-pbe-site-nav]"), sites, currentId, "homeLabel");
    renderLinks(document.querySelector("[data-pbe-site-footer-nav]"), sites, currentId, "footerLabel");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
