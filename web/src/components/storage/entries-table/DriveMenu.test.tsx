/*
 * Copyright (c) [2026] SUSE LLC
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
import { installerRender } from "~/test-utils";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import DriveMenu from "~/components/storage/entries-table/DriveMenu";

const mockConfig = jest.fn();
const mockDeleteDrive = jest.fn();
const mockOpenDetails = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
  useDeleteDrive: () => mockDeleteDrive,
  useDeleteMdRaid: () => jest.fn(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: () => null,
}));

jest.mock("~/components/storage/shared/use-device-details", () => ({
  ...jest.requireActual("~/components/storage/shared/use-device-details"),
  useDeviceDetails: () => ({ openDetails: mockOpenDetails }),
}));

jest.mock("~/components/storage/shared/use-retarget", () => ({
  useRetarget: () => ({ title: "Use another device", open: jest.fn(), selector: null }),
}));

/* Items with logic of their own, tested on their own. */
jest.mock("~/components/storage/entries-table/ChangeDeviceMenuItem", () => () => (
  <li>change device</li>
));
jest.mock("~/components/storage/entries-table/SpacePolicyMenuItem", () => () => (
  <li>space policy</li>
));
jest.mock("~/components/storage/NewVgMenuOption", () => () => <li>new volume group</li>);

const vda = { name: "/dev/vda", spacePolicy: "keep" } as Partitionable.Device;
const vdb = { name: "/dev/vdb", spacePolicy: "keep" } as Partitionable.Device;
const subject = { collection: "drives" as const, index: 0 };

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [vda, vdb],
  mdRaids: [],
  volumeGroups: [{ vgName: "other" }, { vgName: "more" }] as ConfigModel.VolumeGroup[],
  ...values,
});

const openMenu = async (user) => {
  await user.click(screen.getByRole("button", { name: "Actions for vda" }));
};

describe("DriveMenu", () => {
  beforeEach(() => mockConfig.mockReturnValue(config()));

  it("opens the panel of the device from its row", async () => {
    const { user } = installerRender(<DriveMenu entry={vda} subject={subject} />);
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /^Details/ }));

    expect(mockOpenDetails).toHaveBeenCalledWith(subject);
  });

  it("offers the space policy on the row, and a new volume group in the panel", async () => {
    const { user, unmount } = installerRender(<DriveMenu entry={vda} subject={subject} />);
    await openMenu(user);
    screen.getByText("space policy");
    expect(screen.queryByText("new volume group")).toBeNull();
    unmount();

    const panel = installerRender(<DriveMenu entry={vda} />);
    await openMenu(panel.user);
    screen.getByText("new volume group");
    expect(screen.queryByRole("menuitem", { name: /^Details/ })).toBeNull();
  });

  it("drops the device when there is another one to install on", async () => {
    const { user } = installerRender(<DriveMenu entry={vda} subject={subject} />);
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /Do not use/ }));

    expect(mockDeleteDrive).toHaveBeenCalledWith(0);
  });

  it("does not offer dropping the only device", async () => {
    mockConfig.mockReturnValue(config({ drives: [vda], volumeGroups: [] }));
    const { user } = installerRender(<DriveMenu entry={vda} subject={subject} />);
    await openMenu(user);

    expect(screen.queryByRole("menuitem", { name: /Do not use/ })).toBeNull();
  });

  it("keeps a refused drop focusable, with its reason", async () => {
    mockConfig.mockReturnValue(
      config({ boot: { configure: true, device: { default: false, name: "/dev/vda" } } }),
    );
    const { user } = installerRender(<DriveMenu entry={vda} subject={subject} />);
    await openMenu(user);
    const item = screen.getByRole("menuitem", { name: /Do not use/ });

    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).not.toBeDisabled();
    screen.getByText("The disk is used for booting");
    await user.click(item);
    expect(mockDeleteDrive).not.toHaveBeenCalled();
  });
});
