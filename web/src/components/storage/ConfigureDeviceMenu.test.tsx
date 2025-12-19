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
import { mockNavigateFn, installerRender } from "~/test-utils";
import type { Storage } from "~/model/proposal";
import type { ConfigModel } from "~/model/storage/config-model";
import ConfigureDeviceMenu from "./ConfigureDeviceMenu";

const vda: Storage.Device = {
  sid: 59,
  class: "drive",
  name: "/dev/vda",
  drive: { type: "disk", info: { sdCard: false, dellBoss: false } },
  block: {
    start: 1,
    size: 1e12,
    systems: ["Windows 11", "openSUSE Leap 15.2"],
    shrinking: { supported: false },
  },
};

const vdb: Storage.Device = {
  sid: 60,
  class: "drive",
  name: "/dev/vdb",
  drive: { type: "disk", info: { sdCard: false, dellBoss: false } },
  block: {
    start: 1,
    size: 1e6,
    systems: [],
    shrinking: { supported: false },
  },
};

const vdaDrive: ConfigModel.Drive = {
  name: "/dev/vda",
  spacePolicy: "delete",
  partitions: [],
};

const vdbDrive: ConfigModel.Drive = {
  name: "/dev/vdb",
  spacePolicy: "delete",
  partitions: [],
};

const mockAddDrive = jest.fn();
const mockAddReusedMdRaid = jest.fn();
const mockUseModel = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useAvailableDevices: () => [vda, vdb],
}));

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockUseModel(),
  useAddDrive: () => mockAddDrive,
  useAddMdRaid: () => mockAddReusedMdRaid,
}));

describe("ConfigureDeviceMenu", () => {
  beforeEach(() => {
    mockUseModel.mockReturnValue({ drives: [], mdRaids: [] });
  });

  it("renders an initially closed menu ", async () => {
    const { user } = installerRender(<ConfigureDeviceMenu />);
    const toggler = screen.getByRole("button", { name: "More devices", expanded: false });
    expect(screen.queryAllByRole("menu").length).toBe(0);
    await user.click(toggler);
    expect(toggler).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryAllByRole("menu").length).not.toBe(0);
  });

  it("allows users to add a new LVM volume group", async () => {
    const { user } = installerRender(<ConfigureDeviceMenu />);
    const toggler = screen.getByRole("button", { name: "More devices", expanded: false });
    await user.click(toggler);
    const lvmMenuItem = screen.getByRole("menuitem", { name: /LVM/ });
    await user.click(lvmMenuItem);
    expect(mockNavigateFn).toHaveBeenCalledWith("/storage/volume-groups/add");
  });

  describe("when there are unused disks", () => {
    describe("and no disks have been configured yet", () => {
      it("allows users to add a new drive", async () => {
        const { user } = installerRender(<ConfigureDeviceMenu />);
        const toggler = screen.getByRole("button", { name: /More devices/ });
        await user.click(toggler);
        const disksMenuItem = screen.getByRole("menuitem", { name: "Add device menu" });
        await user.click(disksMenuItem);
        const dialog = screen.getByRole("dialog", { name: /Select a disk/ });
        const confirmButton = screen.getByRole("button", { name: "Confirm" });
        const vdaItemRow = within(dialog).getByRole("row", { name: /\/dev\/vda/ });
        const vdaItemRadio = within(vdaItemRow).getByRole("radio");
        await user.click(vdaItemRadio);
        await user.click(confirmButton);
        expect(mockAddDrive).toHaveBeenCalledWith({ name: "/dev/vda", spacePolicy: "keep" });
      });
    });

    describe("but some disks are already configured", () => {
      beforeEach(() => {
        mockUseModel.mockReturnValue({ drives: [vdaDrive], mdRaids: [] });
      });

      it("allows users to add a new drive to an unused disk", async () => {
        const { user } = installerRender(<ConfigureDeviceMenu />);
        const toggler = screen.getByRole("button", { name: /More devices/ });
        await user.click(toggler);
        const disksMenuItem = screen.getByRole("menuitem", { name: "Add device menu" });
        await user.click(disksMenuItem);
        const dialog = screen.getByRole("dialog", { name: /Select another disk/ });
        const confirmButton = screen.getByRole("button", { name: "Confirm" });
        expect(screen.queryByRole("row", { name: /vda$/ })).toBeNull();
        const vdaItemRow = within(dialog).getByRole("row", { name: /\/dev\/vdb/ });
        const vdaItemRadio = within(vdaItemRow).getByRole("radio");
        await user.click(vdaItemRadio);
        await user.click(confirmButton);
        expect(mockAddDrive).toHaveBeenCalledWith({ name: "/dev/vdb", spacePolicy: "keep" });
      });
    });
  });

  describe("when there are no more unused disks", () => {
    beforeEach(() => {
      mockUseModel.mockReturnValue({ drives: [vdaDrive, vdbDrive], mdRaids: [] });
    });

    it("renders the disks menu as disabled with an informative label", async () => {
      const { user } = installerRender(<ConfigureDeviceMenu />);
      const toggler = screen.getByRole("button", { name: /More devices/ });
      await user.click(toggler);
      const disksMenuItem = screen.getByRole("menuitem", { name: "Add device menu" });
      expect(disksMenuItem).toBeDisabled();
    });
  });
});
