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

function createClient(canUseDOM = true, environment = "production", siteSearch: any = false, tracking = true) {
  const listeners: Record<string, Function> = {};
  const context = {
    exports: {} as any,
    require: () => ({ default: { canUseDOM } }),
    window: { _paq: (tracking ? [] : undefined) as any[], start: new Date(), dev: false, __matomoSiteSearch: siteSearch },
    document: { title: "Home", addEventListener: (name: string, listener: Function) => { listeners[name] = listener; } },
    URLSearchParams,
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
  return { ...context, client: context.exports.default, listeners };
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

  describe("opt-in site search", () => {
    const config = { inputSelector: ".navbar__search-input", debounceMs: 500, path: "/search", queryParameter: "q" };
    const input = (value: string, match = true) => ({ value, matches: () => match });
    const searches = (queue: any[]) => queue.filter((command) => command[0] === "trackSiteSearch");

    test("does not install input listeners by default or when tracking is disabled", () => {
      expect(createClient().listeners).toEqual({});
      expect(createClient(true, "production", config, false).listeners).toEqual({});
      expect(createClient(true, "development", config).listeners).toEqual({});
    });

    test("debounces matching inputs, trims keywords and ignores unrelated fields", () => {
      const { listeners, window } = createClient(true, "production", config);
      listeners.input({ target: input("password", false) });
      listeners.input({ target: input("flat") });
      jest.advanceTimersByTime(300);
      listeners.input({ target: input(" flatpak ") });
      jest.advanceTimersByTime(499);
      expect(searches(window._paq)).toEqual([]);
      jest.advanceTimersByTime(1);
      expect(searches(window._paq)).toEqual([["trackSiteSearch", "flatpak"]]);
    });

    test("Enter flushes once, with no duplicate after the debounce or results navigation", () => {
      const { client, listeners, window } = createClient(true, "production", config);
      listeners.input({ target: input("flatpak") });
      listeners.keydown({ target: input("flatpak"), key: "Enter" });
      client.onRouteDidUpdate({ location: { pathname: "/search/", search: "?q=flatpak", hash: "" } });
      jest.runAllTimers();
      expect(searches(window._paq)).toEqual([["trackSiteSearch", "flatpak"]]);
      expect(window._paq).not.toContainEqual(["trackPageView"]);
    });

    test("does not record empty or partially composed IME input", () => {
      const { listeners, window } = createClient(true, "production", config);
      listeners.input({ target: input("pending") });
      listeners.input({ target: input("   ") });
      jest.runAllTimers();
      listeners.input({ target: input("pending") });
      listeners.compositionstart({ target: input("pending") });
      jest.runAllTimers();
      listeners.input({ target: input("に"), isComposing: true });
      listeners.keydown({ target: input("に"), key: "Enter", isComposing: true });
      jest.runAllTimers();
      expect(searches(window._paq)).toEqual([]);
      listeners.compositionend({ target: input("日本語") });
      jest.runAllTimers();
      expect(searches(window._paq)).toEqual([["trackSiteSearch", "日本語"]]);
    });

    test("clearing the field allows the same keyword to be searched again", () => {
      const { listeners, window } = createClient(true, "production", config);
      for (const keyword of ["flatpak", "flatpak", "", "flatpak"]) {
        listeners.input({ target: input(keyword) });
        jest.runAllTimers();
      }
      expect(searches(window._paq)).toHaveLength(2);
    });

    test("records direct results-page visits instead of a duplicate page view", () => {
      const { client, window, document } = createClient(true, "production", config);
      client.onRouteDidUpdate({ location: { pathname: "/search", search: "?q=flatpak+apps", hash: "" } });
      document.title = "Search results";
      jest.runAllTimers();
      expect(searches(window._paq)).toEqual([["trackSiteSearch", "flatpak apps"]]);
      expect(window._paq).toContainEqual(["setDocumentTitle", "Search results"]);
      expect(window._paq).not.toContainEqual(["trackPageView"]);
    });

    test("debounces providers that replace the search URL on every keystroke", () => {
      const { client, window } = createClient(true, "production", config);
      client.onRouteDidUpdate({ location: { pathname: "/search", search: "?q=flat", hash: "" } });
      jest.advanceTimersByTime(100);
      client.onRouteDidUpdate({ location: { pathname: "/search", search: "?q=flatpak", hash: "" } });
      jest.advanceTimersByTime(499);
      expect(searches(window._paq)).toEqual([]);
      jest.advanceTimersByTime(1);
      expect(searches(window._paq)).toEqual([["trackSiteSearch", "flatpak"]]);
    });

    test("supports custom result paths/query parameters and ignores q on ordinary pages", () => {
      const { client, window } = createClient(true, "production", { ...config, path: "/docs/find", queryParameter: "term" });
      client.onRouteDidUpdate({ location: { pathname: "/article", search: "?q=ignored", hash: "" } });
      jest.runAllTimers();
      client.onRouteDidUpdate({ location: { pathname: "/docs/find/", search: "?term=flatpak", hash: "" } });
      jest.runAllTimers();
      expect(searches(window._paq)).toEqual([["trackSiteSearch", "flatpak"]]);
      expect(window._paq.filter((command) => command[0] === "trackPageView")).toHaveLength(1);
    });

    test("flushes a fast suggestion click before tracking its destination", () => {
      const { client, listeners, window } = createClient(true, "production", config);
      listeners.input({ target: input("flatpak") });
      client.onRouteDidUpdate({ location: { pathname: "/docs/install", search: "", hash: "" } });
      jest.runAllTimers();
      expect(searches(window._paq)).toEqual([["trackSiteSearch", "flatpak"]]);
      expect(window._paq.findIndex((command) => command[0] === "trackSiteSearch"))
        .toBeLessThan(window._paq.findIndex((command) => command[0] === "trackPageView"));
    });

    test("checks the active queue when a delayed search runs", () => {
      const { listeners, window } = createClient(true, "production", config);
      listeners.input({ target: input("flatpak") });
      (window as any)._paq = undefined;
      expect(() => jest.runAllTimers()).not.toThrow();
    });
  });
});
