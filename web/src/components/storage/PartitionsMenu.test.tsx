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
import { apiModel } from "~/api/storage/types";
import { model } from "~/types/storage";

const partition1: apiModel.Partition = {
  mountPath: "/",
  size: {
    min: 1_000_000_000,
    default: true,
  },
  filesystem: { default: true, type: "btrfs" },
};

const partition2: apiModel.Partition = {
  mountPath: "swap",
  size: {
    min: 2_000_000_000,
    default: false, // false: user provided, true: calculated
  },
  filesystem: { default: false, type: "swap" },
};

const drive1Partitions: apiModel.Partition[] = [partition1, partition2];

const drive1PartitionsModel: model.Partition[] = [
  {
    ...partition1,
    isNew: true,
    isUsed: false,
    isReused: false,
    isUsedBySpacePolicy: false,
  },
  {
    ...partition2,
    isNew: true,
    isUsed: false,
    isReused: false,
    isUsedBySpacePolicy: false,
  },
];

const drive1: model.Drive = {
  name: "/dev/sda",
  spacePolicy: "delete",
  partitions: drive1PartitionsModel,
  list: "drives",
  listIndex: 0,
  isExplicitBoot: false,
  isUsed: true,
  isAddingPartitions: true,
  isReusingPartitions: true,
  isTargetDevice: false,
  isBoot: true,
  getVolumeGroups: () => [],
  getPartition: (path) => drive1PartitionsModel.find((p) => p.mountPath === path),
  getMountPaths: () => drive1Partitions.map((p) => p.mountPath),
  getConfiguredExistingPartitions: jest.fn(),
};

const mockDeletePartition = jest.fn();

jest.mock("~/hooks/storage/partition", () => ({
  ...jest.requireActual("~/hooks/storage/partition"),
  useDeletePartition: () => mockDeletePartition,
}));

// FIXME: enable it back once wording is adapted in both, the component and the
// test.
xdescribe("PartitionMenuItem", () => {
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
