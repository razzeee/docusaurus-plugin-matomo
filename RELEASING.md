# Maintenance and releases

Dependabot checks pnpm dependencies and GitHub Actions weekly. Minor and patch
development-dependency updates are grouped; major dependency updates remain
separate. The configuration takes effect after it reaches the default branch.

## One-time npm setup

The package scope is `@razzeee`. Verify that your npm account owns that scope.
The first publish needs an authenticated package owner because npm's trusted
publisher configuration is attached to an existing package:

```sh
pnpm install --frozen-lockfile
pnpm test --runInBand
pnpm test:package
pnpm publish --access public
```

This publishes the version in `package.json`. Authenticate interactively with
npm first; do not put a token in the repository.

Then open the package's settings on npmjs.com and add a GitHub Actions trusted
publisher with these exact values:

- Organization or user: `razzeee`
- Repository: `docusaurus-plugin-matomo`
- Workflow filename: `release.yml`
- Environment: leave empty
- Allowed actions: enable **npm publish** (stage-only permission is insufficient)

The workflow uses OIDC and provenance, so it does not need an `NPM_TOKEN` secret.
Create the trusted publisher shortly before the next release: npm requires its
first successful publish within two days of configuring it.

Do not push a matching `v*` tag for that manually published bootstrap version:
it would attempt to publish the same npm version again. Start the automated
release flow with the next version. Existing npm versions cannot be overwritten.

## Subsequent releases

1. Merge the changes and release workflow into `main`.
2. Update `version` in `package.json` and add release notes to `CHANGELOG.md`.
   Commit and push those changes.
3. Create and push a matching tag from that commit, for example:

   ```sh
   git tag v0.2.1
   git push origin v0.2.1
   ```

The release workflow validates the version/tag match, runs tests and package
checks on Node 20, 22 and 24, packs with pnpm, publishes to npm, and creates a
GitHub release with the tarball attached. Stable versions use npm's `latest`
dist-tag; versions such as `0.3.0-beta.1` use `next` and GitHub's prerelease flag.

Do not reuse or move release tags. If npm publishing succeeds but GitHub release
creation fails, finish creating the GitHub release manually rather than rerunning
the publish step.

Only the final publishing command uses npm's CLI for its supported OIDC flow;
dependency installation, tests, builds and packing use pnpm.
