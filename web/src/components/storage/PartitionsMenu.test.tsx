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
import { screen, within } from "@testing-library/react";
import { plainRender, mockNavigateFn } from "~/test-utils";
import PartitionsMenu from "~/components/storage/PartitionsMenu";
import { Drive } from "~/types/storage/model";

const drive1Partitions = [
  {
    mountPath: "/",
    size: {
      min: 1_000_000_000,
      default: true,
    },
    filesystem: { default: true, type: "btrfs" },
  },
  {
    mountPath: "swap",
    size: {
      min: 2_000_000_000,
      default: false, // false: user provided, true: calculated
    },
    filesystem: { default: false, type: "swap" },
  },
];

const drive1: Drive = {
  name: "/dev/sda",
  list: "drives",
  listIndex: 0,
  spacePolicy: "delete",
  partitions: drive1Partitions,
  getPartition: (path) => drive1Partitions.find((p) => p.mountPath === path),
};

const drive2Partitions = [
  {
    mountPath: "/home",
    size: {
      min: 1_000_000_000,
      default: true,
    },
    filesystem: { default: true, type: "xfs" },
  },
];

const drive2: Drive = {
  name: "/dev/sdb",
  list: "drives",
  listIndex: 1,
  spacePolicy: "delete",
  partitions: drive2Partitions,
  getPartition: (path) => drive2Partitions.find((p) => p.mountPath === path),
};

const mockDeletePartition = jest.fn();

jest.mock("~/hooks/storage/partition", () => ({
  ...jest.requireActual("~/hooks/storage/partition"),
  useDeletePartition: () => mockDeletePartition,
}));

describe("PartitionMenuItem", () => {
  it("allows users to delete a not required partition", async () => {
    const { user } = plainRender(<PartitionsMenu device={drive1} />);

    const partitionsButton = screen.getByRole("button", { name: "Partitions" });
    await user.click(partitionsButton);
    const partitionsMenu = screen.getByRole("menu");
    const deleteSwapButton = within(partitionsMenu).getByRole("menuitem", {
      name: "Delete swap",
    });
    await user.click(deleteSwapButton);
    expect(mockDeletePartition).toHaveBeenCalled();
  });

  it("allows users to delete a required partition", async () => {
    const { user } = plainRender(<PartitionsMenu device={drive1} />);

    const partitionsButton = screen.getByRole("button", { name: "Partitions" });
    await user.click(partitionsButton);
    const partitionsMenu = screen.getByRole("menu");
    const deleteRootButton = within(partitionsMenu).getByRole("menuitem", {
      name: "Delete /",
    });
    await user.click(deleteRootButton);
    expect(mockDeletePartition).toHaveBeenCalled();
  });

  it("allows users to edit a partition", async () => {
    const { user } = plainRender(<PartitionsMenu device={drive1} />);

    const partitionsButton = screen.getByRole("button", { name: "Partitions" });
    await user.click(partitionsButton);
    const partitionsMenu = screen.getByRole("menu");
    const editSwapButton = within(partitionsMenu).getByRole("menuitem", {
      name: "Edit swap",
    });
    await user.click(editSwapButton);
    expect(mockNavigateFn).toHaveBeenCalledWith("/storage/drives/0/partitions/swap/edit");
  });
});
