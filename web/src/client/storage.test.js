/*
 * Copyright (c) [2022] SUSE LLC
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

import { DBusClient } from "./dbus";
import { StorageClient } from "./storage";

// NOTE: should we export them?
const STORAGE_PROPOSAL_IFACE = "org.opensuse.DInstaller.Storage.Proposal1";

const calculateFn = jest.fn();

const dbusClient = new DBusClient("");
const storageProposalProxy = {
  wait: jest.fn(),
  AvailableDevices: [
    ["/dev/sda", "/dev/sda, 950 GiB, Windows"],
    ["/dev/sdb", "/dev/sdb, 500 GiB"]
  ],
  CandidateDevices: ["/dev/sda"],
  LVM: true,
  Volumes: [
    {
      MountPoint: { t: "s", v: "/test1" },
      Optional: { t: "b", v: true },
      DeviceType: { t: "s", v: "partition" },
      Encrypted: { t: "b", v: false },
      FsTypes: { t: "as", v: [{ t: "s" , v: "Btrfs"} , { t: "s", v: "Ext3"}] },
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
  ],
  Calculate: calculateFn
};

beforeEach(() => {
  dbusClient.proxy = jest.fn().mockImplementation(iface => {
    if (iface === STORAGE_PROPOSAL_IFACE) return storageProposalProxy;
  });
});

describe("#getProposal", () => {
  it("returns the storage proposal settings and actions", async () => {
    const client = new StorageClient(dbusClient);
    const proposal = await client.getProposal();
    expect(proposal.availableDevices).toEqual([
      { id: "/dev/sda", label: "/dev/sda, 950 GiB, Windows" },
      { id: "/dev/sdb", label: "/dev/sdb, 500 GiB" }
    ]);
    expect(proposal.candidateDevices).toEqual(["/dev/sda"]);
    expect(proposal.lvm).toBeTruthy();
    expect(proposal.actions).toEqual([
      { text: "Mount /dev/sdb1 as root", subvol: false, delete: false }
    ]);

    expect(proposal.volumes[0]).toEqual({
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
    expect(proposal.volumes[1].mountPoint).toEqual("/test2");
  });
});

describe("#calculate", () => {
  it("calculates a default proposal when no settings are given", async () => {
    const client = new StorageClient(dbusClient);
    await client.calculateProposal({});

    expect(calculateFn).toHaveBeenCalledWith({});
  });

  it("calculates a proposal with the given settings", async () => {
    const client = new StorageClient(dbusClient);
    await client.calculateProposal({
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

    expect(calculateFn).toHaveBeenCalledWith({
      CandidateDevices: { t: "as", v: ["/dev/vda"] },
      EncryptionPassword: { t: "s", v: "12345" },
      LVM: { t: "b", v: true },
      Volumes: { t: "aa{sv}", v: [
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
          MountPoint: { t: "s", v: "/test2"  },
          MinSize: { t: "x", v: 1024 }
        }
      ]}
    });
  });
});
