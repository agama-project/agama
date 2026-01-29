/*
 * Copyright (c) [2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

import React from "react";
import { render, screen, within } from "@testing-library/react";
import ProposalResultTable from "~/components/storage/ProposalResultTable";
import DevicesManager from "~/model/storage/devices-manager";
import type { Storage as System } from "~/model/system";
import type { Storage as Proposal } from "~/model/proposal";

const systemDevices: System.Device[] = [
  {
    sid: 70,
    name: "/dev/vdc",
    description: "Disk",
    class: "drive",
    block: {
      active: true,
      encrypted: false,
      start: 0,
      size: 32212254720,
      shrinking: {
        supported: false,
        reasons: ["Resizing is not supported"],
      },
      systems: [],
    },
    partitionTable: {
      type: "gpt",
      unusedSlots: [
        {
          start: 27265024,
          size: 18252545536,
        },
      ],
    },
    partitions: [
      {
        sid: 78,
        name: "/dev/vdc1",
        class: "partition",
        block: {
          active: true,
          encrypted: false,
          start: 2048,
          size: 5368709120,
          shrinking: {
            supported: false,
            reasons: ["Resizing is not supported"],
          },
          systems: [],
        },
      },
      {
        sid: 79,
        name: "/dev/vdc2",
        class: "partition",
        block: {
          active: true,
          encrypted: false,
          start: 10487808,
          size: 5368709120,
          shrinking: {
            supported: false,
            reasons: ["Resizing is not supported"],
          },
          systems: ["openSUSE Leap 15.2", "Fedora 10.30"],
        },
      },
      {
        sid: 80,
        name: "/dev/vdc3",
        description: "XFS Partition",
        class: "partition",
        block: {
          active: true,
          encrypted: false,
          start: 20973568,
          size: 1073741824,
          shrinking: {
            supported: false,
            reasons: ["Resizing is not supported"],
          },
          systems: [],
        },
        filesystem: {
          sid: 92,
          type: "xfs",
        },
      },
      {
        sid: 81,
        name: "/dev/vdc4",
        description: "Linux",
        class: "partition",
        block: {
          active: true,
          encrypted: false,
          start: 23070720,
          size: 2147483648,
          shrinking: {
            supported: true,
            minSize: 2147483136,
          },
          systems: [],
        },
      },
    ],
  },
];

const proposalDevices: Proposal.Device[] = [
  {
    sid: 70,
    name: "/dev/vdc",
    description: "Disk",
    class: "drive",
    block: {
      active: true,
      encrypted: false,
      start: 0,
      size: 32212254720,
      shrinking: {
        supported: false,
        reasons: ["Resizing is not supported"],
      },
      systems: [],
    },
    partitionTable: {
      type: "gpt",
      unusedSlots: [
        {
          start: 3164160,
          size: 3749707776,
        },
        {
          start: 20973568,
          size: 1073741824,
        },
      ],
    },
    partitions: [
      {
        sid: 79,
        name: "/dev/vdc2",
        description: "Linux RAID",
        class: "partition",
        block: {
          active: true,
          encrypted: false,
          start: 10487808,
          size: 5368709120,
          shrinking: {
            supported: false,
            reasons: ["Resizing is not supported"],
          },
          systems: ["openSUSE Leap 15.2", "Fedora 10.30"],
        },
      },
      {
        sid: 81,
        name: "/dev/vdc4",
        description: "Linux",
        class: "partition",
        block: {
          active: true,
          encrypted: false,
          start: 23070720,
          size: 1608515584,
          shrinking: {
            supported: true,
            minSize: 2147483136,
          },
          systems: [],
        },
      },
      {
        sid: 459,
        name: "/dev/vdc1",
        description: "BIOS Boot Partition",
        class: "partition",
        block: {
          active: true,
          encrypted: false,
          start: 2048,
          size: 8388608,
          shrinking: {
            supported: false,
            reasons: ["Resizing is not supported"],
          },
          systems: [],
        },
      },
      {
        sid: 460,
        name: "/dev/vdc3",
        description: "Swap Partition",
        class: "partition",
        block: {
          active: true,
          encrypted: false,
          start: 18432,
          size: 1610612736,
          shrinking: {
            supported: false,
            reasons: ["Resizing is not supported"],
          },
          systems: [],
        },
        filesystem: {
          sid: 461,
          type: "swap",
          mountPath: "swap",
        },
      },
      {
        sid: 463,
        name: "/dev/vdc5",
        description: "Btrfs Partition",
        class: "partition",
        block: {
          active: true,
          encrypted: false,
          start: 26212352,
          size: 18791513600,
          shrinking: {
            supported: false,
            reasons: ["Resizing is not supported"],
          },
          systems: [],
        },
        filesystem: {
          sid: 464,
          type: "btrfs",
          mountPath: "/",
        },
      },
    ],
  },
];

const actions: Proposal.Action[] = [
  {
    device: 80,
    text: "Delete partition /dev/vdc3 (1.00 GiB)",
    subvol: false,
    delete: true,
    resize: false,
  },
  {
    device: 78,
    text: "Delete partition /dev/vdc1 (5.00 GiB)",
    subvol: false,
    delete: true,
    resize: false,
  },
  {
    device: 81,
    text: "Shrink partition /dev/vdc4 from 2.00 GiB to 1.50 GiB",
    subvol: false,
    delete: false,
    resize: true,
  },
  {
    device: 459,
    text: "Create partition /dev/vdc1 (8.00 MiB) as BIOS Boot Partition",
    subvol: false,
    delete: false,
    resize: false,
  },
  {
    device: 460,
    text: "Create partition /dev/vdc3 (1.50 GiB) for swap",
    subvol: false,
    delete: false,
    resize: false,
  },
  {
    device: 463,
    text: "Create partition /dev/vdc5 (17.50 GiB) for / with btrfs",
    subvol: false,
    delete: false,
    resize: false,
  },
];

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => {},
}));

type Device = System.Device | Proposal.Device;

function flatDevices(devices: Device[]): Device[] {
  const partitions = devices.flatMap((d) => d.partitions);
  return [devices, partitions].flat();
}

describe("ProposalResultTable", () => {
  it("renders the relevant information about final result", async () => {
    const devicesManager = new DevicesManager(
      flatDevices(systemDevices),
      flatDevices(proposalDevices),
      actions,
    );
    render(<ProposalResultTable devicesManager={devicesManager} />);
    const treegrid = screen.getByRole("treegrid");
    /**
     * Expected rows for full-result-example
     * --------------------------------------------------
     * "/dev/vdc Disk GPT 30 GiB"
     * "vdc1 BIOS Boot Partition 8 MiB"
     * "vdc3 swap Swap Partition 1.5 GiB"
     * "Unused space 3.49 GiB"
     * "vdc2 openSUSE Leap 15.2, Fedora 10.30 5 GiB"
     * "Unused space 1 GiB"
     * "vdc4 Linux Before 2 GiB 1.5 GiB"
     * "vdc5 / New Btrfs Partition 17.5 GiB"
     *
     * Device      Mount point      Details                                 Size
     * -------------------------------------------------------------------------
     * /dev/vdc                     Disk GPT                              30 GiB
     *     vdc1                     BIOS Boot Partition                    8 MiB
     *     vdc3    swap             Swap Partition                       1.5 GiB
     *                              Unused space                        3.49 GiB
     *     vdc2                     openSUSE Leap 15.2, Fedora 10.30       5 GiB
     *                              Unused space                           1 GiB
     *     vdc4                     Linux                                1.5 GiB
     *     vdc5    /                Btrfs Partition                     17.5 GiB
     * -------------------------------------------------------------------------
     */
    within(treegrid).getByRole("row", { name: "/dev/vdc Disk GPT 30 GiB" });
    within(treegrid).getByRole("row", { name: "vdc1 BIOS Boot Partition New 8 MiB" });
    within(treegrid).getByRole("row", { name: "vdc3 swap Swap Partition New 1.5 GiB" });
    within(treegrid).getByRole("row", { name: "Unused space 3.49 GiB" });
    within(treegrid).getByRole("row", { name: "vdc2 openSUSE Leap 15.2, Fedora 10.30 5 GiB" });
    within(treegrid).getByRole("row", { name: "Unused space 1 GiB" });
    within(treegrid).getByRole("row", { name: "vdc4 Linux 1.5 GiB Before 2 GiB" });
    within(treegrid).getByRole("row", { name: "vdc5 / Btrfs Partition New 17.5 GiB" });
  });
});
