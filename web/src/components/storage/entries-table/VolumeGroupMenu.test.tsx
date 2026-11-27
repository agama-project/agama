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
import { installerRender, mockNavigateFn } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import VolumeGroupMenu from "~/components/storage/entries-table/VolumeGroupMenu";

const mockConfig = jest.fn();
const mockDeleteVolumeGroup = jest.fn();
const mockOpenDetails = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
  useDeleteVolumeGroup: () => mockDeleteVolumeGroup,
}));

jest.mock("~/components/storage/shared/use-device-details", () => ({
  ...jest.requireActual("~/components/storage/shared/use-device-details"),
  useDeviceDetails: () => ({ openDetails: mockOpenDetails }),
}));

/* Tested on its own. */
jest.mock("~/components/storage/entries-table/SpacePolicyMenuItem", () => () => (
  <li>space policy</li>
));

const subject = { collection: "volumeGroups" as const, index: 0 };
const vda = { name: "/dev/vda" } as ConfigModel.Drive;
const vdb = { name: "/dev/vdb" } as ConfigModel.Drive;

const newGroup = (values: Partial<ConfigModel.VolumeGroup> = {}) =>
  ({ vgName: "system", targetDevices: ["/dev/vda"], ...values }) as ConfigModel.VolumeGroup;

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [vda, vdb],
  mdRaids: [],
  volumeGroups: [],
  ...values,
});

const openMenu = async (user) => {
  await user.click(screen.getByRole("button", { name: "Actions for system" }));
};

describe("VolumeGroupMenu", () => {
  beforeEach(() => mockConfig.mockReturnValue(config()));

  describe("for a group the installation creates", () => {
    it("opens its panel from its row", async () => {
      const { user } = installerRender(<VolumeGroupMenu group={newGroup()} subject={subject} />);
      await openMenu(user);
      await user.click(screen.getByRole("menuitem", { name: /^Details/ }));

      expect(mockOpenDetails).toHaveBeenCalledWith(subject);
    });

    it("leads to its edit form from its row only", async () => {
      const { user, unmount } = installerRender(
        <VolumeGroupMenu group={newGroup()} subject={subject} />,
      );
      await openMenu(user);
      await user.click(screen.getByRole("menuitem", { name: /^Edit/ }));
      expect(mockNavigateFn).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: expect.stringContaining("0") }),
      );
      unmount();

      const panel = installerRender(<VolumeGroupMenu group={newGroup()} />);
      await openMenu(panel.user);
      expect(screen.queryByRole("menuitem", { name: /^Edit/ })).toBeNull();
    });

    it("moves its logical volumes to its only disk when deleted", async () => {
      const group = newGroup({
        logicalVolumes: [{ mountPath: "/home" } as ConfigModel.LogicalVolume],
      });
      mockConfig.mockReturnValue(config({ volumeGroups: [group] }));
      const { user } = installerRender(<VolumeGroupMenu group={group} subject={subject} />);
      await openMenu(user);
      screen.getByText('"/home" will be created as a partition at vda');
      await user.click(screen.getByRole("menuitem", { name: /Delete volume group/ }));

      expect(mockDeleteVolumeGroup).toHaveBeenCalledWith("system", true);
    });

    it("deletes its logical volumes too when it spans several disks", async () => {
      const group = newGroup({
        targetDevices: ["/dev/vda", "/dev/vdb"],
        logicalVolumes: [{ mountPath: "/home" } as ConfigModel.LogicalVolume],
      });
      mockConfig.mockReturnValue(config({ volumeGroups: [group] }));
      const { user } = installerRender(<VolumeGroupMenu group={group} subject={subject} />);
      await openMenu(user);
      screen.getByText("The logical volume will also be deleted");
      await user.click(screen.getByRole("menuitem", { name: /Delete volume group/ }));

      expect(mockDeleteVolumeGroup).toHaveBeenCalledWith("system", false);
    });
  });

  describe("for a group already on the system", () => {
    const existing = newGroup({ name: "system", spacePolicy: "keep" });

    it("opens its panel and offers its space policy from its row", async () => {
      const { user } = installerRender(<VolumeGroupMenu group={existing} subject={subject} />);
      await openMenu(user);
      screen.getByText("space policy");
      await user.click(screen.getByRole("menuitem", { name: /^Details/ }));

      expect(mockOpenDetails).toHaveBeenCalledWith(subject);
    });

    it("stops using it when there is another device to install on", async () => {
      const { user } = installerRender(<VolumeGroupMenu group={existing} subject={subject} />);
      await openMenu(user);
      await user.click(screen.getByRole("menuitem", { name: /Do not use/ }));

      expect(mockDeleteVolumeGroup).toHaveBeenCalledWith("system", false);
    });

    it("does not offer to stop using the only device", async () => {
      mockConfig.mockReturnValue(config({ drives: [], volumeGroups: [existing] }));
      const { user } = installerRender(<VolumeGroupMenu group={existing} subject={subject} />);
      await openMenu(user);

      expect(screen.queryByRole("menuitem", { name: /Do not use/ })).toBeNull();
    });
  });
});
