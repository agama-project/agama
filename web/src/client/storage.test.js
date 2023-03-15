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
// cspell:ignore onboot

import DBusClient from "./dbus";
import { StorageClient } from "./storage";

jest.mock("./dbus");

const cockpitProxies = {};

const contexts = {
  withoutProposal: () => {
    cockpitProxies.proposal = null;
  },
  withProposal: () => {
    cockpitProxies.proposal = {
      CandidateDevices:["/dev/sda"],
      LVM: true,
      Volumes: [
        {
          MountPoint: { t: "s", v: "/test1" },
          Optional: { t: "b", v: true },
          DeviceType: { t: "s", v: "partition" },
          Encrypted: { t: "b", v: false },
          FsTypes: { t: "as", v: [{ t: "s", v: "Btrfs" }, { t: "s", v: "Ext3" }] },
          FsType: { t: "s", v: "Btrfs" },
          MinSize: { t: "x", v: 1024 },
          MaxSize: { t: "x", v: 2048 },
          FixedSizeLimits: { t: "b", v: false },
          AdaptiveSizes: { t: "b", v: false },
          Snapshots: { t: "b", v: true },
          SnapshotsConfigurable: { t: "b", v: true },
          SnapshotsAffectSizes: { t: "b", v: false },
          SizeRelevantVolumes: { t: "as", v: [] }
        },
        {
          MountPoint: { t: "s", v: "/test2" }
        }
      ],
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
    cockpitProxies.proposalCalculator = {
      AvailableDevices: [
        ["/dev/sda", "/dev/sda, 950 GiB, Windows"],
        ["/dev/sdb", "/dev/sdb, 500 GiB"]
      ]
    };
  },
  withoutISCSINodes: () => {
    cockpitProxies.iscsiNodes = {};
  },
  withISCSINodes: () => {
    cockpitProxies.iscsiNodes = {
      "/org/opensuse/DInstaller/Storage1/iscsi_nodes/1": {
        path: "/org/opensuse/DInstaller/Storage1/iscsi_nodes/1",
        Target: "iqn.2023-01.com.example:37dac",
        Address: "192.168.100.101",
        Port: 3260,
        Interface: "default",
        IBFT: false,
        Connected: false,
        Startup: ""
      },
      "/org/opensuse/DInstaller/Storage1/iscsi_nodes/2": {
        path: "/org/opensuse/DInstaller/Storage1/iscsi_nodes/2",
        Target: "iqn.2023-01.com.example:74afb",
        Address: "192.168.100.102",
        Port: 3260,
        Interface: "default",
        IBFT: true,
        Connected: true,
        Startup: "onboot"
      }
    };
  }
};

const mockProxy = (iface, path) => {
  switch (iface) {
    case "org.opensuse.DInstaller.Storage1.Proposal": return cockpitProxies.proposal;
    case "org.opensuse.DInstaller.Storage1.Proposal.Calculator": return cockpitProxies.proposalCalculator;
    case "org.opensuse.DInstaller.Storage1.ISCSI.Initiator": return cockpitProxies.iscsiInitiator;
    case "org.opensuse.DInstaller.Storage1.ISCSI.Node": return cockpitProxies.iscsiNode[path];
  }
};

const mockProxies = (iface) => {
  switch (iface) {
    case "org.opensuse.DInstaller.Storage1.ISCSI.Node": return cockpitProxies.iscsiNodes;
  }
};

let client;

beforeEach(() => {
  // @ts-ignore
  DBusClient.mockImplementation(() => {
    return {
      proxy: mockProxy,
      proxies: mockProxies
    };
  });

  client = new StorageClient();
});

describe("#proposal", () => {
  const checkAvailableDevices = (availableDevices) => {
    expect(availableDevices).toEqual([
      { id: "/dev/sda", label: "/dev/sda, 950 GiB, Windows" },
      { id: "/dev/sdb", label: "/dev/sdb, 500 GiB" }
    ]);
  };

  const checkProposalResult = (result) => {
    expect(result.candidateDevices).toEqual(["/dev/sda"]);
    expect(result.lvm).toBeTruthy();
    expect(result.actions).toEqual([
      { text: "Mount /dev/sdb1 as root", subvol: false, delete: false }
    ]);

    expect(result.volumes[0]).toEqual({
      mountPoint: "/test1",
      optional: true,
      deviceType: "partition",
      encrypted: false,
      fsTypes: ["Btrfs", "Ext3"],
      fsType: "Btrfs",
      minSize: 1024,
      maxSize:2048,
      fixedSizeLimits: false,
      adaptiveSizes: false,
      snapshots: true,
      snapshotsConfigurable: true,
      snapshotsAffectSizes: false,
      sizeRelevantVolumes: []
    });
    expect(result.volumes[1].mountPoint).toEqual("/test2");
  };

  describe("#getData", () => {
    beforeEach(() => {
      contexts.withAvailableDevices();
      contexts.withProposal();
    });

    it("returns the available devices and the proposal result", async () => {
      const { availableDevices, result } = await client.proposal.getData();
      checkAvailableDevices(availableDevices);
      checkProposalResult(result);
    });
  });

  describe("#getAvailableDevices", () => {
    beforeEach(() => {
      contexts.withAvailableDevices();
    });

    it("returns the list of available devices", async () => {
      const availableDevices = await client.proposal.getAvailableDevices();
      checkAvailableDevices(availableDevices);
    });
  });

  describe("#getResult", () => {
    describe("if there is no proposal yet", () => {
      beforeEach(() => {
        contexts.withoutProposal();
      });

      it("returns undefined", async () => {
        const result = await client.proposal.getResult();
        expect(result).toBe(undefined);
      });
    });

    describe("if there is a proposal", () => {
      beforeEach(() => {
        contexts.withProposal();
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

describe("#iscsi", () => {
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
        "/org/opensuse/DInstaller/Storage1/iscsi_nodes/1"
      );
    });
  });

  describe("#login", () => {
    const nodeProxy = {
      Login: jest.fn()
    };

    beforeEach(() => {
      cockpitProxies.iscsiNode = {
        "/org/opensuse/DInstaller/Storage1/iscsi_nodes/1": nodeProxy
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
        "/org/opensuse/DInstaller/Storage1/iscsi_nodes/1": nodeProxy
      };
    });

    it("performs an iSCSI logout of the given node", async () => {
      await client.iscsi.logout({ id: "1" });
      expect(nodeProxy.Logout).toHaveBeenCalled();
    });
  });
});
