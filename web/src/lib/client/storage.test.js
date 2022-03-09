import StorageClient from "./storage";

// NOTE: should we export them?
const STORAGE_PROPOSAL_IFACE = "org.opensuse.DInstaller.Storage.Proposal1";
const STORAGE_ACTIONS_IFACE = "org.opensuse.DInstaller.Storage.Actions1";

const dbusClient = {};
const storageProposalProxy = {
  wait: jest.fn(),
  AvailableDevices: [
    { t: "s", v: "/dev/sda" },
    { t: "s", v: "/dev/sdb" }
  ],
  CandidateDevices: [{ t: "s", v: "/dev/sda" }],
  LVM: true
};

const storageActionsProxy = {
  wait: jest.fn(),
  All: [
    {
      t: "a{sv}",
      v: { Text: { t: "s", v: "Mount /dev/sdb1 as root" }, Subvol: { t: "b", v: false } }
    }
  ]
};

const proxies = {
  [STORAGE_PROPOSAL_IFACE]: storageProposalProxy,
  [STORAGE_ACTIONS_IFACE]: storageActionsProxy
};

beforeEach(() => {
  dbusClient.proxy = jest.fn().mockImplementation((iface, _path, _opts) => {
    return proxies[iface];
  });
});

describe("#getStorageProposal", () => {
  it("returns the storage proposal settings", async () => {
    const client = new StorageClient(dbusClient);
    const proposal = await client.getStorageProposal();
    expect(proposal).toEqual({
      availableDevices: ["/dev/sda", "/dev/sdb"],
      candidateDevices: ["/dev/sda"],
      lvm: true
    });
  });
});

describe("#getStorageActions", () => {
  it("returns the storage actions", async () => {
    const client = new StorageClient(dbusClient);
    const actions = await client.getStorageActions();
    expect(actions).toEqual([{ text: "Mount /dev/sdb1 as root", subvol: false }]);
  });
});
