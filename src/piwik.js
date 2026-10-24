import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";

let first = true;
let pendingPageView;

function getDuration() {
  const start = window.start || new Date();
  const now = new Date();
  const difference = now.getTime() - start.getTime();

  if (difference === 0) {
    return null;
  }

  return difference;
}

export default (function () {
  if (!ExecutionEnvironment.canUseDOM) {
    return null;
  }

  const searchConfig = window.__matomoSiteSearch;
  let pendingSearch;
  let pendingKeyword = "";
  let lastKeyword = "";

  function trackSearch(keyword) {
    if (!window._paq || !keyword || keyword === lastKeyword) return;
    window._paq.push(["trackSiteSearch", keyword]);
    lastKeyword = keyword;
  }

  function flushSearch() {
    clearTimeout(pendingSearch);
    trackSearch(pendingKeyword);
    pendingKeyword = "";
  }

  function searchKeyword(location) {
    if (!searchConfig || location.pathname.replace(/\/+$/, "") !== searchConfig.path.replace(/\/+$/, "")) return "";
    return (new URLSearchParams(location.search).get(searchConfig.queryParameter) || "").trim();
  }

  if (searchConfig && window._paq && (process.env.NODE_ENV === "production" || window.dev === true)) {
    const isSearchInput = (target) => target && typeof target.matches === "function" && target.matches(searchConfig.inputSelector);
    const onInput = (event) => {
      if (!isSearchInput(event.target)) return;
      clearTimeout(pendingSearch);
      pendingKeyword = "";
      if (event.isComposing) return;
      pendingKeyword = event.target.value.trim();
      if (!pendingKeyword) {
        lastKeyword = "";
        return;
      }
      pendingSearch = setTimeout(flushSearch, searchConfig.debounceMs);
    };
    // Delegation also handles search dialogs and inputs mounted after hydration.
    document.addEventListener("input", onInput);
    document.addEventListener("compositionstart", (event) => {
      if (!isSearchInput(event.target)) return;
      clearTimeout(pendingSearch);
      pendingKeyword = "";
    });
    document.addEventListener("compositionend", onInput);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing && isSearchInput(event.target)) {
        pendingKeyword = event.target.value.trim();
        flushSearch();
      }
    });
  }

  return {
    onRouteDidUpdate({ location, previousLocation }) {
      if (process.env.NODE_ENV === "production" || window.dev === true) {
        if (!window._paq) return;

        const { dev } = window;
        const url =
          location && location.pathname + location.search + location.hash;
        const prevUrl =
          previousLocation &&
          previousLocation.pathname + previousLocation.search + previousLocation.hash;

        if (url === prevUrl) return;
        clearTimeout(pendingPageView);
        const keyword = searchKeyword(location);
        // A quick suggestion click can navigate before the debounce has fired.
        // Search-result routes are recorded below with their own URL/title.
        if (keyword) {
          clearTimeout(pendingSearch);
          pendingKeyword = "";
        } else {
          flushSearch();
          lastKeyword = "";
        }

        const sendPageView = () => {
          // Matomo can replace its bootstrap queue while a route is rendering.
          const { _paq } = window;
          if (!_paq) return;
          const { title } = document;

          prevUrl && _paq.push(["setReferrerUrl", prevUrl]);
          _paq.push(["setCustomUrl", url]);
          _paq.push(["setDocumentTitle", title]);
          if (keyword) {
            // Matomo recommends a search action instead of a second page view.
            trackSearch(keyword);
          } else {
            _paq.push(["trackPageView"]);
          }
          _paq.push(["enableLinkTracking"]);
          _paq.push(["trackAllContentImpressions"]);

          if (dev) {
            console.debug(`[Matomo] Page view for: ${url} - ${title}`);
          }
        };

        // Minimum delay for reactHelmet's requestAnimationFrame
        // Some search providers replace ?q= on every keystroke, too.
        pendingPageView = setTimeout(sendPageView, keyword ? Math.max(32, searchConfig.debounceMs) : 32);

        if (first) {
          first = false;

          window._paq.push([
            "trackEvent",
            "javascript",
            "load",
            "duration",
            getDuration(),
          ]);

          if (dev) {
            console.debug(`[Matomo] Tracking duration for: ${url}`);
          }
        }
      }

      return null;
    },
  };
})();
