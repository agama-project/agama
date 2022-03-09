import InstallerClient from "./index";
import cockpit from "../cockpit";

const cockpitModule = {
  dbus: () => dbusClient,
  variant: cockpit.variant
};

const DBUS_PATH = "/org/opensuse/YaST/Installer";
const DBUS_IFACE = "org.opensuse.YaST.Installer";
const LANGUAGE_IFACE = "org.opensuse.DInstaller.Language1";
const SOFTWARE_IFACE = "org.opensuse.DInstaller.Software1";
const MANAGER_IFACE = "org.opensuse.DInstaller.Manager1";
const STORAGE_PROPOSAL_IFACE = "org.opensuse.DInstaller.Storage.Proposal1";
const STORAGE_ACTIONS_IFACE = "org.opensuse.DInstaller.Storage.Actions1";

let dbusClient = {};
let langProxy = {
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

let softProxy = {
  wait: jest.fn(),
  AvailableBaseProducts: [
    {
      t: "av",
      v: [
        { t: "s", v: "MicroOS" },
        { t: "s", v: "openSUSE MicroOS" },
        { t: "a{sv}", v: {} }
      ]
    }
  ],
  SelectedBaseProduct: "microos"
};

let managerProxy = {
  wait: jest.fn(),
  Commit: jest.fn(),
  Status: 2
};

let storageProposalProxy = {
  wait: jest.fn(),
  AvailableDevices: [
    { t: "s", v: "/dev/sda" },
    { t: "s", v: "/dev/sdb" }
  ],
  CandidateDevices: [{ t: "s", v: "/dev/sda" }],
  LVM: true
};

let storageActionsProxy = {
  wait: jest.fn(),
  All: [
    {
      t: "a{sv}",
      v: { Text: { t: "s", v: "Mount /dev/sdb1 as root" }, Subvol: { t: "b", v: false } }
    }
  ]
};

const proxies = {
  [LANGUAGE_IFACE]: langProxy,
  [MANAGER_IFACE]: managerProxy,
  [SOFTWARE_IFACE]: softProxy,
  [STORAGE_PROPOSAL_IFACE]: storageProposalProxy,
  [STORAGE_ACTIONS_IFACE]: storageActionsProxy
};

beforeEach(() => {
  dbusClient.proxy = jest.fn().mockImplementation((iface, _path, _opts) => {
    return proxies[iface];
  });
});

// at this time, it is undefined; but let's be prepared in case it changes
const unmockedFetch = window.fetch;
afterAll(() => {
  window.fetch = unmockedFetch;
});

describe("#authenticate", () => {
  it("resolves to true if the user was successfully authenticated", async () => {
    const client = new InstallerClient(cockpitModule);
    window.fetch = jest.fn().mockImplementation(() => Promise.resolve({ status: 200 }));
    client.authorize("linux", "password");
    expect(window.fetch).toHaveBeenCalledWith("/cockpit/login", {
      headers: {
        Authorization: "Basic bGludXg6cGFzc3dvcmQ=",
        "X-Superuser": "any"
      }
    });
  });

  it("resolves to false if the user was not authenticated", async () => {
    const client = new InstallerClient(cockpitModule);
    window.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        status: 401,
        statusText: "Password does not match"
      })
    );
    expect(client.authorize("linux", "password")).rejects.toBe("Password does not match");
  });
});

describe("#isLoggedIn", () => {
  beforeEach(() => {
    jest.spyOn(window, "fetch");
  });

  it("resolves to true if a user is logged in", async () => {
    const client = new InstallerClient(cockpitModule);
    window.fetch = jest.fn().mockImplementation(() => Promise.resolve({ status: 200 }));
    const logged = await client.isLoggedIn();
    expect(logged).toEqual(true);
    expect(window.fetch).toHaveBeenCalledWith("/cockpit/login");
  });

  it("resolves to false if a user was not logged in", async () => {
    const client = new InstallerClient(cockpitModule);
    window.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        status: 401,
        statusText: "Password does not match"
      })
    );
    const logged = await client.isLoggedIn();
    expect(logged).toEqual(false);
  });
});

describe("#currentUser", () => {
  it("returns the user name from cockpit", async () => {
    cockpitModule.user = jest.fn().mockResolvedValue("linux");
    const client = new InstallerClient(cockpitModule);
    const username = await client.currentUser();
    expect(username).toEqual("linux");
  });
});
<<<<<<< HEAD
=======

describe("#getStatus", () => {
  it("returns the installer status", async () => {
    const client = new InstallerClient(cockpitModule);
    const status = await client.getStatus();
    expect(status).toEqual(0);
  });
});

describe("#startInstallation", () => {
  it("starts the installation", async () => {
    const client = new InstallerClient(cockpitModule);
    await client.startInstallation();
    expect(dbusClient.call).toHaveBeenCalledWith(DBUS_PATH, DBUS_IFACE, "Start");
  });
});
>>>>>>> f30c6e5 (Drop unneeded getOption and setOption methods)
