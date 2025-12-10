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
import { installerRender } from "~/test-utils";
import SearchedDeviceMenu from "./SearchedDeviceMenu";
import { model } from "~/storage";
import type { storage as system } from "~/api/system";

const mockDeleteFn = jest.fn();
const mockSwitchToDrive = jest.fn();

const mockSda: system.Device = {
  sid: 1,
  class: "drive",
  name: "/dev/sda",
  block: { size: 1000, start: 0, shrinking: { supported: false } },
};

const mockSdb: system.Device = {
  sid: 2,
  class: "drive",
  name: "/dev/sdb",
  block: { size: 2000, start: 0, shrinking: { supported: false } },
};

const mockSdc: system.Device = {
  sid: 3,
  class: "drive",
  name: "/dev/sdc",
  block: { size: 3000, start: 0, shrinking: { supported: false } },
};

const mockBaseDrive: model.Drive = {
  name: "/dev/sda",
  isUsed: true,
  isBoot: false,
  isExplicitBoot: false,
  isTargetDevice: false,
  isReusingPartitions: false,
  partitions: [],
  getMountPaths: () => [],
  getVolumeGroups: () => [],
  filesystem: undefined,
  isAddingPartitions: false,
  getConfiguredExistingPartitions: () => [],
  getPartition: () => undefined,
};

jest.mock("~/hooks/storage/drive", () => ({
  useSwitchToDrive: () => mockSwitchToDrive,
}));

jest.mock("~/hooks/storage/md-raid", () => ({
  useSwitchToMdRaid: () => jest.fn(),
}));

jest.mock("./DeviceSelectorModal", () => ({
  __esModule: true,
  default: ({ onConfirm, onCancel, title, description }) => (
    <div data-testid="device-selector-modal">
      <h1>{title}</h1>
      <p>{description}</p>
      <button onClick={() => onConfirm([mockSdb])}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

jest.mock("./NewVgMenuOption", () => ({
  __esModule: true,
  default: () => <div data-testid="new-vg-option">New VG Option</div>,
}));

const mockUseModel = jest.fn();
jest.mock("~/hooks/storage/model", () => ({
  useModel: () => mockUseModel(),
}));

const mockUseAvailableDevices = jest.fn();
jest.mock("~/hooks/api/system/storage", () => ({
  useAvailableDevices: () => mockUseAvailableDevices(),
}));

const renderMenu = (modelDevice: model.Drive) => {
  const { user } = installerRender(
    <SearchedDeviceMenu
      selected={mockSda}
      modelDevice={modelDevice}
      deleteFn={mockDeleteFn}
      toggle={<button>Toggle Menu</button>}
    />,
  );
  return { user };
};

describe("SearchedDeviceMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAvailableDevices.mockReturnValue([mockSda, mockSdb, mockSdc]);
    mockUseModel.mockReturnValue({
      drives: [mockBaseDrive, { ...mockBaseDrive, name: "/dev/sdb" }],
      mdRaids: [],
    });
  });

  it("renders the menu with options", async () => {
    const { user } = renderMenu(mockBaseDrive);

    await user.click(screen.getByRole("button", { name: "Toggle Menu" }));

    expect(screen.getByRole("menuitem", { name: /Change the disk to configure/ })).toBeVisible();
    expect(screen.getByTestId("new-vg-option")).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /Do not use/ })).toBeVisible();
  });

  describe("ChangeDeviceMenuItem", () => {
    it("opens the device selector modal on click", async () => {
      const { user } = renderMenu(mockBaseDrive);

      await user.click(screen.getByRole("button", { name: "Toggle Menu" }));
      await user.click(screen.getByRole("menuitem", { name: /Change the disk to configure/ }));

      expect(screen.getByTestId("device-selector-modal")).toBeVisible();
    });

    it("calls switchToDrive when a new device is confirmed", async () => {
      const { user } = renderMenu(mockBaseDrive);

      await user.click(screen.getByRole("button", { name: "Toggle Menu" }));
      await user.click(screen.getByRole("menuitem", { name: /Change the disk to configure/ }));

      await user.click(screen.getByRole("button", { name: "Confirm" }));

      expect(mockSwitchToDrive).toHaveBeenCalledWith("/dev/sda", { name: "/dev/sdb" });
      expect(screen.queryByTestId("device-selector-modal")).not.toBeInTheDocument();
    });

    it("is disabled when there is only one option", async () => {
      const { user } = renderMenu({ ...mockBaseDrive, isReusingPartitions: true });

      await user.click(screen.getByRole("button", { name: "Toggle Menu" }));

      const changeDeviceItem = screen.getByRole("menuitem", {
        name: /Selected disk cannot be changed/,
      });
      expect(changeDeviceItem).toBeDisabled();
      const description = within(changeDeviceItem).getByText(
        "This uses existing partitions at the disk",
      );
      expect(description).toBeInTheDocument();
    });

    it("shows correct title when installing the system", async () => {
      const { user } = renderMenu({
        ...mockBaseDrive,
        getMountPaths: () => ["/"],
        partitions: [{ mountPath: "/", isNew: true }],
      } as unknown as model.Drive);

      await user.click(screen.getByRole("button", { name: "Toggle Menu" }));

      expect(
        screen.getByRole("menuitem", { name: /Change the disk to install the system/ }),
      ).toBeVisible();
    });
  });

  describe("RemoveEntryOption", () => {
    it("calls deleteFn on click", async () => {
      const { user } = renderMenu(mockBaseDrive);

      await user.click(screen.getByRole("button", { name: "Toggle Menu" }));
      await user.click(screen.getByRole("menuitem", { name: /Do not use/ }));

      expect(mockDeleteFn).toHaveBeenCalledWith(mockBaseDrive);
    });

    it("is disabled when device is used for LVM", async () => {
      const { user } = renderMenu({ ...mockBaseDrive, isTargetDevice: true });

      await user.click(screen.getByRole("button", { name: "Toggle Menu" }));

      expect(screen.queryByRole("menuitem", { name: /Do not use/ })).not.toBeInTheDocument();
    });

    it("is disabled when device is used for boot", async () => {
      const { user } = renderMenu({ ...mockBaseDrive, isExplicitBoot: true });

      await user.click(screen.getByRole("button", { name: "Toggle Menu" }));

      expect(screen.queryByRole("menuitem", { name: /Do not use/ })).not.toBeInTheDocument();
    });

    it("is not rendered when device is used for LVM and boot", async () => {
      const { user } = renderMenu({
        ...mockBaseDrive,
        isTargetDevice: true,
        isExplicitBoot: true,
      });

      await user.click(screen.getByRole("button", { name: "Toggle Menu" }));

      expect(screen.queryByRole("menuitem", { name: /Do not use/ })).not.toBeInTheDocument();
    });

    it("is not rendered if there are not enough additional drives", async () => {
      mockUseModel.mockReturnValue({
        drives: [mockBaseDrive],
        mdRaids: [],
      });
      const { user } = renderMenu(mockBaseDrive);

      await user.click(screen.getByRole("button", { name: "Toggle Menu" }));

      expect(screen.queryByRole("menuitem", { name: /Do not use/ })).not.toBeInTheDocument();
    });
  });
});
