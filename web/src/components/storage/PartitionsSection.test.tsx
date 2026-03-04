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
import { screen } from "@testing-library/react";
import { installerRender, mockNavigateFn } from "~/test-utils";
import PartitionsSection from "~/components/storage/PartitionsSection";
import type { ConfigModel } from "~/model/storage/config-model";

const drive: ConfigModel.Drive = {
  name: "/dev/sda",
  spacePolicy: "delete",
  partitions: [
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
        default: false,
      },
      filesystem: { default: false, type: "swap" },
    },
  ],
};

const mockDeletePartition = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  usePartitionable: () => drive,
  useDeletePartition: () => mockDeletePartition,
}));

async function openMenu(path: string) {
  const { user } = installerRender(<PartitionsSection collection="drives" index={0} />);

  const detailsButton = screen.getByRole("button", { name: /New partitions/ });
  await user.click(detailsButton);
  const partitionMenu = screen.getByRole("button", { name: `Options for partition ${path}` });
  await user.click(partitionMenu);

  return { user };
}

describe("PartitionMenuItem", () => {
  it("allows users to delete a partition", async () => {
    const { user } = await openMenu("swap");
    const deleteSwapButton = screen.getByRole("menuitem", { name: "Delete swap" });
    await user.click(deleteSwapButton);
    expect(mockDeletePartition).toHaveBeenCalledWith("drives", 0, "swap");
  });

  it("allows users to edit a partition", async () => {
    const { user } = await openMenu("swap");
    const editSwapButton = screen.getByRole("menuitem", { name: "Edit swap" });
    await user.click(editSwapButton);
    expect(mockNavigateFn).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/storage/drives/0/partitions/swap/edit" }),
    );
  });
});
