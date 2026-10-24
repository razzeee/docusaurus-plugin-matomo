# 0.2.0

- Introduce the maintained `@razzeee/docusaurus-plugin-matomo` package, targeting
  Docusaurus 3.10.2+ and Node.js 20+.
- Add opt-in site search analytics for live search inputs and search-results
  routes, with debouncing, IME handling and duplicate suppression. Addresses
  [upstream #1](https://github.com/gabrielcsapo/docusaurus-plugin-matomo/issues/1).
- Fix malformed `<noscript>` markup exposed as visible text by Docusaurus Faster
  ([upstream #2](https://github.com/gabrielcsapo/docusaurus-plugin-matomo/issues/2)).
  The broken fallback has been removed; tracking requires JavaScript.
- Track committed routes with current page titles and referrers. Cancel obsolete
  page-view timers and use the current Matomo queue.
- Fix development mode, trailing URL slashes and inline configuration escaping.
- Correct optional TypeScript settings and generate public declarations.
- Modernize dependencies and adopt pnpm, Node 20/22/24 CI and packaged-consumer
  tests. Remove compiled tests from the published package.

# 0.1.2 (01/11/2022)

- Fixes main package.json entry (@gabrielcsapo)

# 0.1.1 (01/11/2022)

- Uses the right package.json entry to expose types (@gabrielcsapo)

# 0.1.0 (01/11/2022)

- Updates to expose typescript types (@gabrielcsapo)

# 0.0.1 (07/14/2021)

- Basic functionality and tests are provided
