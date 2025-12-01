/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React from "react";
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import SpaceActionsTable, { SpaceActionsTableProps } from "~/components/storage/SpaceActionsTable";
import type { Device, UnusedSlot } from "~/api/proposal/storage";

const gib = (n: number) => n * 1024 * 1024 * 1024;

const sda1: Device = {
  name: "/dev/sda1",
  description: "Swap partition",
  block: {
    size: gib(2),
    shrinking: {
      reasons: ["Resizing is not supported"],
    },
  },
};

const sda2: Device = {
  name: "/dev/sda2",
  description: "EXT4 partition",
  block: {
    size: gib(6),
    shrinking: {
      minSize: gib(3),
    },
  },
};

const unusedSlot: UnusedSlot = {
  size: gib(2),
};

const devices: (Device | UnusedSlot)[] = [sda1, sda2, unusedSlot];

const mockStorageModel = {
  drives: [
    {
      name: "/dev/sda",
      partitions: [],
    },
  ],
  volumeGroups: [],
};

const mockUseStorageModelFn = jest.fn();
jest.mock("~/hooks/api/storage", () => ({
  useStorageModel: () => mockUseStorageModelFn(),
}));

/**
 * Function to ask for the action of a device.
 *
 * @param {Device | UnusedSlot} device
 * @returns {string}
 */
const deviceAction = (device: Device | UnusedSlot) => {
  if ("name" in device && device.name === "/dev/sda1") return "keep";

  return "delete";
};

let props: SpaceActionsTableProps;

describe("SpaceActionsTable", () => {
  beforeEach(() => {
    props = {
      devices,
      deviceAction,
      onActionChange: jest.fn(),
    };

    mockUseStorageModelFn.mockReturnValue(mockStorageModel);
  });

  it("shows the devices to configure the space actions", () => {
    plainRender(<SpaceActionsTable {...props} />);

    screen.getByRole("row", {
      name: "sda1 Swap partition 2 GiB Do not modify Allow shrink Delete",
    });
    screen.getByRole("row", {
      name: "sda2 EXT4 partition 6 GiB Do not modify Allow shrink Delete",
    });
    screen.getByRole("row", { name: "Unused space 2 GiB" });
  });

  it("selects the action for each device", () => {
    plainRender(<SpaceActionsTable {...props} />);

    const sda1Row = screen.getByRole("row", { name: /sda1/ });
    within(sda1Row).getByRole("button", { name: "Do not modify", pressed: true });
    within(sda1Row).getByRole("button", { name: "Allow shrink", pressed: false });
    within(sda1Row).getByRole("button", { name: "Delete", pressed: false });

    const sda2Row = screen.getByRole("row", { name: /sda2/ });
    within(sda2Row).getByRole("button", { name: "Do not modify", pressed: false });
    within(sda2Row).getByRole("button", { name: "Allow shrink", pressed: false });
    within(sda2Row).getByRole("button", { name: "Delete", pressed: true });
  });

  it("disables shrink action if it is not supported", () => {
    plainRender(<SpaceActionsTable {...props} />);

    const sda1Row = screen.getByRole("row", { name: /sda1/ });
    const sda1ShrinkButton = within(sda1Row).getByRole("button", { name: "Allow shrink" });
    expect(sda1ShrinkButton).toBeDisabled();

    const sda2Row = screen.getByRole("row", { name: /sda2/ });
    const sda2ShrinkButton = within(sda2Row).getByRole("button", { name: "Allow shrink" });
    expect(sda2ShrinkButton).not.toBeDisabled();
  });

  describe("if a partition is going to be used", () => {
    beforeEach(() => {
      mockUseStorageModelFn.mockReturnValue({
        drives: [
          {
            name: "/dev/sda",
            partitions: [
              {
                name: "/dev/sda2",
                mountPath: "swap",
                filesystem: { type: "swap" },
              },
            ],
          },
        ],
        volumeGroups: [],
      });
    });

    it("disables shrink and delete actions for the partition", () => {
      plainRender(<SpaceActionsTable {...props} />);

      const sda2Row = screen.getByRole("row", { name: /sda2/ });
      const sda2ShrinkButton = within(sda2Row).getByRole("button", { name: "Allow shrink" });
      const sda2DeleteButton = within(sda2Row).getByRole("button", { name: "Delete" });
      expect(sda2ShrinkButton).toBeDisabled();
      expect(sda2DeleteButton).toBeDisabled();
    });
  });

  it("allows to change the action", async () => {
    const { user } = plainRender(<SpaceActionsTable {...props} />);

    const sda1Row = screen.getByRole("row", { name: /sda1/ });
    const sda1DeleteButton = within(sda1Row).getByRole("button", { name: "Delete" });
    await user.click(sda1DeleteButton);

    expect(props.onActionChange).toHaveBeenCalledWith({
      deviceName: "/dev/sda1",
      value: "delete",
    });
  });

  it("allows to show information about the device", async () => {
    const { user } = plainRender(<SpaceActionsTable {...props} />);

    const sda1Row = screen.getByRole("row", { name: /sda1/ });
    const sda1InfoButton = within(sda1Row).getByRole("button", {
      name: /information about .*sda1/,
    });
    await user.click(sda1InfoButton);
    const sda1Popup = screen.getByRole("dialog");
    within(sda1Popup).getByText(/Resizing is not supported/);

    const sda2Row = screen.getByRole("row", { name: /sda2/ });
    const sda2InfoButton = within(sda2Row).getByRole("button", {
      name: /information about .*sda2/,
    });
    await user.click(sda2InfoButton);
    const sda2Popup = await screen.findByRole("dialog");
    within(sda2Popup).getByText(/Up to 3 GiB/);
  });
});
