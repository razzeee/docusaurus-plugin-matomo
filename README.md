# @gabrielcsapo/docusaurus-plugin-matomo

> Docusaurus Plugin to work with matomo analytics

## Unreleased maintenance branch

This local branch prepares fixes for a maintained fork. The package name and
repository metadata still refer to upstream; no fork release has been published.

- Fix [upstream issue #2](https://github.com/gabrielcsapo/docusaurus-plugin-matomo/issues/2):
  remove JavaScript incorrectly embedded in a head `<noscript>` tag. It never
  provided working no-JavaScript tracking and becomes visible text with the
  Docusaurus Faster HTML minifier. This version requires JavaScript for tracking.
- Track committed routes using `onRouteDidUpdate` and the supported
  `previousLocation` argument, preserving the delay for document-title updates.
- Preserve the existing consent, cookie and Do Not Track options.

Validated against Docusaurus 3.10.2, React 19.3.1 and all Faster options enabled.
Browser checks intercept analytics traffic and verify the Matomo command queue:
one initial page view, one per navigation, current titles and previous URLs.
They do not verify ingestion by a live Matomo server.

Run the regression tests and compile the package:

```console
npm ci
npm test -- --runInBand
npm run build
```

### Follow-up issues

- [Upstream #1: Track searches](https://github.com/gabrielcsapo/docusaurus-plugin-matomo/issues/1)
  is a feature request, not implemented here. It needs an integration point with
  the site's search provider; typing, submitted searches and result clicks should
  not be conflated.
- Audit the remaining documented options before publishing: upstream documents
  `exclude`, but does not implement it, and `dev` does not bypass its
  production-only plugin registration.

## Installation

```console
npm install @gabrielcsapo/docusaurus-plugin-matomo --save-dev
```

## Usage

```js
module.exports = {
  plugins: [
    [
      require.resolve("@gabrielcsapo/docusaurus-plugin-matomo"),
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

| Option                  | Explanation                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `siteId`                | Your Matomo site ID configured in your Matomo installation.                                                                                                                                                                                                                                                        |
| `matomoUrl`             | The url of your Matomo installation.                                                                                                                                                                                                                                                                               |
| `siteUrl`               | Legacy required option, retained for configuration compatibility. The broken `noscript` fallback has been removed; this value is no longer used for tracking. |
| `matomoPhpScript`       | (optional) The name of your Matomo PHP script. Defaults to `piwik.php`                                                                                                                                                                                                                                             |
| `matomoJsScript`        | (optional) The name of your Matomo JS script. Defaults to `piwik.js`                                                                                                                                                                                                                                               |
| `exclude`               | (optional) Specify an array of pathnames where tracking code will be excluded. The pathname `/offline-plugin-app-shell-fallback/` is excluded by default.                                                                                                                                                          |
| `requireConsent`        | (optional) If true, tracking will be disabled until you call `window._paq.push(['setConsentGiven']);`.                                                                                                                                                                                                             |
| `requireCookieConsent`  | (optional) If true, no cookies will be stored or used until you call `window._paq.push(['setCookieConsentGiven']);`.                                                                                                                                                                                               |
| `disableCookies`        | (optional) If true, no cookie will be used by Matomo.                                                                                                                                                                                                                                                              |
| `cookieDomain`          | (optional) Specify cookie domain.                                                                                                                                                                                                                                                                                  |
| `localScript`           | (optional) If set, load local `piwik.js` script from the given path, instead of loading it from your `matomoUrl`.                                                                                                                                                                                                  |
| `respectDnt`            | (optional) If false, will load all scripts without respecting user preference to `Do Not Track` on browsers. Defaults to `true`.                                                                                                                                                                                   |
| `dev`                   | (optional) Activate dev mode by setting to `true`. Will load all scripts despite not running in `production` environment. Ignores your local browser's DNT header too. Outputs some information in console about what it is doing. Useful for local testing but careful: all hits will be send like in production. |
| `enableJSErrorTracking` | (optional) Enable basic JavaScript error tracking and reporting in Matomo by setting to `true`.                                                                                                                                                                                                                    |
