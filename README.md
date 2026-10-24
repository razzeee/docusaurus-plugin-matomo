# @gabrielcsapo/docusaurus-plugin-matomo

> Docusaurus Plugin to work with matomo analytics

## Unreleased maintenance branch

This fork prepares fixes for a maintained package. The package name still refers
to upstream; no fork release has been published.

- Fix [upstream issue #2](https://github.com/gabrielcsapo/docusaurus-plugin-matomo/issues/2):
  remove JavaScript incorrectly embedded in a head `<noscript>` tag. It never
  provided working no-JavaScript tracking and becomes visible text with the
  Docusaurus Faster HTML minifier. This version requires JavaScript for tracking.
- Track committed routes using `onRouteDidUpdate` and the supported
  `previousLocation` argument, preserving the delay for document-title updates.
- Preserve the existing consent, cookie and Do Not Track options.
- Normalize Matomo URL trailing slashes and serialize inline configuration safely.
- Cancel superseded delayed page views, use the active Matomo queue, and ignore
  unchanged routes. Debug mode now works in development as documented.
- Generate public TypeScript declarations with optional settings correctly typed,
  and publish only compiled runtime files and declarations.

Validated against Docusaurus 3.10.2, React 19.3.1 and all Faster options enabled.
Browser checks verify both the Matomo command queue and requests produced by the
real Matomo JavaScript client: one initial page view, one per navigation, current
titles and previous URLs. The collector is intercepted, so these checks do not
send analytics or verify ingestion by a live Matomo server.

The 22 regression tests pass on Node 20, 22 and 24. The package smoke test packs
and installs the tarball in a clean temporary consumer, checks its entry points
and contents, and typechecks a minimal TypeScript consumer. CI runs both suites
on those three Node versions. TypeScript stays on 5.9 because the current
`ts-jest` peer range excludes TypeScript 7.

Run the regression tests and compile the package:

```console
pnpm install --frozen-lockfile
pnpm test --runInBand
pnpm build
pnpm test:package
```

### Follow-up issues

- [Upstream #1: Track searches](https://github.com/gabrielcsapo/docusaurus-plugin-matomo/issues/1)
  is a feature request, not implemented here. It needs an integration point with
  the site's search provider; typing, submitted searches and result clicks should
  not be conflated.
- Route exclusion is not implemented; upstream advertised `exclude` without
  implementing it. Design its route-matching semantics before adding that API.
- Before publication, select the fork's package scope and version.
  Add a self-contained browser fixture to CI for repeatable Docusaurus upgrade
  checks; browser integration is currently verified against the Flathub site.

## Installation

```console
pnpm add -D @gabrielcsapo/docusaurus-plugin-matomo
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
| `requireConsent`        | (optional) If true, tracking will be disabled until you call `window._paq.push(['setConsentGiven']);`.                                                                                                                                                                                                             |
| `requireCookieConsent`  | (optional) If true, no cookies will be stored or used until you call `window._paq.push(['setCookieConsentGiven']);`.                                                                                                                                                                                               |
| `disableCookies`        | (optional) If true, no cookie will be used by Matomo.                                                                                                                                                                                                                                                              |
| `cookieDomain`          | (optional) Specify cookie domain.                                                                                                                                                                                                                                                                                  |
| `localScript`           | (optional) If set, load local `piwik.js` script from the given path, instead of loading it from your `matomoUrl`.                                                                                                                                                                                                  |
| `respectDnt`            | (optional) If false, will load all scripts without respecting user preference to `Do Not Track` on browsers. Defaults to `true`.                                                                                                                                                                                   |
| `dev`                   | (optional) Activate dev mode by setting to `true`. Will load all scripts despite not running in `production` environment. Ignores your local browser's DNT header too. Outputs some information in console about what it is doing. Useful for local testing but careful: all hits will be send like in production. |
| `enableJSErrorTracking` | (optional) Enable basic JavaScript error tracking and reporting in Matomo by setting to `true`.                                                                                                                                                                                                                    |
