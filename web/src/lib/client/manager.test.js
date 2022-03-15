import ManagerClient from "./manager";

const MANAGER_IFACE = "org.opensuse.DInstaller.Manager1";

const dbusClient = {};
let managerProxy = {
  wait: jest.fn(),
  Commit: jest.fn(),
  Status: 2
};

beforeEach(() => {
  dbusClient.proxy = jest.fn().mockImplementation(iface => {
    if (iface == MANAGER_IFACE) return managerProxy;
  });
});

describe("#getStatus", () => {
  it("returns the installer status", async () => {
    const client = new ManagerClient(dbusClient);
    const status = await client.getStatus();
    expect(status).toEqual(2);
  });
});

describe("#startInstallation", () => {
  it("starts the installation", async () => {
    const client = new ManagerClient(dbusClient);
    await client.startInstallation();
    expect(managerProxy.Commit).toHaveBeenCalledWith();
  });
});
