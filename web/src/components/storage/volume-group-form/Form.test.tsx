/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { screen, waitFor, within } from "@testing-library/react";
import { installerRender, mockNavigateFn, mockParams } from "~/test-utils";
import { gib } from "~/components/storage/utils";
import { STORAGE } from "~/routes/paths";

import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

// Mock scrollTo which is not available in jsdom
Element.prototype.scrollTo = jest.fn();

const sda: System.Device = {
  sid: 59,
  class: "drive",
  name: "/dev/sda",
  description: "SDA drive",
  drive: {
    type: "disk",
    model: "Micron 1100 SATA",
    vendor: "Micron",
    bus: "IDE",
    busId: "",
    transport: "usb",
    drivers: ["ahci", "mmcblk"],
    info: { boss: false, sdCard: true },
  },
  block: {
    start: 1,
    size: gib(20),
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

const sdb: System.Device = {
  sid: 60,
  class: "drive",
  name: "/dev/sdb",
  block: {
    start: 1,
    size: gib(10),
    shrinking: { supported: false },
    systems: [],
  },
  drive: {
    type: "disk",
    info: { boss: false, sdCard: false },
  },
};

// A drive where partitions are being added, so it is the usual home of the
// first volume group.
const mockSdaDrive: ConfigModel.Drive = {
  name: "/dev/sda",
  spacePolicy: "delete",
  partitions: [
    {
      mountPath: "swap",
      size: { min: gib(2), default: false },
      filesystem: { default: true, type: "swap" },
    },
    {
      mountPath: "/home",
      size: { min: gib(16), default: true },
      filesystem: { default: true, type: "xfs" },
    },
  ],
};

const mockRootVolumeGroup: ConfigModel.VolumeGroup = {
  vgName: "fakeRootVg",
  targetDevices: ["/dev/sda"],
  logicalVolumes: [],
};

const mockHomeVolumeGroup: ConfigModel.VolumeGroup = {
  vgName: "fakeHomeVg",
  targetDevices: ["/dev/sda"],
  logicalVolumes: [],
};

const mockAddVolumeGroup = jest.fn();
const mockEditVolumeGroup = jest.fn();
let mockConfig: ConfigModel.Config;
let mockVolumeGroup: ConfigModel.VolumeGroup | null;

jest.mock("./queries", () => ({
  useVolumeGroupConfig: () => mockVolumeGroup,
  useTargetDevices: () => [sda, sdb],
}));

jest.mock("~/hooks/model/storage/config-model", () => ({
  useConfigModel: () => mockConfig,
  useAddVolumeGroup: () => mockAddVolumeGroup,
  useEditVolumeGroup: () => mockEditVolumeGroup,
}));

// Import the tested component last.
import VolumeGroupForm from "./Form";

type User = ReturnType<typeof installerRender>["user"];

const MOVE_MOUNT_POINTS =
  /Move the mount points currently configured at the selected disks to logical volumes/;

const nameInput = () => screen.getByRole("textbox", { name: "Name" });
const acceptButton = () => screen.getByRole("button", { name: "Accept" });
const moveMountPointsCheckbox = () => screen.getByRole("checkbox", { name: MOVE_MOUNT_POINTS });

/** The disks already chosen, which the field renders as a list of its own. */
const entriesList = () => screen.queryByRole("listbox", { name: "Disks entries" });

/** The entry for a disk already chosen, if there is one. */
const entry = (name: string) => entriesList() && within(entriesList()).queryByText(name);

/** Takes a disk out of the chosen ones. */
const removeDisk = async (user: User, name: string) =>
  user.click(screen.getByRole("button", { name: `Remove ${name}` }));

/** Chooses a disk from the list the field offers. */
const addDisk = async (user: User, name: RegExp) => {
  await user.click(screen.getByRole("button", { name: "Show options" }));
  const list = within(screen.getByRole("listbox", { name: "Disks" }));
  await user.click(list.getByRole("option", { name }));
};

describe("VolumeGroupForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams({});
    mockVolumeGroup = null;
    mockConfig = { drives: [mockSdaDrive], mdRaids: [], volumeGroups: [] };
  });

  describe("when editing a volume group that does not exist", () => {
    it("shows a resource not found message", () => {
      mockParams({ id: "7" });
      installerRender(<VolumeGroupForm />);
      screen.getByText("Go to storage page");
      expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    });
  });

  describe("when creating a new volume group", () => {
    it("renders the name, the disks and the option to move the mount points", () => {
      installerRender(<VolumeGroupForm />);
      nameInput();
      screen.getByRole("combobox", { name: "Disks" });
      moveMountPointsCheckbox();
    });

    it("allows configuring a new LVM volume group (without moving mount points)", async () => {
      const { user } = installerRender(<VolumeGroupForm />);

      // Clear default value for name
      await user.clear(nameInput());
      await user.type(nameInput(), "root-vg");
      await addDisk(user, /sdb/);

      // sda is selected by default because it is adding partitions.
      expect(entry("sda (20 GiB)")).toBeInTheDocument();
      expect(entry("sdb (10 GiB)")).toBeInTheDocument();
      // By default move mount points should be checked
      expect(moveMountPointsCheckbox()).toBeChecked();
      await user.click(moveMountPointsCheckbox());
      expect(moveMountPointsCheckbox()).not.toBeChecked();
      await user.click(acceptButton());

      expect(mockAddVolumeGroup).toHaveBeenCalledWith(
        { vgName: "root-vg", targetDevices: ["/dev/sda", "/dev/sdb"] },
        false,
      );
    });

    it("allows configuring a new LVM volume group (moving mount points)", async () => {
      const { user } = installerRender(<VolumeGroupForm />);
      await addDisk(user, /sdb/);
      expect(moveMountPointsCheckbox()).toBeChecked();
      await user.click(acceptButton());

      expect(mockAddVolumeGroup).toHaveBeenCalledWith(
        { vgName: "system", targetDevices: ["/dev/sda", "/dev/sdb"] },
        true,
      );
    });

    it("goes back to the storage page once the volume group is added", async () => {
      const { user } = installerRender(<VolumeGroupForm />);
      await user.click(acceptButton());

      await waitFor(() => expect(mockNavigateFn).toHaveBeenCalledWith(STORAGE.root));
    });

    it("does not add anything while the form is invalid", async () => {
      const { user } = installerRender(<VolumeGroupForm />);
      await user.clear(nameInput());
      await user.click(acceptButton());

      expect(mockAddVolumeGroup).not.toHaveBeenCalled();
      expect(mockNavigateFn).not.toHaveBeenCalled();
    });

    it("performs basic validations", async () => {
      const { user } = installerRender(<VolumeGroupForm />);

      // Unselect sda
      await removeDisk(user, "sda (20 GiB)");
      // Let's clean the default given name
      await user.clear(nameInput());
      expect(screen.queryByText(/Enter a name/)).toBeNull();

      await user.click(acceptButton());
      screen.getByText("Fix the errors below and try again");
      screen.getByText(/Enter a name/);
      screen.getByText(/Select at least one disk/);

      // Type a name
      await user.type(nameInput(), "root-vg");
      await user.click(acceptButton());
      screen.getByText("Fix the errors below and try again");
      expect(screen.queryByText(/Enter a name/)).toBeNull();
      screen.getByText(/Select at least one disk/);

      // Select sda again
      await addDisk(user, /sda/);
      await user.click(acceptButton());
      expect(screen.queryByText("Fix the errors below and try again")).toBeNull();
      expect(screen.queryByText(/Enter a name/)).toBeNull();
      expect(screen.queryByText(/Select at least one disk/)).toBeNull();
      expect(mockAddVolumeGroup).toHaveBeenCalledTimes(1);
    });

    describe("name validation", () => {
      it.each(["$this", "my vg", "vg/one"])(
        "refuses the name %j, that LVM does not accept",
        async (name) => {
          const { user } = installerRender(<VolumeGroupForm />);
          await user.clear(nameInput());
          await user.type(nameInput(), name);
          await user.click(acceptButton());

          await screen.findByText(/The name can only contain letters, digits/);
          expect(mockAddVolumeGroup).not.toHaveBeenCalled();
        },
      );

      it.each(["-vg", ".", ".."])("refuses the name %j", async (name) => {
        const { user } = installerRender(<VolumeGroupForm />);
        await user.clear(nameInput());
        await user.type(nameInput(), name);
        await user.click(acceptButton());

        await screen.findByText("The name cannot begin with a hyphen or be '.' or '..'.");
        expect(mockAddVolumeGroup).not.toHaveBeenCalled();
      });

      it("accepts every character LVM accepts", async () => {
        const { user } = installerRender(<VolumeGroupForm />);
        await user.clear(nameInput());
        await user.type(nameInput(), "My_vg-1.+x");
        await user.click(acceptButton());

        expect(mockAddVolumeGroup).toHaveBeenCalledWith(
          { vgName: "My_vg-1.+x", targetDevices: ["/dev/sda"] },
          true,
        );
      });

      it("refuses the name of another volume group", async () => {
        mockConfig = { ...mockConfig, volumeGroups: [mockRootVolumeGroup] };
        const { user } = installerRender(<VolumeGroupForm />);
        await addDisk(user, /sda/);
        await user.type(nameInput(), "fakeRootVg");
        await user.click(acceptButton());

        await screen.findByText(/Enter a different name/);
        expect(mockAddVolumeGroup).not.toHaveBeenCalled();
      });
    });

    describe("when there are LVM volume groups", () => {
      beforeEach(() => {
        mockConfig = { ...mockConfig, volumeGroups: [mockRootVolumeGroup] };
      });

      it("does not pre-fill the name input", () => {
        installerRender(<VolumeGroupForm />);
        expect(nameInput()).toHaveValue("");
      });

      it("does not choose any disk", () => {
        installerRender(<VolumeGroupForm />);
        expect(entriesList()).not.toBeInTheDocument();
      });
    });

    describe("when there are no LVM volume groups yet", () => {
      it("pre-fills the name input with 'system'", () => {
        installerRender(<VolumeGroupForm />);
        expect(nameInput()).toHaveValue("system");
      });

      it("chooses the disks where partitions are being added", () => {
        installerRender(<VolumeGroupForm />);
        expect(entry("sda (20 GiB)")).toBeInTheDocument();
        expect(entry("sdb (10 GiB)")).not.toBeInTheDocument();
      });
    });

    describe("when the volume group cannot be added", () => {
      it("shows the reason", async () => {
        mockAddVolumeGroup.mockImplementation(() => {
          throw new Error("The storage model was refused");
        });
        const { user } = installerRender(<VolumeGroupForm />);
        await user.click(acceptButton());

        await screen.findByText("Volume group could not be configured");
        screen.getByText("The storage model was refused");
        expect(mockNavigateFn).not.toHaveBeenCalled();
      });
    });
  });

  describe("when editing", () => {
    beforeEach(() => {
      mockParams({ id: "0" });
      mockConfig = {
        drives: [mockSdaDrive],
        mdRaids: [],
        volumeGroups: [mockRootVolumeGroup, mockHomeVolumeGroup],
      };
      mockVolumeGroup = mockRootVolumeGroup;
    });

    it("shows helper text when targetDevicesPolicy is useNeeded", () => {
      mockVolumeGroup = { ...mockRootVolumeGroup, targetDevicesPolicy: "useNeeded" };

      installerRender(<VolumeGroupForm />);

      screen.getByText(/This volume group only occupies the space required by its logical volumes/);
      screen.getByText(/To expand it to cover all available disk space, recreate the volume group/);
    });

    it("does not show helper text when targetDevicesPolicy is not useNeeded", () => {
      installerRender(<VolumeGroupForm />);

      expect(
        screen.queryByText(
          /This volume group only occupies the space required by its logical volumes/,
        ),
      ).toBeNull();
    });

    it("performs basic validations", async () => {
      const { user } = installerRender(<VolumeGroupForm />);

      // Let's clean the default given name
      await user.clear(nameInput());
      await removeDisk(user, "sda (20 GiB)");
      expect(nameInput()).toHaveValue("");
      expect(entry("sda (20 GiB)")).not.toBeInTheDocument();

      await user.click(acceptButton());
      screen.getByText("Fix the errors below and try again");
      screen.getByText(/Enter a name/);
      screen.getByText(/Select at least one disk/);

      // Enter a name already in use
      await user.type(nameInput(), "fakeHomeVg");
      await user.click(acceptButton());
      expect(screen.queryByText(/Enter a name/)).toBeNull();
      screen.getByText(/Enter a different name/);
    });

    it("pre-fills form with the current volume group configuration", () => {
      installerRender(<VolumeGroupForm />);
      expect(nameInput()).toHaveValue("fakeRootVg");
      expect(entry("sda (20 GiB)")).toBeInTheDocument();
      expect(entry("sdb (10 GiB)")).not.toBeInTheDocument();
    });

    it("does not offer option for moving mount points", () => {
      installerRender(<VolumeGroupForm />);
      expect(screen.queryByRole("checkbox", { name: MOVE_MOUNT_POINTS })).toBeNull();
    });

    it("triggers the hook for updating the volume group when user accepts changes", async () => {
      const { user } = installerRender(<VolumeGroupForm />);
      await user.clear(nameInput());
      await user.type(nameInput(), "updatedRootVg");
      await user.click(acceptButton());

      expect(mockEditVolumeGroup).toHaveBeenCalledWith("fakeRootVg", {
        vgName: "updatedRootVg",
        targetDevices: ["/dev/sda"],
      });
      expect(mockAddVolumeGroup).not.toHaveBeenCalled();
      await waitFor(() => expect(mockNavigateFn).toHaveBeenCalledWith(STORAGE.root));
    });

    it("does not report its own name as already used", async () => {
      const { user } = installerRender(<VolumeGroupForm />);
      await addDisk(user, /sdb/);
      await user.click(acceptButton());

      expect(screen.queryByText(/Enter a different name/)).toBeNull();
      expect(mockEditVolumeGroup).toHaveBeenCalledWith("fakeRootVg", {
        vgName: "fakeRootVg",
        targetDevices: ["/dev/sda", "/dev/sdb"],
      });
    });
  });
});
