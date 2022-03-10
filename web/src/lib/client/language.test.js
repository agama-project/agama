import LanguageClient from "./language";

const LANGUAGE_IFACE = "org.opensuse.DInstaller.Language1";

const dbusClient = {};
const langProxy = {
  wait: jest.fn(),
  AvailableLanguages: [
    {
      t: "av",
      v: [
        { t: "s", v: "cs_CZ" },
        { t: "s", v: "Cestina" },
        { t: "a{sv}", v: {} }
      ]
    }
  ]
};

beforeEach(() => {
  dbusClient.proxy = jest.fn().mockImplementation((iface, _path, _opts) => {
    if (iface === LANGUAGE_IFACE) return langProxy;
  });
});

describe("#getLanguages", () => {
  it("returns the list of available languages", async () => {
    const client = new LanguageClient(dbusClient);
    const availableLanguages = await client.getLanguages();
    expect(availableLanguages).toEqual([{ id: "cs_CZ", name: "Cestina" }]);
  });
});
