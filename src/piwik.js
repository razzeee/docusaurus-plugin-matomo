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

        const sendPageView = () => {
          // Matomo can replace its bootstrap queue while a route is rendering.
          const { _paq } = window;
          if (!_paq) return;
          const { title } = document;

          prevUrl && _paq.push(["setReferrerUrl", prevUrl]);
          _paq.push(["setCustomUrl", url]);
          _paq.push(["setDocumentTitle", title]);
          _paq.push(["trackPageView"]);
          _paq.push(["enableLinkTracking"]);
          _paq.push(["trackAllContentImpressions"]);

          if (dev) {
            console.debug(`[Matomo] Page view for: ${url} - ${title}`);
          }
        };

        // Minimum delay for reactHelmet's requestAnimationFrame
        pendingPageView = setTimeout(sendPageView, 32);

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
