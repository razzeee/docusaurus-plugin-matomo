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

function createClient(canUseDOM = true, environment = "production") {
  const context = {
    exports: {} as any,
    require: () => ({ default: { canUseDOM } }),
    window: { _paq: [] as any[], start: new Date(), dev: false },
    document: { title: "Home" },
    process: { env: { NODE_ENV: environment } },
    setTimeout,
    clearTimeout,
    console: { debug: jest.fn() },
  };
  const source = fs.readFileSync(path.join(__dirname, "piwik.js"), "utf8");
  const sandbox: any = { ...context };
  if (!canUseDOM) {
    delete sandbox.window;
    delete sandbox.document;
  }
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    sandbox
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

  test("supports the documented development opt-in", () => {
    process.env.NODE_ENV = "development";
    const plugin = createPlugin({}, { ...options, dev: true });
    expect(plugin.getClientModules()).toHaveLength(1);
    expect(plugin.injectHtmlTags().headTags).not.toHaveLength(0);
  });

  test("normalizes trailing URL slashes and safely embeds quoted configuration", () => {
    const tags = createPlugin({}, {
      ...options,
      matomoUrl: `${options.matomoUrl}/`,
      cookieDomain: "example's.test</script>",
    }).injectHtmlTags();
    const window: any = {};
    const script = tags.headTags.find((tag: any) => tag.tagName === "script").innerHTML;
    expect(script).not.toContain("</script>");
    vm.runInNewContext(script, {
      window,
      navigator: {},
      document: {
        createElement: () => ({}),
        getElementsByTagName: () => [{ parentNode: { insertBefore() {} } }],
      },
    });
    expect(window._paq).toEqual(expect.arrayContaining([
      ["setTrackerUrl", `${options.matomoUrl}/piwik.php`],
      ["setCookieDomain", "example's.test</script>"],
    ]));
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

  test("does not access browser globals during SSR", () => {
    expect(createClient(false).client).toBeNull();
  });

  test("does not track development routes unless debug mode is enabled", () => {
    const { client, window } = createClient(true, "development");
    const route = { location: { pathname: "/", search: "", hash: "" } };
    client.onRouteDidUpdate(route);
    jest.runAllTimers();
    expect(window._paq).toEqual([]);
    window.dev = true;
    client.onRouteDidUpdate(route);
    jest.runAllTimers();
    expect(window._paq.filter((command) => command[0] === "trackPageView")).toHaveLength(1);
  });

  test("cancels superseded views instead of sending the next page's title for the old URL", () => {
    const { client, window, document } = createClient();
    const first = { pathname: "/first", search: "", hash: "" };
    const second = { pathname: "/second", search: "", hash: "" };
    client.onRouteDidUpdate({ location: first });
    client.onRouteDidUpdate({ location: second, previousLocation: first });
    document.title = "Second";
    jest.runAllTimers();
    expect(window._paq.filter((command) => command[0] === "setCustomUrl")).toEqual([
      ["setCustomUrl", "/second"],
    ]);
    expect(window._paq.filter((command) => command[0] === "trackPageView")).toHaveLength(1);
  });

  test("uses the current queue when Matomo replaces it before the title delay expires", () => {
    const { client, window } = createClient();
    client.onRouteDidUpdate({ location: { pathname: "/", search: "", hash: "" } });
    window._paq = [];
    jest.runAllTimers();
    expect(window._paq).toContainEqual(["trackPageView"]);
  });

  test("does not send a pending page view if tracking is disabled before the timer fires", () => {
    const { client, window } = createClient();
    client.onRouteDidUpdate({ location: { pathname: "/", search: "", hash: "" } });
    (window as any)._paq = undefined;
    expect(() => jest.runAllTimers()).not.toThrow();
  });

  test("tracks query and hash changes but ignores an unchanged URL", () => {
    const { client, window } = createClient();
    let location = { pathname: "/docs", search: "", hash: "" };
    client.onRouteDidUpdate({ location });
    jest.runAllTimers();
    for (const next of [
      { ...location, search: "?q=flatpak" },
      { ...location, search: "?q=flatpak", hash: "#install" },
    ]) {
      client.onRouteDidUpdate({ location: next, previousLocation: location });
      jest.runAllTimers();
      location = next;
    }
    client.onRouteDidUpdate({ location, previousLocation: { ...location } });
    jest.runAllTimers();
    expect(window._paq.filter((command) => command[0] === "trackPageView")).toHaveLength(3);
  });
});
