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
    { MountPoint: { t: "s", v: "/test1" } },
    { MountPoint: { t: "s", v: "/test2" } }
  ],
  Actions: [
    {
      Text: { t: "s", v: "Mount /dev/sdb1 as root" },
      Subvol: { t: "b", v: false },
      Delete: { t: "b", v: false }
    }
  ]
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

    expect(proposal.volumes[0].mountPoint).toEqual("/test1");
    expect(proposal.volumes[1].mountPoint).toEqual("/test2");
  });
});
