import type { Plugin } from "@docusaurus/types";

const path = require("path");

type PluginOptions = {
  siteUrl: string;
  matomoUrl: string;
  matomoPhpScript?: string;
  matomoJsScript?: string;
  siteId: string;
  dev?: boolean;
  localScript?: string;
  requireConsent?: boolean;
  requireCookieConsent?: boolean;
  disableCookies?: boolean;
  cookieDomain?: string;
  enableJSErrorTracking?: boolean;
  respectDnt?: boolean;
  siteSearch?: boolean | {
    inputSelector?: string;
    debounceMs?: number;
    path?: string;
    queryParameter?: string;
  };
}

// Escape '<' so configuration cannot terminate an inline script element.
function scriptValue(value: unknown): string {
  // All callers provide a defined JSON-serializable value.
  return JSON.stringify(value)!.replace(/</g, "\\u003c");
}

function matomoPlugin(context: { baseUrl?: string }, options: PluginOptions) {
  if (!options) {
    throw new Error(
      `You need to specify options arguments use docusaurus-plugin-matomo.`
    );
  }

  const {
    siteUrl,
    matomoUrl: baseUrl,
    matomoPhpScript = "piwik.php",
    matomoJsScript = "piwik.js",
    siteId,
    dev = false,
    localScript,
    requireConsent,
    requireCookieConsent,
    disableCookies,
    cookieDomain,
    enableJSErrorTracking,
    respectDnt = true,
    siteSearch = false,
  } = options;

  if (!baseUrl || !siteId || !siteUrl) {
    throw new Error(
      'You specified the "matomo" object in "themeConfig" but the "matomoUrl" or "siteUrl" or "siteId" field was missing. ' +
        "Please ensure this is not a mistake."
    );
  }

  const matomoUrl = baseUrl.replace(/\/+$/, "");
  const searchOptions = typeof siteSearch === "object" ? siteSearch : {};
  const searchConfig = siteSearch && {
    inputSelector: '.navbar__search-input, .DocSearch-Input, input[type="search"]',
    debounceMs: 500,
    path: `${(context.baseUrl || "/").replace(/\/+$/, "")}/search`,
    queryParameter: "q",
    ...searchOptions,
  };
  if (searchConfig && (
    !Number.isFinite(searchConfig.debounceMs) || searchConfig.debounceMs < 0 ||
    !searchConfig.inputSelector.trim() || !searchConfig.queryParameter.trim() ||
    !searchConfig.path.startsWith("/")
  )) {
    throw new Error("Invalid siteSearch options: use a nonnegative debounceMs, nonempty selector/queryParameter and an absolute path.");
  }
  const isProd = process.env.NODE_ENV === "production";
  const script = localScript ? localScript : `${matomoUrl}/${matomoJsScript}`;
  const dntCondition = respectDnt
    ? `!(navigator.doNotTrack === '1' || window.doNotTrack === '1')`
    : `true`;

  return {
    name: "docusaurus-plugin-matomo",

    getClientModules() {
      return isProd || dev ? [path.resolve(__dirname, "./piwik.js")] : [];
    },

    injectHtmlTags() {
      if (!isProd && !dev) {
        return {};
      }
      return {
        headTags: [
          {
            tagName: "link",
            attributes: {
              rel: "preconnect",
              href: script,
            },
          },
          {
            tagName: "script",
            innerHTML: `
            window.dev = ${scriptValue(dev)};
            if (window.dev === true || ${dntCondition}) {
              window._paq = window._paq || [];
              window.__matomoSiteSearch = ${scriptValue(searchConfig)};
              ${requireConsent ? "window._paq.push(['requireConsent']);" : ""}
              ${
                requireCookieConsent
                  ? "window._paq.push(['requireCookieConsent']);"
                  : ""
              }
              ${disableCookies ? "window._paq.push(['disableCookies']);" : ""}
              ${
                enableJSErrorTracking
                  ? "window._paq.push(['enableJSErrorTracking']);"
                  : ""
              }
              ${
                cookieDomain
                  ? `window._paq.push(['setCookieDomain', ${scriptValue(cookieDomain)}]);`
                  : ""
              }
              window._paq.push(['setTrackerUrl', ${scriptValue(`${matomoUrl}/${matomoPhpScript}`)}]);
              window._paq.push(['setSiteId', ${scriptValue(siteId)}]);
              window._paq.push(['enableHeartBeatTimer']);
              window.start = new Date();
              (function() {
                var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
                g.type='text/javascript'; g.async=true; g.defer=true; g.src=${scriptValue(script)}; s.parentNode.insertBefore(g,s);
              })();
              if (window.dev === true) {
                console.debug('[Matomo] Tracking initialized')
                console.debug(${scriptValue(`[Matomo] matomoUrl: ${matomoUrl}, siteId: ${siteId}`)})
              }
            }
            `,
          },
        ],
      };
    },
  } satisfies Plugin<void>;
}

namespace matomoPlugin {
  export type Options = PluginOptions;
}

export = matomoPlugin;
