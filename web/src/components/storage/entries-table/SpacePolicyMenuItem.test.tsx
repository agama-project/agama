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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import MenuButton from "~/components/core/MenuButton";
import { _ } from "~/i18n";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";
import SpacePolicyMenuItem from "~/components/storage/entries-table/SpacePolicyMenuItem";

const mockConfig = jest.fn();
const mockDevice = jest.fn();
const mockSystemDevices = jest.fn();
const mockSetSpacePolicy = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
  useSetSpacePolicy: () => mockSetSpacePolicy,
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: () => mockDevice(),
  useFlattenDevices: () => mockSystemDevices(),
}));

/* Fly-outs watch their size, which jsdom cannot report. */
beforeAll(() => {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

/* A partitioned disk where the installation creates a new partition. */
const disk = { name: "/dev/vda", spacePolicy: "keep", partitions: [{ mountPath: "/" }] };
const diskDevice = { sid: 1, partitionTable: {} };

/* An existing volume group where the installation creates a new logical volume. */
const group = { vgName: "system", spacePolicy: "keep", logicalVolumes: [{ mountPath: "/" }] };
const groupDevice = { sid: 2, logicalVolumes: [{}] };

type DiskSetup = {
  disk?: Partial<Partitionable.Device>;
  device?: object;
  systemDevices?: object[];
  boot?: ConfigModel.Boot;
};

type GroupSetup = {
  group?: Partial<ConfigModel.VolumeGroup>;
  device?: object;
};

/* A file system the installation keeps as it is. */
const keptFilesystem = { default: false, reuse: true };

const renderItem = (subject: DetailsSubject) =>
  installerRender(
    <MenuButton
      menuProps={{ "aria-label": _("Actions"), hasFlyouts: true }}
      items={[<SpacePolicyMenuItem key="policy" subject={subject} />]}
    >
      Actions
    </MenuButton>,
  );

const renderDisk = (setup: DiskSetup = {}) => {
  mockConfig.mockReturnValue({ drives: [{ ...disk, ...setup.disk }], boot: setup.boot });
  mockDevice.mockReturnValue({ ...diskDevice, ...setup.device });
  mockSystemDevices.mockReturnValue(setup.systemDevices || []);

  return renderItem({ collection: "drives", index: 0 });
};

const renderGroup = (setup: GroupSetup = {}) => {
  mockConfig.mockReturnValue({ volumeGroups: [{ ...group, ...setup.group }] });
  mockDevice.mockReturnValue({ ...groupDevice, ...setup.device });
  mockSystemDevices.mockReturnValue([]);

  return renderItem({ collection: "volumeGroups", index: 0 });
};

const openMenu = async (user) => {
  await user.click(screen.getByRole("button", { name: "Actions" }));
  return screen.getByRole("menuitem", { name: /Actions on current content/ });
};

const openChoices = async (user) => {
  await user.click(await openMenu(user));
};

const expectUnavailable = async (user, reason: string) => {
  const item = await openMenu(user);
  expect(item).toHaveAttribute("aria-disabled", "true");
  within(item).getByText(reason);

  await user.click(item);
  expect(screen.queryByRole("menuitem", { name: /Remove all data/ })).toBeNull();
};

describe("SpacePolicyMenuItem", () => {
  it("sets the chosen policy", async () => {
    const { user } = renderDisk();
    await openChoices(user);
    await user.click(screen.getByRole("menuitem", { name: /Remove all data/ }));

    expect(mockSetSpacePolicy).toHaveBeenCalledWith("drives", 0, { type: "delete" });
  });

  it("changes nothing when choosing the current policy", async () => {
    const { user } = renderDisk({ disk: { spacePolicy: "delete" } });
    await openChoices(user);
    await user.click(screen.getByRole("menuitem", { name: /Remove all data/ }));

    expect(mockSetSpacePolicy).not.toHaveBeenCalled();
  });

  describe("on a disk", () => {
    it("speaks of partitions", async () => {
      const { user } = renderDisk();
      const item = await openMenu(user);
      within(item).getByText("Configure whether to delete or shrink partitions");

      await user.click(item);
      screen.getByText("Some partitions may be reduced if needed");
    });

    it("is available for the boot device, even with nothing else on it", async () => {
      const { user } = renderDisk({
        disk: { partitions: [] },
        boot: { configure: true, device: { default: true, name: "/dev/vda" } },
      });
      const item = await openMenu(user);

      expect(item).not.toHaveAttribute("aria-disabled");
    });

    it("is unavailable when its file system is kept", async () => {
      const { user } = renderDisk({ disk: { filesystem: keptFilesystem } });
      await expectUnavailable(user, "The current data will be kept");
    });

    it("is unavailable when it has no content", async () => {
      const { user } = renderDisk({ device: { partitionTable: undefined } });
      await expectUnavailable(user, "No content detected");
    });

    it("is unavailable when the installation does not use it", async () => {
      const { user } = renderDisk({ disk: { partitions: [] } });
      await expectUnavailable(user, "No usage defined yet");
    });

    it("is unavailable when it is formatted as a whole", async () => {
      const { user } = renderDisk({ disk: { filesystem: { default: false } } });
      await expectUnavailable(user, "All disk content will be deleted");
    });

    it("is unavailable when it has no partition table but is part of a volume group", async () => {
      const { user } = renderDisk({
        device: { partitionTable: undefined },
        systemDevices: [{ volumeGroup: { physicalVolumes: [diskDevice.sid] } }],
      });
      await expectUnavailable(user, "All disk content will be deleted");
    });

    it("is unavailable when it has no partition table but is part of a RAID", async () => {
      const { user } = renderDisk({
        device: { partitionTable: undefined },
        systemDevices: [{ md: { devices: [diskDevice.sid] } }],
      });
      await expectUnavailable(user, "All disk content will be deleted");
    });

    it("is unavailable when the installation keeps some of its partitions", async () => {
      const kept = { name: "/dev/vda1", mountPath: "/home", filesystem: keptFilesystem };
      const { user } = renderDisk({ disk: { partitions: [kept] } });
      await expectUnavailable(user, "Already using existing partitions");
    });
  });

  describe("on a volume group", () => {
    it("speaks of logical volumes", async () => {
      const { user } = renderGroup();
      const item = await openMenu(user);
      within(item).getByText("Configure whether to delete or shrink logical volumes");

      await user.click(item);
      screen.getByText("Some logical volumes may be reduced if needed");
    });

    it("is unavailable when it has no logical volumes", async () => {
      const { user } = renderGroup({ device: { logicalVolumes: [] } });
      await expectUnavailable(user, "No content detected");
    });

    it("is unavailable when the installation keeps some of its logical volumes", async () => {
      const kept = { name: "/dev/system/home", mountPath: "/home", filesystem: keptFilesystem };
      const { user } = renderGroup({ group: { logicalVolumes: [kept] } });
      await expectUnavailable(user, "Already using existing logical volumes");
    });

    it("is unavailable when the installation does not use it", async () => {
      const { user } = renderGroup({ group: { logicalVolumes: [] } });
      await expectUnavailable(user, "No usage defined yet");
    });
  });
});
