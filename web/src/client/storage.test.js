/*
 * Copyright (c) [2022-2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

// @ts-check
// cspell:ignore ECKD dasda ddgdcbibhd wwpns

import DBusClient from "./dbus";
import { StorageClient } from "./storage";

jest.mock("./dbus");

const cockpitProxies = {};

const cockpitCallbacks = {};

let managedObjects = {};

const volumes = [
  {
    MountPoint: { t: "s", v: "/test1" },
    DeviceType: { t: "s", v: "partition" },
    Optional: { t: "b", v: true },
    Encrypted: { t: "b", v: false },
    FixedSizeLimits: { t: "b", v: false },
    AdaptiveSizes: { t: "b", v: false },
    MinSize: { t: "x", v: 1024 },
    MaxSize: { t: "x", v: 2048 },
    FsTypes: { t: "as", v: [{ t: "s", v: "Btrfs" }, { t: "s", v: "Ext3" }] },
    FsType: { t: "s", v: "Btrfs" },
    Snapshots: { t: "b", v: true },
    SnapshotsConfigurable: { t: "b", v: true },
    SnapshotsAffectSizes: { t: "b", v: false },
    SizeRelevantVolumes: { t: "as", v: [] }
  },
  {
    MountPoint: { t: "s", v: "/test2" }
  }
];

const systemDevices = {
  sda: {
    sid: "59",
    type: "disk",
    vendor: "Micron",
    model: "Micron 1100 SATA",
    driver: ["ahci", "mmcblk"],
    bus: "IDE",
    busId: "",
    transport: "usb",
    dellBOSS: false,
    sdCard: true,
    active: true,
    name: "/dev/sda",
    size: 1024,
    systems : ["Windows", "openSUSE Leap 15.2"],
    udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
    udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
    partitionTable: {
      type: "gpt",
      partitions: ["/dev/sda1", "/dev/sda2"]
    }
  },
  sdb: {
    sid: "60",
    type: "disk",
    vendor: "Samsung",
    model: "Samsung Evo 8 Pro",
    driver: ["ahci"],
    bus: "IDE",
    busId: "",
    transport: "",
    dellBOSS: false,
    sdCard: false,
    active: true,
    name: "/dev/sdb",
    size: 2048,
    systems : [],
    udevIds: [],
    udevPaths: ["pci-0000:00-19"]
  },
  md0: {
    sid: "62",
    type: "md",
    level: "raid0",
    uuid: "12345:abcde",
    members: ["/dev/sdb"],
    active: true,
    name: "/dev/md0",
    size: 2048,
    systems : [],
    udevIds: [],
    udevPaths: []
  },
  raid: {
    sid: "63",
    type: "raid",
    devices: ["/dev/sda", "/dev/sdb"],
    vendor: "Dell",
    model: "Dell BOSS-N1 Modular",
    driver: [],
    bus: "",
    busId: "",
    transport: "",
    dellBOSS: true,
    sdCard: false,
    active: true,
    name: "/dev/mapper/isw_ddgdcbibhd_244",
    size: 2048,
    systems : [],
    udevIds: [],
    udevPaths: []
  },
  multipath: {
    sid: "64",
    type: "multipath",
    wires: ["/dev/sdc", "/dev/sdd"],
    vendor: "",
    model: "",
    driver: [],
    bus: "",
    busId: "",
    transport: "",
    dellBOSS: false,
    sdCard: false,
    active: true,
    name: "/dev/mapper/36005076305ffc73a00000000000013b4",
    size: 2048,
    systems : [],
    udevIds: [],
    udevPaths: []
  },
  dasd: {
    sid: "65",
    type: "dasd",
    vendor: "IBM",
    model: "IBM",
    driver: [],
    bus: "",
    busId: "0.0.0150",
    transport: "",
    dellBOSS: false,
    sdCard: false,
    active: true,
    name: "/dev/dasda",
    size: 2048,
    systems : [],
    udevIds: [],
    udevPaths: []
  }
};

const contexts = {
  withoutProposal: () => {
    cockpitProxies.proposal = null;
  },
  withProposal: () => {
    cockpitProxies.proposal = {
      CandidateDevices:["/dev/sda"],
      LVM: true,
      Volumes: volumes,
      Actions: [
        {
          Text: { t: "s", v: "Mount /dev/sdb1 as root" },
          Subvol: { t: "b", v: false },
          Delete: { t: "b", v: false }
        }
      ]
    };
  },
  withAvailableDevices: () => {
    cockpitProxies.proposalCalculator.AvailableDevices = [
      "/org/opensuse/Agama/Storage1/system/59",
      "/org/opensuse/Agama/Storage1/system/60"
    ];
  },
  withVolumeTemplates: () => {
    cockpitProxies.proposalCalculator.VolumeTemplates = volumes;
  },
  withoutIssues: () => {
    cockpitProxies.issues = {
      All: []
    };
  },
  withIssues: () => {
    cockpitProxies.issues = {
      All: [["Issue 1", "", 1, 1], ["Issue 2", "", 1, 0], ["Issue 3", "", 2, 1]]
    };
  },
  withoutISCSINodes: () => {
    cockpitProxies.iscsiNodes = {};
  },
  withISCSINodes: () => {
    cockpitProxies.iscsiNodes = {
      "/org/opensuse/Agama/Storage1/iscsi_nodes/1": {
        path: "/org/opensuse/Agama/Storage1/iscsi_nodes/1",
        Target: "iqn.2023-01.com.example:37dac",
        Address: "192.168.100.101",
        Port: 3260,
        Interface: "default",
        IBFT: false,
        Connected: false,
        Startup: ""
      },
      "/org/opensuse/Agama/Storage1/iscsi_nodes/2": {
        path: "/org/opensuse/Agama/Storage1/iscsi_nodes/2",
        Target: "iqn.2023-01.com.example:74afb",
        Address: "192.168.100.102",
        Port: 3260,
        Interface: "default",
        IBFT: true,
        Connected: true,
        Startup: "onboot"
      }
    };
  },
  withoutDASDDevices: () => {
    cockpitProxies.dasdDevices = {};
  },
  withDASDDevices: () => {
    cockpitProxies.dasdDevices = {
      "/org/opensuse/Agama/Storage1/dasds/8": {
        path: "/org/opensuse/Agama/Storage1/dasds/8",
        AccessType: "",
        DeviceName: "dasd_sample_8",
        Diag: false,
        Enabled: true,
        Formatted: false,
        Id: "0.0.019e",
        PartitionInfo: "",
        Type: "ECKD"
      },
      "/org/opensuse/Agama/Storage1/dasds/9": {
        path: "/org/opensuse/Agama/Storage1/dasds/9",
        AccessType: "rw",
        DeviceName: "dasd_sample_9",
        Diag: false,
        Enabled: true,
        Formatted: false,
        Id: "0.0.ffff",
        PartitionInfo: "/dev/dasd_sample_9",
        Type: "FBA"
      }
    };
  },
  withoutZFCPControllers: () => {
    cockpitProxies.zfcpControllers = {};
  },
  withZFCPControllers: () => {
    cockpitProxies.zfcpControllers = {
      "/org/opensuse/Agama/Storage1/zfcp_controllers/1": {
        path: "/org/opensuse/Agama/Storage1/zfcp_controllers/1",
        Active: false,
        LUNScan: false,
        Channel: "0.0.fa00"
      },
      "/org/opensuse/Agama/Storage1/zfcp_controllers/2": {
        path: "/org/opensuse/Agama/Storage1/zfcp_controllers/2",
        Active: false,
        LUNScan: false,
        Channel: "0.0.fc00"
      }
    };
  },
  withoutZFCPDisks: () => {
    cockpitProxies.zfcpDisks = {};
  },
  withZFCPDisks: () => {
    cockpitProxies.zfcpDisks = {
      "/org/opensuse/Agama/Storage1/zfcp_disks/1": {
        path: "/org/opensuse/Agama/Storage1/zfcp_disks/1",
        Name: "/dev/sda",
        Channel: "0.0.fa00",
        WWPN: "0x500507630703d3b3",
        LUN: "0x0000000000000000"
      },
      "/org/opensuse/Agama/Storage1/zfcp_disks/2": {
        path: "/org/opensuse/Agama/Storage1/zfcp_disks/2",
        Name: "/dev/sdb",
        Channel: "0.0.fa00",
        WWPN: "0x500507630703d3b3",
        LUN: "0x0000000000000001"
      }
    };
  },
  withSystemDevices: () => {
    managedObjects["/org/opensuse/Agama/Storage1/system/59"] = {
      "org.opensuse.Agama.Storage1.Drive": {
        Type: { t: "s", v: "disk" },
        Vendor: { t: "s", v: "Micron" },
        Model: { t: "s", v: "Micron 1100 SATA" },
        Driver: { t: "as", v: ["ahci", "mmcblk"] },
        Bus: { t: "s", v: "IDE" },
        BusId: { t: "s", v: "" },
        Transport: { t: "s", v: "usb" },
        Info: { t: "a{sv}", v: { DellBOSS: { t: "b", v: false }, SDCard: { t: "b", v: true } } },
      },
      "org.opensuse.Agama.Storage1.Block": {
        Active: { t: "b", v: true },
        Name: { t: "s", v: "/dev/sda" },
        Size: { t: "x", v: 1024 },
        Systems: { t: "as", v: ["Windows", "openSUSE Leap 15.2"] },
        UdevIds: { t: "as", v: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"] },
        UdevPaths: { t: "as", v: ["pci-0000:00-12", "pci-0000:00-12-ata"] }
      },
      "org.opensuse.Agama.Storage1.PartitionTable": {
        Type: { t: "s", v: "gpt" },
        Partitions: { t: "as", v: ["/dev/sda1", "/dev/sda2"] }
      }
    };
    managedObjects["/org/opensuse/Agama/Storage1/system/60"] = {
      "org.opensuse.Agama.Storage1.Drive": {
        Type: { t: "s", v: "disk" },
        Vendor: { t: "s", v: "Samsung" },
        Model: { t: "s", v: "Samsung Evo 8 Pro" },
        Driver: { t: "as", v: ["ahci"] },
        Bus: { t: "s", v: "IDE" },
        BusId: { t: "s", v: "" },
        Transport: { t: "s", v: "" },
        Info: { t: "a{sv}", v: { DellBOSS: { t: "b", v: false }, SDCard: { t: "b", v: false } } },
      },
      "org.opensuse.Agama.Storage1.Block": {
        Active: { t: "b", v: true },
        Name: { t: "s", v: "/dev/sdb" },
        Size: { t: "x", v: 2048 },
        Systems: { t: "as", v: [] },
        UdevIds: { t: "as", v: [] },
        UdevPaths: { t: "as", v: ["pci-0000:00-19"] }
      }
    };
    managedObjects["/org/opensuse/Agama/Storage1/system/62"] = {
      "org.opensuse.Agama.Storage1.MD": {
        Level: { t: "s", v: "raid0" },
        UUID: { t: "s", v: "12345:abcde" },
        Members: { t: "as", v: ["/dev/sdb"] }
      },
      "org.opensuse.Agama.Storage1.Block": {
        Active: { t: "b", v: true },
        Name: { t: "s", v: "/dev/md0" },
        Size: { t: "x", v: 2048 },
        Systems: { t: "as", v: [] },
        UdevIds: { t: "as", v: [] },
        UdevPaths: { t: "as", v: [] }
      }
    };
    managedObjects["/org/opensuse/Agama/Storage1/system/63"] = {
      "org.opensuse.Agama.Storage1.Drive": {
        Type: { t: "s", v: "raid" },
        Vendor: { t: "s", v: "Dell" },
        Model: { t: "s", v: "Dell BOSS-N1 Modular" },
        Driver: { t: "as", v: [] },
        Bus: { t: "s", v: "" },
        BusId: { t: "s", v: "" },
        Transport: { t: "s", v: "" },
        Info: { t: "a{sv}", v: { DellBOSS: { t: "b", v: true }, SDCard: { t: "b", v: false } } },
      },
      "org.opensuse.Agama.Storage1.RAID" : {
        Devices: { t: "as", v: ["/dev/sda", "/dev/sdb"] }
      },
      "org.opensuse.Agama.Storage1.Block": {
        Active: { t: "b", v: true },
        Name: { t: "s", v: "/dev/mapper/isw_ddgdcbibhd_244" },
        Size: { t: "x", v: 2048 },
        Systems: { t: "as", v: [] },
        UdevIds: { t: "as", v: [] },
        UdevPaths: { t: "as", v: [] }
      }
    };
    managedObjects["/org/opensuse/Agama/Storage1/system/64"] = {
      "org.opensuse.Agama.Storage1.Drive": {
        Type: { t: "s", v: "multipath" },
        Vendor: { t: "s", v: "" },
        Model: { t: "s", v: "" },
        Driver: { t: "as", v: [] },
        Bus: { t: "s", v: "" },
        BusId: { t: "s", v: "" },
        Transport: { t: "s", v: "" },
        Info: { t: "a{sv}", v: { DellBOSS: { t: "b", v: false }, SDCard: { t: "b", v: false } } },
      },
      "org.opensuse.Agama.Storage1.Multipath" : {
        Wires: { t: "as", v: ["/dev/sdc", "/dev/sdd"] }
      },
      "org.opensuse.Agama.Storage1.Block": {
        Active: { t: "b", v: true },
        Name: { t: "s", v: "/dev/mapper/36005076305ffc73a00000000000013b4" },
        Size: { t: "x", v: 2048 },
        Systems: { t: "as", v: [] },
        UdevIds: { t: "as", v: [] },
        UdevPaths: { t: "as", v: [] }
      }
    };
    managedObjects["/org/opensuse/Agama/Storage1/system/65"] = {
      "org.opensuse.Agama.Storage1.Drive": {
        Type: { t: "s", v: "dasd" },
        Vendor: { t: "s", v: "IBM" },
        Model: { t: "s", v: "IBM" },
        Driver: { t: "as", v: [] },
        Bus: { t: "s", v: "" },
        BusId: { t: "s", v: "0.0.0150" },
        Transport: { t: "s", v: "" },
        Info: { t: "a{sv}", v: { DellBOSS: { t: "b", v: false }, SDCard: { t: "b", v: false } } },
      },
      "org.opensuse.Agama.Storage1.Block": {
        Active: { t: "b", v: true },
        Name: { t: "s", v: "/dev/dasda" },
        Size: { t: "x", v: 2048 },
        Systems: { t: "as", v: [] },
        UdevIds: { t: "as", v: [] },
        UdevPaths: { t: "as", v: [] }
      }
    };
  }
};

const mockProxy = (iface, path) => {
  switch (iface) {
    case "org.opensuse.Agama1.Issues": return cockpitProxies.issues;
    case "org.opensuse.Agama.Storage1": return cockpitProxies.storage;
    case "org.opensuse.Agama.Storage1.Proposal": return cockpitProxies.proposal;
    case "org.opensuse.Agama.Storage1.Proposal.Calculator": return cockpitProxies.proposalCalculator;
    case "org.opensuse.Agama.Storage1.ISCSI.Initiator": return cockpitProxies.iscsiInitiator;
    case "org.opensuse.Agama.Storage1.ISCSI.Node": return cockpitProxies.iscsiNode[path];
    case "org.opensuse.Agama.Storage1.DASD.Manager": return cockpitProxies.dasdManager;
    case "org.opensuse.Agama.Storage1.ZFCP.Manager": return cockpitProxies.zfcpManager;
    case "org.opensuse.Agama.Storage1.ZFCP.Controller": return cockpitProxies.zfcpController[path];
  }
};

const mockProxies = (iface) => {
  switch (iface) {
    case "org.opensuse.Agama.Storage1.ISCSI.Node": return cockpitProxies.iscsiNodes;
    case "org.opensuse.Agama.Storage1.DASD.Device": return cockpitProxies.dasdDevices;
    case "org.opensuse.Agama.Storage1.ZFCP.Controller": return cockpitProxies.zfcpControllers;
    case "org.opensuse.Agama.Storage1.ZFCP.Disk": return cockpitProxies.zfcpDisks;
  }
};

const mockOnObjectChanged = (path, iface, handler) => {
  if (!cockpitCallbacks[path]) cockpitCallbacks[path] = {};
  cockpitCallbacks[path][iface] = handler;
};

const emitSignal = (path, iface, data) => {
  if (!cockpitCallbacks[path]) return;

  const handler = cockpitCallbacks[path][iface];
  if (!handler) return;

  return handler(data);
};

const mockCall = (_path, iface, method) => {
  if (iface === "org.freedesktop.DBus.ObjectManager" && method === "GetManagedObjects")
    return [managedObjects];
};

const reset = () => {
  cockpitProxies.issues = {};
  cockpitProxies.storage = {};
  cockpitProxies.proposalCalculator = {};
  cockpitProxies.proposal = null;
  cockpitProxies.iscsiInitiator = {};
  cockpitProxies.iscsiNodes = {};
  cockpitProxies.iscsiNode = {};
  cockpitProxies.dasdManager = {};
  cockpitProxies.dasdDevices = {};
  cockpitProxies.zfcpManager = {};
  cockpitProxies.zfcpControllers = {};
  cockpitProxies.zfcpDisks = {};
  cockpitProxies.zfcpController = {};
  managedObjects = {};
};

beforeEach(() => {
  reset();

  // @ts-ignore
  DBusClient.mockImplementation(() => {
    return {
      proxy: mockProxy,
      proxies: mockProxies,
      onObjectChanged: mockOnObjectChanged,
      call: mockCall
    };
  });
});

let client;

describe("#probe", () => {
  beforeEach(() => {
    cockpitProxies.storage = {
      Probe: jest.fn()
    };

    client = new StorageClient();
  });

  it("probes the system", async () => {
    await client.probe();
    expect(cockpitProxies.storage.Probe).toHaveBeenCalled();
  });
});

describe("#isDeprecated", () => {
  describe("if the system is not deprecated", () => {
    beforeEach(() => {
      cockpitProxies.storage = {
        DeprecatedSystem: false
      };

      client = new StorageClient();
    });

    it("returns false", async () => {
      const result = await client.isDeprecated();
      expect(result).toEqual(false);
    });
  });
});

describe("#onDeprecate", () => {
  const handler = jest.fn();

  beforeEach(() => {
    client = new StorageClient();
    client.onDeprecate(handler);
  });

  describe("if the system was not deprecated", () => {
    beforeEach(() => {
      emitSignal(
        "/org/opensuse/Agama/Storage1",
        "org.opensuse.Agama.Storage1",
        {});
    });

    it("does not run the handler", async () => {
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("if the system was deprecated", () => {
    beforeEach(() => {
      emitSignal(
        "/org/opensuse/Agama/Storage1",
        "org.opensuse.Agama.Storage1",
        { DeprecatedSystem: true });
    });

    it("runs the handler", async () => {
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe("#getIssues", () => {
  describe("if there are no issues", () => {
    beforeEach(() => {
      contexts.withoutIssues();
    });

    it("returns an empty list", async () => {
      client = new StorageClient();
      const issues = await client.getIssues();
      expect(issues).toEqual([]);
    });
  });

  describe("if there are issues", () => {
    beforeEach(() => {
      contexts.withIssues();
    });

    it("returns the list of issues", async () => {
      client = new StorageClient();
      const issues = await client.getIssues();
      expect(issues).toEqual(expect.arrayContaining([
        { description: "Issue 1", details: "", source: "system", severity: "error" },
        { description: "Issue 2", details: "", source: "system", severity: "warn" },
        { description: "Issue 3", details: "", source: "config", severity: "error" }
      ]));
    });
  });
});

describe("#getErrors", () => {
  beforeEach(() => {
    contexts.withIssues();
  });

  it("returns the issues with error severity", async () => {
    client = new StorageClient();
    const errors = await client.getErrors();
    expect(errors.map(e => e.description)).toEqual(expect.arrayContaining(["Issue 1", "Issue 3"]));
  });
});

describe("#onIssuesChange", () => {
  it("runs the handler when the issues change", async () => {
    client = new StorageClient();

    const handler = jest.fn();
    client.onIssuesChange(handler);

    emitSignal(
      "/org/opensuse/Agama/Storage1",
      "org.opensuse.Agama1.Issues",
      { All: { v: [["Issue 1", "", 1, 0], ["Issue 2", "", 2, 1]] } });

    expect(handler).toHaveBeenCalledWith([
      { description: "Issue 1", details: "", source: "system", severity: "warn" },
      { description: "Issue 2", details: "", source: "config", severity: "error" },
    ]);
  });
});

describe("#system", () => {
  describe("#getDevices", () => {
    describe("when there are devices", () => {
      beforeEach(() => {
        contexts.withSystemDevices();
        client = new StorageClient();
      });

      it("returns the system devices", async () => {
        const devices = await client.system.getDevices();
        expect(devices).toEqual(Object.values(systemDevices));
      });
    });

    describe("when there are not devices", () => {
      beforeEach(() => {
        client = new StorageClient();
      });

      it("returns an empty list", async () => {
        const devices = await client.system.getDevices();
        expect(devices).toEqual([]);
      });
    });
  });
});

describe("#proposal", () => {
  const checkAvailableDevices = (availableDevices) => {
    expect(availableDevices).toEqual([systemDevices.sda, systemDevices.sdb]);
  };

  const checkVolumes = (volumes) => {
    expect(volumes.length).toEqual(2);
    expect(volumes[0]).toEqual({
      mountPoint: "/test1",
      deviceType: "partition",
      optional: true,
      encrypted: false,
      fixedSizeLimits: false,
      adaptiveSizes: false,
      minSize: 1024,
      maxSize:2048,
      fsTypes: ["Btrfs", "Ext3"],
      fsType: "Btrfs",
      snapshots: true,
      snapshotsConfigurable: true,
      snapshotsAffectSizes: false,
      sizeRelevantVolumes: []
    });
    expect(volumes[1].mountPoint).toEqual("/test2");
  };

  const checkProposalResult = (result) => {
    expect(result.candidateDevices).toEqual(["/dev/sda"]);
    expect(result.lvm).toBeTruthy();
    expect(result.actions).toEqual([
      { text: "Mount /dev/sdb1 as root", subvol: false, delete: false }
    ]);
    checkVolumes(result.volumes);
  };

  describe("#getData", () => {
    beforeEach(() => {
      contexts.withSystemDevices();
      contexts.withAvailableDevices();
      contexts.withVolumeTemplates();
      contexts.withProposal();
      client = new StorageClient();
    });

    it("returns the available devices, templates and the proposal result", async () => {
      const { availableDevices, volumeTemplates, result } = await client.proposal.getData();
      checkAvailableDevices(availableDevices);
      checkVolumes(volumeTemplates);
      checkProposalResult(result);
    });
  });

  describe("#getAvailableDevices", () => {
    beforeEach(() => {
      contexts.withSystemDevices();
      contexts.withAvailableDevices();
      client = new StorageClient();
    });

    it("returns the list of available devices", async () => {
      const availableDevices = await client.proposal.getAvailableDevices();
      checkAvailableDevices(availableDevices);
    });
  });

  describe("#getVolumeTemplates", () => {
    beforeEach(() => {
      contexts.withVolumeTemplates();
      client = new StorageClient();
    });

    it("returns the list of available volume templates", async () => {
      const volumeTemplates = await client.proposal.getVolumeTemplates();
      checkVolumes(volumeTemplates);
    });
  });

  describe("#getResult", () => {
    describe("if there is no proposal yet", () => {
      beforeEach(() => {
        contexts.withoutProposal();
        client = new StorageClient();
      });

      it("returns undefined", async () => {
        const result = await client.proposal.getResult();
        expect(result).toBe(undefined);
      });
    });

    describe("if there is a proposal", () => {
      beforeEach(() => {
        contexts.withProposal();
        client = new StorageClient();
      });

      it("returns the proposal settings and actions", async () => {
        const result = await client.proposal.getResult();
        checkProposalResult(result);
      });
    });
  });

  describe("#calculate", () => {
    beforeEach(() => {
      cockpitProxies.proposalCalculator = {
        Calculate: jest.fn()
      };

      client = new StorageClient();
    });

    it("calculates a default proposal when no settings are given", async () => {
      await client.proposal.calculate({});
      expect(cockpitProxies.proposalCalculator.Calculate).toHaveBeenCalledWith({});
    });

    it("calculates a proposal with the given settings", async () => {
      await client.proposal.calculate({
        candidateDevices: ["/dev/vda"],
        encryptionPassword: "12345",
        lvm: true,
        volumes: [
          {
            mountPoint: "/test1",
            encrypted: false,
            fsType: "Btrfs",
            minSize: 1024,
            maxSize:2048,
            fixedSizeLimits: false,
            snapshots: true
          },
          {
            mountPoint: "/test2",
            minSize: 1024
          }
        ]
      });

      expect(cockpitProxies.proposalCalculator.Calculate).toHaveBeenCalledWith({
        CandidateDevices: { t: "as", v: ["/dev/vda"] },
        EncryptionPassword: { t: "s", v: "12345" },
        LVM: { t: "b", v: true },
        Volumes: {
          t: "aa{sv}",
          v: [
            {
              MountPoint: { t: "s", v: "/test1" },
              Encrypted: { t: "b", v: false },
              FsType: { t: "s", v: "Btrfs" },
              MinSize: { t: "x", v: 1024 },
              MaxSize: { t: "x", v: 2048 },
              FixedSizeLimits: { t: "b", v: false },
              Snapshots: { t: "b", v: true }
            },
            {
              MountPoint: { t: "s", v: "/test2" },
              MinSize: { t: "x", v: 1024 }
            }
          ]
        }
      });
    });
  });
});

describe("#dasd", () => {
  const sampleDasdDevice = {
    id: "8",
    accessType: "",
    channelId: "0.0.019e",
    diag: false,
    enabled: true,
    formatted: false,
    hexId: 414,
    name: "sample_dasd_device",
    partitionInfo: "",
    type: "ECKD"
  };

  const probeFn = jest.fn();
  const setDiagFn = jest.fn();
  const enableFn = jest.fn();
  const disableFn = jest.fn();

  beforeEach(() => {
    client = new StorageClient();
    cockpitProxies.dasdManager = {
      Probe: probeFn,
      SetDiag: setDiagFn,
      Enable: enableFn,
      Disable: disableFn
    };
    contexts.withDASDDevices();
  });

  describe("#getDevices", () => {
    it("triggers probing", async () => {
      await client.dasd.getDevices();
      expect(probeFn).toHaveBeenCalled();
    });

    describe("if there is no exported DASD devices yet", () => {
      beforeEach(() => {
        contexts.withoutDASDDevices();
      });

      it("returns an empty list", async () => {
        const result = await client.dasd.getDevices();
        expect(result).toStrictEqual([]);
      });
    });

    describe("if there are exported DASD devices", () => {
      it("returns a list with the exported DASD devices", async () => {
        const result = await client.dasd.getDevices();
        expect(result.length).toEqual(2);
        expect(result).toContainEqual({
          id: "8",
          accessType: "",
          channelId: "0.0.019e",
          diag: false,
          enabled: true,
          formatted: false,
          hexId: 414,
          name: "dasd_sample_8",
          partitionInfo: "",
          type: "ECKD"
        });
        expect(result).toContainEqual({
          id: "9",
          accessType: "rw",
          channelId: "0.0.ffff",
          diag: false,
          enabled: true,
          formatted: false,
          hexId: 65535,
          name: "dasd_sample_9",
          partitionInfo: "/dev/dasd_sample_9",
          type: "FBA"
        });
      });
    });
  });

  describe("#setDIAG", () => {
    it("requests for setting DIAG for given devices", async () => {
      await client.dasd.setDIAG([sampleDasdDevice], true);
      expect(setDiagFn).toHaveBeenCalledWith(
        ["/org/opensuse/Agama/Storage1/dasds/8"],
        true
      );

      await client.dasd.setDIAG([sampleDasdDevice], false);
      expect(setDiagFn).toHaveBeenCalledWith(
        ["/org/opensuse/Agama/Storage1/dasds/8"],
        false
      );
    });
  });

  describe("#enableDevices", () => {
    it("requests for enabling given devices", async () => {
      await client.dasd.enableDevices([sampleDasdDevice]);
      expect(enableFn).toHaveBeenCalledWith(["/org/opensuse/Agama/Storage1/dasds/8"]);
    });
  });

  describe("#disableDevices", () => {
    it("requests for disabling given devices", async () => {
      await client.dasd.disableDevices([sampleDasdDevice]);
      expect(disableFn).toHaveBeenCalledWith(["/org/opensuse/Agama/Storage1/dasds/8"]);
    });
  });
});

describe("#zfcp", () => {
  const probeFn = jest.fn();
  let controllersCallbacks;
  let disksCallbacks;

  const mockEventListener = (proxy, callbacks) => {
    proxy.addEventListener = jest.fn().mockImplementation(
      (signal, handler) => {
        if (!callbacks[signal]) callbacks[signal] = [];
        callbacks[signal].push(handler);
      }
    );

    proxy.removeEventListener = jest.fn();
  };

  const emitSignals = (callbacks, signal, proxy) => {
    callbacks[signal].forEach(handler => handler(null, proxy));
  };

  beforeEach(() => {
    client = new StorageClient();
    cockpitProxies.zfcpManager = {
      Probe: probeFn,
      AllowLUNScan: true
    };

    controllersCallbacks = {};
    mockEventListener(cockpitProxies.zfcpControllers, controllersCallbacks);

    disksCallbacks = {};
    mockEventListener(cockpitProxies.zfcpDisks, disksCallbacks);
  });

  describe("#isSupported", () => {
    describe("if zFCP manager is available", () => {
      it("returns true", async () => {
        const result = await client.zfcp.isSupported();
        expect(result).toEqual(true);
      });
    });

    describe("if zFCP manager is not available", () => {
      beforeEach(() => {
        cockpitProxies.zfcpManager = undefined;
      });

      it("returns false", async () => {
        const result = await client.zfcp.isSupported();
        expect(result).toEqual(false);
      });
    });
  });

  describe("#getAllowLUNScan", () => {
    it("returns whether allow_lun_scan is active", async () => {
      const result = await client.zfcp.getAllowLUNScan();
      expect(result).toEqual(true);
    });

    describe("if zFCP manager is not available", () => {
      beforeEach(() => {
        cockpitProxies.zfcpManager = undefined;
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.getAllowLUNScan();
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#probe", () => {
    it("triggers probing", async () => {
      await client.zfcp.probe();
      expect(probeFn).toHaveBeenCalled();
    });

    describe("if zFCP manager is not available", () => {
      beforeEach(() => {
        cockpitProxies.zfcpManager = undefined;
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.probe();
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#getControllers", () => {
    describe("if there is no exported zFCP controllers yet", () => {
      beforeEach(() => {
        contexts.withoutZFCPControllers();
      });

      it("returns an empty list", async () => {
        const result = await client.zfcp.getControllers();
        expect(result).toStrictEqual([]);
      });
    });

    describe("if there are exported ZFCP controllers", () => {
      beforeEach(() => {
        contexts.withZFCPControllers();
      });

      it("returns a list with the exported ZFCP controllers", async () => {
        const result = await client.zfcp.getControllers();
        expect(result.length).toEqual(2);
        expect(result).toContainEqual({
          id: "1",
          active: false,
          lunScan: false,
          channel: "0.0.fa00"
        });
        expect(result).toContainEqual({
          id: "2",
          active: false,
          lunScan: false,
          channel: "0.0.fc00"
        });
      });
    });
  });

  describe("#getDisks", () => {
    describe("if there is no exported zFCP disks yet", () => {
      beforeEach(() => {
        contexts.withoutZFCPDisks();
      });

      it("returns an empty list", async () => {
        const result = await client.zfcp.getDisks();
        expect(result).toStrictEqual([]);
      });
    });

    describe("if there are exported ZFCP disks", () => {
      beforeEach(() => {
        contexts.withZFCPDisks();
      });

      it("returns a list with the exported ZFCP disks", async () => {
        const result = await client.zfcp.getDisks();
        expect(result.length).toEqual(2);
        expect(result).toContainEqual({
          id: "1",
          name: "/dev/sda",
          channel: "0.0.fa00",
          wwpn: "0x500507630703d3b3",
          lun: "0x0000000000000000"
        });
        expect(result).toContainEqual({
          id: "2",
          name: "/dev/sdb",
          channel: "0.0.fa00",
          wwpn: "0x500507630703d3b3",
          lun: "0x0000000000000001"
        });
      });
    });
  });

  describe("#getWWPNs", () => {
    const wwpns = ["0x500507630703d3b3", "0x500507630708d3b3"];

    const controllerProxy = {
      GetWWPNs: jest.fn().mockReturnValue(wwpns)
    };

    beforeEach(() => {
      cockpitProxies.zfcpController = {
        "/org/opensuse/Agama/Storage1/zfcp_controllers/1": controllerProxy
      };
    });

    it("returns a list with the WWPNs of the zFCP controller", async () => {
      const result = await client.zfcp.getWWPNs({ id: "1" });
      expect(result).toStrictEqual(wwpns);
    });

    describe("if there is no proxy", () => {
      beforeEach(() => {
        cockpitProxies.zfcpController = {};
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.getWWPNs({ id: "1" });
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#getLUNs", () => {
    const luns = {
      "0x500507630703d3b3": ["0x0000000000000000", "0x0000000000000001", "0x0000000000000002"]
    };

    const controllerProxy = {
      GetLUNs: jest.fn().mockImplementation(wwpn => luns[wwpn])
    };

    beforeEach(() => {
      cockpitProxies.zfcpController = {
        "/org/opensuse/Agama/Storage1/zfcp_controllers/1": controllerProxy
      };
    });

    it("returns a list with the LUNs for a WWPN of the zFCP controller", async () => {
      const result = await client.zfcp.getLUNs({ id: "1" }, "0x500507630703d3b3");
      expect(result).toStrictEqual(luns["0x500507630703d3b3"]);
    });

    describe("if there is no proxy", () => {
      beforeEach(() => {
        cockpitProxies.zfcpController = {};
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.getLUNs({ id: "1" }, "0x500507630703d3b3");
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#activateController", () => {
    const activateFn = jest.fn().mockReturnValue(0);

    const controllerProxy = {
      Activate: activateFn
    };

    beforeEach(() => {
      cockpitProxies.zfcpController = {
        "/org/opensuse/Agama/Storage1/zfcp_controllers/1": controllerProxy
      };
    });

    it("tries to activate the given zFCP controller", async () => {
      const result = await client.zfcp.activateController({ id: "1" });
      expect(activateFn).toHaveBeenCalled();
      expect(result).toEqual(0);
    });

    describe("if there is no proxy", () => {
      beforeEach(() => {
        cockpitProxies.zfcpController = {};
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.activateController({ id: "1" });
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#activateDisk", () => {
    const activateDiskFn = jest.fn().mockReturnValue(0);

    const controllerProxy = {
      ActivateDisk: activateDiskFn
    };

    beforeEach(() => {
      cockpitProxies.zfcpController = {
        "/org/opensuse/Agama/Storage1/zfcp_controllers/1": controllerProxy
      };
    });

    it("tries to activate the given zFCP disk", async () => {
      const result = await client.zfcp.activateDisk({ id: "1" }, "0x500507630703d3b3", "0x0000000000000000");
      expect(activateDiskFn).toHaveBeenCalledWith("0x500507630703d3b3", "0x0000000000000000");
      expect(result).toEqual(0);
    });

    describe("if there is no proxy", () => {
      beforeEach(() => {
        cockpitProxies.zfcpController = {};
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.activateDisk({ id: "1" }, "0x500507630703d3b3", "0x0000000000000000");
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#deactivateDisk", () => {
    const deactivateDiskFn = jest.fn().mockReturnValue(0);

    const controllerProxy = {
      ActivateDisk: deactivateDiskFn
    };

    beforeEach(() => {
      cockpitProxies.zfcpController = {
        "/org/opensuse/Agama/Storage1/zfcp_controllers/1": controllerProxy
      };
    });

    it("tries to deactivate the given zFCP disk", async () => {
      const result = await client.zfcp.activateDisk({ id: "1" }, "0x500507630703d3b3", "0x0000000000000000");
      expect(deactivateDiskFn).toHaveBeenCalledWith("0x500507630703d3b3", "0x0000000000000000");
      expect(result).toEqual(0);
    });

    describe("if there is no proxy", () => {
      beforeEach(() => {
        cockpitProxies.zfcpController = {};
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.deactivateDisk({ id: "1" }, "0x500507630703d3b3", "0x0000000000000000");
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#onControllerChanged", () => {
    it("runs the handler when a zFCP controller changes", async () => {
      const handler = jest.fn();
      await client.zfcp.onControllerChanged(handler);

      emitSignals(controllersCallbacks, "changed", {
        path: "/org/opensuse/Agama/Storage1/zfcp_controllers/1",
        Active: true,
        LUNScan: true,
        Channel: "0.0.fa00"
      });

      expect(handler).toHaveBeenCalledWith({
        id: "1", active: true, lunScan: true, channel: "0.0.fa00"
      });
    });
  });

  describe("#onDiskAdded", () => {
    it("runs the handler when a zFCP disk is added", async () => {
      const handler = jest.fn();
      await client.zfcp.onDiskAdded(handler);

      emitSignals(disksCallbacks, "added", {
        path: "/org/opensuse/Agama/Storage1/zfcp_disks/1",
        Name: "/dev/sda",
        Channel: "0.0.fa00",
        WWPN: "0x500507630703d3b3",
        LUN: "0x0000000000000000"
      });

      expect(handler).toHaveBeenCalledWith({
        id: "1",
        name: "/dev/sda",
        channel: "0.0.fa00",
        wwpn: "0x500507630703d3b3",
        lun: "0x0000000000000000"
      });
    });
  });

  describe("#onDiskChanged", () => {
    it("runs the handler when a zFCP disk changes", async () => {
      const handler = jest.fn();
      await client.zfcp.onDiskChanged(handler);

      emitSignals(disksCallbacks, "changed", {
        path: "/org/opensuse/Agama/Storage1/zfcp_disks/1",
        Name: "/dev/sda",
        Channel: "0.0.fa00",
        WWPN: "0x500507630703d3b3",
        LUN: "0x0000000000000000"
      });

      expect(handler).toHaveBeenCalledWith({
        id: "1",
        name: "/dev/sda",
        channel: "0.0.fa00",
        wwpn: "0x500507630703d3b3",
        lun: "0x0000000000000000"
      });
    });
  });

  describe("#onDiskRemoved", () => {
    it("runs the handler when a zFCP disk is removed", async () => {
      const handler = jest.fn();
      await client.zfcp.onDiskRemoved(handler);

      emitSignals(disksCallbacks, "removed", {
        path: "/org/opensuse/Agama/Storage1/zfcp_disks/1",
        Name: "/dev/sda",
        Channel: "0.0.fa00",
        WWPN: "0x500507630703d3b3",
        LUN: "0x0000000000000000"
      });

      expect(handler).toHaveBeenCalledWith({
        id: "1",
        name: "/dev/sda",
        channel: "0.0.fa00",
        wwpn: "0x500507630703d3b3",
        lun: "0x0000000000000000"
      });
    });
  });
});

describe("#iscsi", () => {
  beforeEach(() => {
    client = new StorageClient();
  });

  describe("#getInitiatorName", () => {
    beforeEach(() => {
      cockpitProxies.iscsiInitiator = {
        InitiatorName: "iqn.1996-04.com.suse:01:351e6d6249"
      };
    });

    it("returns the current initiator name", async () => {
      const initiatorName = await client.iscsi.getInitiatorName();
      expect(initiatorName).toEqual("iqn.1996-04.com.suse:01:351e6d6249");
    });
  });

  describe("#setInitiatorName", () => {
    beforeEach(() => {
      cockpitProxies.iscsiInitiator = {
        InitiatorName: "iqn.1996-04.com.suse:01:351e6d6249"
      };
    });

    it("sets the given initiator name", async () => {
      await client.iscsi.setInitiatorName("test");
      const initiatorName = await client.iscsi.getInitiatorName();
      expect(initiatorName).toEqual("test");
    });
  });

  describe("#getNodes", () => {
    describe("if there is no exported iSCSI nodes yet", () => {
      beforeEach(() => {
        contexts.withoutISCSINodes();
      });

      it("returns an empty list", async () => {
        const result = await client.iscsi.getNodes();
        expect(result).toStrictEqual([]);
      });
    });

    describe("if there are exported iSCSI nodes", () => {
      beforeEach(() => {
        contexts.withISCSINodes();
      });

      it("returns a list with the exported iSCSI nodes", async () => {
        const result = await client.iscsi.getNodes();
        expect(result.length).toEqual(2);
        expect(result).toContainEqual({
          id: "1",
          target: "iqn.2023-01.com.example:37dac",
          address: "192.168.100.101",
          port:  3260,
          interface: "default",
          ibft: false,
          connected: false,
          startup: ""
        });
        expect(result).toContainEqual({
          id: "2",
          target: "iqn.2023-01.com.example:74afb",
          address: "192.168.100.102",
          port:  3260,
          interface: "default",
          ibft: true,
          connected: true,
          startup: "onboot"
        });
      });
    });
  });

  describe("#discover", () => {
    beforeEach(() => {
      cockpitProxies.iscsiInitiator = {
        Discover: jest.fn()
      };
    });

    it("performs an iSCSI discovery with the given options", async () => {
      await client.iscsi.discover("192.168.100.101", 3260, {
        username: "test",
        password: "12345",
        reverseUsername: "target",
        reversePassword: "nonsecret"
      });

      expect(cockpitProxies.iscsiInitiator.Discover).toHaveBeenCalledWith("192.168.100.101", 3260, {
        Username: { t: "s", v: "test" },
        Password: { t: "s", v: "12345" },
        ReverseUsername: { t: "s", v: "target" },
        ReversePassword: { t: "s", v: "nonsecret" }
      });
    });
  });

  describe("#Delete", () => {
    beforeEach(() => {
      cockpitProxies.iscsiInitiator = {
        Delete: jest.fn()
      };
    });

    it("deletes the given iSCSI node", async () => {
      await client.iscsi.delete({ id: "1" });
      expect(cockpitProxies.iscsiInitiator.Delete).toHaveBeenCalledWith(
        "/org/opensuse/Agama/Storage1/iscsi_nodes/1"
      );
    });
  });

  describe("#login", () => {
    const nodeProxy = {
      Login: jest.fn()
    };

    beforeEach(() => {
      cockpitProxies.iscsiNode = {
        "/org/opensuse/Agama/Storage1/iscsi_nodes/1": nodeProxy
      };
    });

    it("performs an iSCSI login with the given options", async () => {
      await client.iscsi.login({ id: "1" }, {
        username: "test",
        password: "12345",
        reverseUsername: "target",
        reversePassword: "nonsecret",
        startup: "automatic"
      });

      expect(nodeProxy.Login).toHaveBeenCalledWith({
        Username: { t: "s", v: "test" },
        Password: { t: "s", v: "12345" },
        ReverseUsername: { t: "s", v: "target" },
        ReversePassword: { t: "s", v: "nonsecret" },
        Startup: { t: "s", v: "automatic" }
      });
    });
  });

  describe("#logout", () => {
    const nodeProxy = {
      Logout: jest.fn()
    };

    beforeEach(() => {
      cockpitProxies.iscsiNode = {
        "/org/opensuse/Agama/Storage1/iscsi_nodes/1": nodeProxy
      };
    });

    it("performs an iSCSI logout of the given node", async () => {
      await client.iscsi.logout({ id: "1" });
      expect(nodeProxy.Logout).toHaveBeenCalled();
    });
  });
});
