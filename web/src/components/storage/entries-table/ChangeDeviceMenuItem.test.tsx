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
import MenuButton from "~/components/core/MenuButton";
import { _ } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";
import ChangeDeviceMenuItem from "~/components/storage/entries-table/ChangeDeviceMenuItem";

const mockConfig = jest.fn();
const mockOpen = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

const vda = (values: Partial<ConfigModel.Drive> = {}) =>
  ({ name: "/dev/vda", partitions: [], ...values }) as ConfigModel.Drive;

const renderItem = (drive: ConfigModel.Drive) =>
  installerRender(
    <MenuButton
      menuProps={{ "aria-label": _("Actions") }}
      items={[
        <ChangeDeviceMenuItem
          key="change"
          modelDevice={drive}
          device={{ name: drive.name } as Storage.Device}
          actionTitle="Choose a different device to configure"
          openFn={mockOpen}
        />,
      ]}
    >
      Actions
    </MenuButton>,
  );

const openMenu = async (user) => user.click(screen.getByRole("button", { name: "Actions" }));

describe("ChangeDeviceMenuItem", () => {
  beforeEach(() => mockConfig.mockReturnValue({ drives: [vda()], mdRaids: [], volumeGroups: [] }));

  it("opens the device selector", async () => {
    const { user } = renderItem(vda());
    await openMenu(user);
    screen.getByText("Choose a different device to configure");
    await user.click(screen.getByRole("menuitem", { name: /Change target disk/ }));

    expect(mockOpen).toHaveBeenCalled();
  });

  it("refuses for a reused file system, saying why, and stays focusable", async () => {
    const { user } = renderItem(
      vda({ mountPath: "/home", filesystem: { reuse: true, default: false } }),
    );
    await openMenu(user);
    const item = screen.getByRole("menuitem", { name: /Selected disk cannot be changed/ });

    expect(item).toHaveAttribute("aria-disabled", "true");
    screen.getByText("This uses the existing file system at the disk");
    await user.click(item);
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it("refuses for a disk only chosen for a volume group", async () => {
    mockConfig.mockReturnValue({
      drives: [vda()],
      mdRaids: [],
      volumeGroups: [{ vgName: "system", targetDevices: ["/dev/vda"] }],
    });
    const { user } = renderItem(vda());
    await openMenu(user);

    screen.getByRole("menuitem", { name: /Selected disk cannot be changed/ });
    screen.getByText("It is chosen for the LVM group 'system'");
  });

  it("refuses for a disk only chosen for booting", async () => {
    mockConfig.mockReturnValue({
      drives: [vda()],
      mdRaids: [],
      volumeGroups: [],
      boot: { configure: true, device: { default: false, name: "/dev/vda" } },
    });
    const { user } = renderItem(vda());
    await openMenu(user);

    screen.getByText("It is chosen for booting");
  });
});
