import plugin = require("./index");
const vm = require("node:vm");

describe("Matomo bootstrap", () => {
  const originalEnvironment = process.env.NODE_ENV;
  beforeEach(() => { process.env.NODE_ENV = "production"; });
  afterEach(() => { process.env.NODE_ENV = originalEnvironment; });

  test("accepts the minimal public options type", () => {
    const options: plugin.Options = {
      siteId: "40",
      matomoUrl: "https://analytics.example.org",
      siteUrl: "https://docs.example.org",
    };
    expect(plugin({}, options).getClientModules()).toHaveLength(1);
  });

  test("rejects missing options", () => {
    // @ts-expect-error Verify runtime validation for JavaScript consumers.
    expect(() => plugin({})).toThrow("specify options");
  });

  test.each(["siteId", "matomoUrl", "siteUrl"])("rejects a missing %s", (field) => {
    const options: any = { siteId: "40", matomoUrl: "https://analytics.example.org", siteUrl: "https://docs.example.org" };
    delete options[field];
    expect(() => plugin({}, options)).toThrow("field was missing");
  });

  test.each([
    { dnt: "1", respectDnt: true, dev: false, tracks: false },
    { dnt: "1", respectDnt: false, dev: false, tracks: true },
    { dnt: "1", respectDnt: true, dev: true, tracks: true },
  ])("honors explicit DNT/debug behavior: %j", ({ dnt, respectDnt, dev, tracks }) => {
    const tags = plugin({}, {
      siteId: "40", matomoUrl: "https://analytics.example.org", siteUrl: "https://docs.example.org",
      respectDnt, dev, localScript: "/analytics.js", matomoPhpScript: "collect.php", enableJSErrorTracking: true,
    }).injectHtmlTags();
    const window: any = { doNotTrack: dnt };
    const insertBefore = jest.fn();
    vm.runInNewContext(tags.headTags!.find((tag) => tag.tagName === "script")!.innerHTML!, {
      window, navigator: {}, console: { debug() {} },
      document: {
        createElement: () => ({}),
        getElementsByTagName: () => [{ parentNode: { insertBefore } }],
      },
    });
    expect(Boolean(window._paq)).toBe(tracks);
    if (tracks) {
      expect(insertBefore.mock.calls[0][0].src).toBe("/analytics.js");
      expect(window._paq).toEqual(expect.arrayContaining([
        ["setTrackerUrl", "https://analytics.example.org/collect.php"],
        ["enableJSErrorTracking"],
      ]));
    } else {
      expect(insertBefore).not.toHaveBeenCalled();
    }
  });
});
