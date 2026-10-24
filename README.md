# @razzeee/docusaurus-plugin-matomo

> Docusaurus Plugin to work with matomo analytics

Requires Docusaurus 3.10.2+ and Node.js 20+. Supports Docusaurus Faster.

## Installation

```console
pnpm add -D @razzeee/docusaurus-plugin-matomo
```

## Usage

```js
module.exports = {
  plugins: [
    [
      require.resolve("@razzeee/docusaurus-plugin-matomo"),
      {
        siteId: "TEST_SITE_ID",
        matomoUrl: "TEST_MATOMO_URL",
        siteUrl: "TEST_SITE_URL",
        // ... more options can be provided please see the options below
      },
    ],
  ],
};
```

## Site search

Enable `siteSearch` in the plugin options to send searches to Matomo's
[Site Search reports](https://developer.matomo.org/guides/tracking-javascript-guide#internal-search-tracking):

```js
{
  siteId: "40",
  matomoUrl: "https://analytics.example.org",
  siteUrl: "https://docs.example.org",
  siteSearch: true,
}
```

Search tracking is disabled by default. When enabled:

- Live search queries are recorded after 500 ms without input; Enter records
  immediately. Empty queries and intermediate IME composition are ignored.
- The default selector matches `.navbar__search-input`, `.DocSearch-Input` and
  `input[type="search"]`, including dynamically mounted search dialogs. It works
  with the search input markup used by Docusaurus DocSearch and
  `@easyops-cn/docusaurus-search-local` without swizzling their components.
- Visits to `<baseUrl>search?q=…` record a search instead of a page view, as
  recommended by Matomo. Both `/search` and `/search/` are recognized.
- Consecutive identical queries on the same page are deduplicated, including
  Enter followed by navigation to the results page. Clearing the field or
  navigating to an ordinary page allows the same query to be recorded again.
- Search commands use the same Matomo queue and consent/DNT settings as page
  views. The plugin does not bypass consent or invent a result count.

For a custom search UI, override the selector, delay or results URL:

```js
siteSearch: {
  inputSelector: "#documentation-search",
  debounceMs: 750,
  path: "/docs/find", // Full pathname, including any site baseUrl
  queryParameter: "term",
}
```

This measures live search queries, not result clicks or successful searches.
Result counts and categories require integration with your search provider. If
you already send `trackSiteSearch` commands yourself, leave `siteSearch` disabled
to avoid counting the same searches twice.

## Migrating from the original plugin

Replace `@gabrielcsapo/docusaurus-plugin-matomo` with
`@razzeee/docusaurus-plugin-matomo` in your dependencies and plugin configuration.
Existing Matomo settings remain supported. The malformed no-JavaScript fallback
has been removed; tracking requires JavaScript. See [CHANGELOG.md](CHANGELOG.md)
for the changes in 0.2.0.

## Options

| Option                  | Explanation                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `siteId`                | Your Matomo site ID configured in your Matomo installation.                                                                                                                                                                                                                                                        |
| `matomoUrl`             | The url of your Matomo installation.                                                                                                                                                                                                                                                                               |
| `siteUrl`               | Legacy required option, retained for configuration compatibility. The broken `noscript` fallback has been removed; this value is no longer used for tracking. |
| `matomoPhpScript`       | (optional) The name of your Matomo PHP script. Defaults to `piwik.php`                                                                                                                                                                                                                                             |
| `matomoJsScript`        | (optional) The name of your Matomo JS script. Defaults to `piwik.js`                                                                                                                                                                                                                                               |
| `requireConsent`        | (optional) If true, tracking will be disabled until you call `window._paq.push(['setConsentGiven']);`.                                                                                                                                                                                                             |
| `requireCookieConsent`  | (optional) If true, no cookies will be stored or used until you call `window._paq.push(['setCookieConsentGiven']);`.                                                                                                                                                                                               |
| `disableCookies`        | (optional) If true, no cookie will be used by Matomo.                                                                                                                                                                                                                                                              |
| `cookieDomain`          | (optional) Specify cookie domain.                                                                                                                                                                                                                                                                                  |
| `localScript`           | (optional) If set, load local `piwik.js` script from the given path, instead of loading it from your `matomoUrl`.                                                                                                                                                                                                  |
| `respectDnt`            | (optional) If false, will load all scripts without respecting user preference to `Do Not Track` on browsers. Defaults to `true`.                                                                                                                                                                                   |
| `dev`                   | (optional) Activate dev mode by setting to `true`. Will load all scripts despite not running in `production` environment. Ignores your local browser's DNT header too. Outputs some information in console about what it is doing. Useful for local testing but careful: all hits will be send like in production. |
| `enableJSErrorTracking` | (optional) Enable basic JavaScript error tracking and reporting in Matomo by setting to `true`.                                                                                                                                                                                                                    |
