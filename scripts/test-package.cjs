const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "matomo-package-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

try {
  const [packed] = JSON.parse(execFileSync(npm, [
    "pack", "--json", "--pack-destination", temporary,
  ], { cwd: root, encoding: "utf8" }));
  assert(!packed.files.some(({ path }) => /(^src\/|\.test\.|^coverage\/)/.test(path)),
    "Published package must not contain tests, source files or coverage output");

  fs.writeFileSync(path.join(temporary, "package.json"), '{"private":true}');
  execFileSync(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund",
    "--package-lock=false", path.join(temporary, packed.filename)], {
    cwd: temporary, stdio: "pipe",
  });

  const packagePath = path.join(temporary, "node_modules", packed.name);
  const plugin = require(packagePath);
  const options = { siteId: "40", matomoUrl: "https://analytics.example.org", siteUrl: "https://docs.example.org" };
  process.env.NODE_ENV = "production";
  const instance = plugin({}, options);
  assert(instance.getClientModules().every(fs.existsSync), "Published client modules must exist");
  assert(instance.injectHtmlTags().headTags.some((tag) => tag.tagName === "script"));

  const fixture = path.join(temporary, "consumer.ts");
  fs.writeFileSync(fixture, `import plugin = require(${JSON.stringify(packed.name)});
const options: plugin.Options = ${JSON.stringify(options)};
plugin({}, options);
`);
  const program = ts.createProgram([fixture], {
    strict: true, noEmit: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.Node16, moduleResolution: ts.ModuleResolutionKind.Node16,
    types: [],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => temporary,
      getNewLine: () => "\n",
    }));
  console.log("PASS: packed entry point, client module, minimal TypeScript consumer, and package contents");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
