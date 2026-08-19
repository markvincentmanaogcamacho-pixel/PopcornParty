/* adblockCheck.js — friendly ad-blocker detection for Popcorn Party
   ================================================================
   DETECTION STRATEGY (all checks are passive; nothing is sent anywhere):

   1. Bait request   — fetch a file named like an ad-script ("ads.js",
      "doubleclick.js" path). Ad blockers block requests whose URL looks
      like advertising, so a blocked fetch means an ad blocker is active.
   2. Bait element   — create a hidden div with ad-like class names
      (e.g., "ad-banner", "adzone"). Some blockers hide/remove elements
      matching known ad selectors; if our div gets hidden (offsetHeight
      becomes 0) after being appended, a blocker is active.

   If EITHER check signals a blocker, we consider ad blocking "likely on".
   Because these are heuristic checks, a positive result means "very
   likely"; a negative result means "we couldn't detect one" (DNS-level
   blocking and Safari content blockers that only filter page resources
   can sometimes slip past).

   OUTCOME:
   - Blocker detected      → do nothing (all good)
   - No blocker detected   → show a small friendly tip banner once per week
     with a link to free blockers for iOS/Android/Desktop.
*/

(function () {
  "use strict";

  var KEY = "pp-adblock-check"; // stores {ts, detected} per user

  function readState() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function writeState(detected) {
    var state = { ts: Date.now(), detected: detected };
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    return state;
  }

  /* Test 1: bait network request.
     The file DOES exist on our own server (204 No Content), so if the
     fetch resolves normally there is no blocker blocking ad-like URLs.
     If the fetch throws/rejects, an extension or DNS filter blocked it. */
  function baitFetch() {
    return fetch("/doubleclick.js?_=pp" + Date.now(), { cache: "no-store" })
      .then(function (res) { return res.ok; })
      .catch(function () { return false; });
  }

  /* Test 2: bait DOM element with ad-like class names. */
  function baitElement() {
    return new Promise(function (resolve) {
      var div = document.createElement("div");
      div.className = "ad-banner adzone adsbygoogle doubleclick advert";
      div.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;";
      div.innerHTML = "&nbsp;";
      document.body.appendChild(div);

      // Most blockers act on element-creation timers (MutationObserver),
      // so give them a tick to hide/remove the element.
      setTimeout(function () {
        var hidden =
          div.offsetHeight === 0 ||
          div.offsetWidth === 0 ||
          div.parentElement === null ||
          window.getComputedStyle(div).display === "none" ||
          window.getComputedStyle(div).visibility === "hidden";
        div.remove();
        resolve(hidden);
      }, 250);
    });
  }

  function isOnAndroid() { return /Android/i.test(navigator.userAgent); }
  function isOnIOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent); }
  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  }

  function buildTipMessage() {
    var link;
    if (isOnIOS()) {
      link = "https://adguard.com/en/blog/adguard-ios.html";
    } else if (isOnAndroid()) {
      link = "https://play.google.com/store/apps/details?id=com.adguard.android.contentblocker";
    } else {
      link = "https://ublockorigin.com/";
    }
    return {
      title: "Keep your viewing ad-free",
      text: isStandalone()
        ? "We noticed you might not have an ad blocker. Install a free one (like AdGuard or uBlock Origin) to remove ads inside video players."
        : "We noticed you might not have an ad blocker. A free one (like AdGuard or uBlock Origin) helps remove ads inside video players.",
      link: link,
      linkLabel: isOnIOS() ? "Get AdGuard for Safari" : isOnAndroid() ? "Get AdGuard for Android" : "Get uBlock Origin"
    };
  }

  function showTipBanner() {
    var tip = buildTipMessage();

    var banner = document.createElement("div");
    banner.id = "adblock-tip-banner";
    banner.className = "adblock-tip";
    banner.innerHTML =
      '<div class="adblock-tip-content">' +
        '<i class="fas fa-shield-halved adblock-tip-icon"></i>' +
        '<div class="adblock-tip-text">' +
          '<strong>' + tip.title + '</strong>' +
          '<span>' + tip.text + '</span>' +
        '</div>' +
        '<a class="btn btn-adblock-tip" href="' + tip.link + '" target="_blank" rel="noopener">' + tip.linkLabel + '</a>' +
        '<button class="adblock-tip-close" title="Dismiss" onclick="dismissAdBlockTip()"><i class="fas fa-times"></i></button>' +
      '</div>';

    document.body.appendChild(banner);
  }

  window.dismissAdBlockTip = function () {
    var banner = document.getElementById("adblock-tip-banner");
    if (banner) banner.remove();
    try {
      // Don't show again for 7 days
      var state = readState() || {};
      state.dismissedTs = Date.now();
      sessionStorage.setItem(KEY, JSON.stringify(state));
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
  };

  function runCheck() {
    var state = readState();

    // Already know the result? Only re-check after 24 hours.
    if (state && state.ts && Date.now() - state.ts < 24 * 3600 * 1000) {
      if (!state.detected && (!state.dismissedTs || Date.now() - state.dismissedTs > 7 * 24 * 3600 * 1000)) {
        showTipBanner();
      }
      return;
    }

    Promise.all([baitFetch(), baitElement()]).then(function (results) {
      var fetchBlocked = !results[0];
      var elementBlocked = results[1];
      // Blocker likely if EITHER bait was blocked.
      var detected = fetchBlocked || elementBlocked;
      var newState = writeState(detected);

      if (!detected) {
        newState.dismissedTs = 0; // fresh result; show the tip
        try {
          sessionStorage.setItem(KEY, JSON.stringify(newState));
          localStorage.setItem(KEY, JSON.stringify(newState));
        } catch (e) {}
        // Respect Reduced Motion / save-data users? Keep it simple: show once.
        showTipBanner();
      }
    });
  }

  // Run after the page has settled so we don't compete with init scripts.
  if (document.readyState === "complete") {
    setTimeout(runCheck, 800);
  } else {
    window.addEventListener("load", function () { setTimeout(runCheck, 800); });
  }
})();
