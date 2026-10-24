const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");
const createPlugin = require("./index");

const options = {
  siteId: "40",
  matomoUrl: "https://analytics.example.org",
  siteUrl: "https://docs.example.org",
};

function createClient() {
  const context = {
    exports: {} as any,
    require: () => ({ default: { canUseDOM: true } }),
    window: { _paq: [] as any[], start: new Date(), dev: false },
    document: { title: "Home" },
    process: { env: { NODE_ENV: "production" } },
    setTimeout,
    clearTimeout,
    console,
  };
  const source = fs.readFileSync(path.join(__dirname, "piwik.js"), "utf8");
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    context
  );
  return { ...context, client: context.exports.default };
}

describe("Docusaurus Faster compatibility", () => {
  const originalEnvironment = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    jest.useFakeTimers();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnvironment;
    jest.useRealTimers();
  });

  test("does not inject the invalid noscript content that SWC exposes as text", () => {
    const tags = createPlugin({}, options).injectHtmlTags();
    expect(tags.headTags.some((tag: any) => tag.tagName === "noscript")).toBe(false);
  });

  test("keeps tracking disabled in development", () => {
    process.env.NODE_ENV = "development";
    const plugin = createPlugin({}, options);
    expect(plugin.injectHtmlTags()).toEqual({});
    expect(plugin.getClientModules()).toEqual([]);
  });

  test.each([false, true])("preserves consent and cookie settings (DNT=%s)", (dnt) => {
    const tags = createPlugin({}, {
      ...options,
      requireConsent: true,
      requireCookieConsent: true,
      disableCookies: true,
    }).injectHtmlTags();
    const window: any = {};
    const insertBefore = jest.fn();
    vm.runInNewContext(tags.headTags.find((tag: any) => tag.tagName === "script").innerHTML, {
      window,
      navigator: { doNotTrack: dnt ? "1" : "0" },
      document: {
        createElement: () => ({}),
        getElementsByTagName: () => [{ parentNode: { insertBefore } }],
      },
    });
    if (dnt) {
      expect(window._paq).toBeUndefined();
      expect(insertBefore).not.toHaveBeenCalled();
    } else {
      expect(window._paq).toEqual(expect.arrayContaining([
        ["requireConsent"], ["requireCookieConsent"], ["disableCookies"],
        ["setSiteId", "40"],
      ]));
      expect(insertBefore).toHaveBeenCalledTimes(1);
    }
  });

  test("tracks initial and committed SPA routes once, with current titles and referrers", () => {
    const { client, window, document } = createClient();
    const home = { pathname: "/", search: "", hash: "" };
    const docs = { pathname: "/docs", search: "?lang=en", hash: "#install" };
    client.onRouteDidUpdate({ location: home });
    jest.runAllTimers();
    expect(window._paq.filter((command) => command[0] === "trackPageView")).toHaveLength(1);

    window._paq.length = 0;
    client.onRouteDidUpdate({ location: docs, previousLocation: home });
    document.title = "Installation";
    jest.runAllTimers();
    expect(window._paq).toEqual(expect.arrayContaining([
      ["setCustomUrl", "/docs?lang=en#install"],
      ["setReferrerUrl", "/"],
      ["setDocumentTitle", "Installation"],
    ]));
    expect(window._paq.filter((command) => command[0] === "trackPageView")).toHaveLength(1);
  });

  test("does not track when the bootstrap has not enabled tracking", () => {
    const { client, window } = createClient();
    (window as any)._paq = undefined;
    expect(() => client.onRouteDidUpdate({ location: { pathname: "/", search: "", hash: "" } })).not.toThrow();
    expect(jest.getTimerCount()).toBe(0);
  });
});
