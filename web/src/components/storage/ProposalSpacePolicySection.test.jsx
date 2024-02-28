/*
 * Copyright (c) [2024] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { plainRender, resetLocalStorage } from "~/test-utils";
import { ProposalSpacePolicySection } from "~/components/storage";

const sda = {
  sid: "59",
  isDrive: true,
  type: "disk",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  busId: "",
  transport: "usb",
  dellBOSS: false,
  sdCard: true,
  active: true,
  name: "/dev/sda",
  size: 1024,
  recoverableSize: 0,
  systems : [],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

const sda1 = {
  sid: "60",
  isDrive: false,
  type: "",
  active: true,
  name: "/dev/sda1",
  size: 512,
  recoverableSize: 128,
  systems : [],
  udevIds: [],
  udevPaths: []
};

const sda2 = {
  sid: "61",
  isDrive: false,
  type: "",
  active: true,
  name: "/dev/sda2",
  size: 512,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: []
};

sda.partitionTable = {
  type: "gpt",
  partitions: [sda1, sda2],
  unpartitionedSize: 512
};

const sdb = {
  sid: "62",
  isDrive: true,
  type: "disk",
  vendor: "Samsung",
  model: "Samsung Evo 8 Pro",
  driver: ["ahci"],
  bus: "IDE",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/sdb",
  size: 2048,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"]
};

let settings;

beforeEach(() => {
  settings = {
    installationDevices: [sda, sdb],
    spacePolicy: "keep",
    spaceActions: [
      { device: "/dev/sda1", action: "force_delete" },
      { device: "/dev/sda2", action: "resize" }
    ],
  };

  resetLocalStorage();
});

describe("ProposalSpacePolicySection", () => {
  it("renders the space policy picker", () => {
    plainRender(<ProposalSpacePolicySection settings={settings} />);
    const picker = screen.getByRole("listbox");
    within(picker).getByRole("option", { name: /delete/i });
    within(picker).getByRole("option", { name: /resize/i });
    within(picker).getByRole("option", { name: /available/i });
    within(picker).getByRole("option", { name: /custom/i });
  });

  it("triggers the onChange callback when user changes selected space policy", async () => {
    const onChangeFn = jest.fn();
    const { user } = plainRender(<ProposalSpacePolicySection settings={settings} onChange={onChangeFn} />);
    const picker = screen.getByRole("listbox");
    await user.selectOptions(
      picker,
      within(picker).getByRole("option", { name: /custom/i })
    );
    expect(onChangeFn).toHaveBeenCalledWith({ spacePolicy: "custom" });
  });

  describe("when there are no installation devices", () => {
    beforeEach(() => {
      settings.installationDevices = [];
    });

    it("does not render the policy actions", () => {
      plainRender(<ProposalSpacePolicySection settings={settings} />);
      const actions = screen.queryByRole("treegrid", { name: "Actions to find space" });
      expect(actions).toBeNull();
    });
  });

  describe("when there are installation devices", () => {
    it("renders the policy actions", () => {
      plainRender(<ProposalSpacePolicySection settings={settings} />);
      screen.getByRole("treegrid", { name: "Actions to find space" });
    });
  });

  describe.each([
    { id: 'delete', nameRegexp: /delete/i },
    { id: 'resize', nameRegexp: /shrink/i },
    { id: 'keep', nameRegexp: /the space not assigned/i }
  ])("when space policy is '$id'", ({ id, nameRegexp }) => {
    beforeEach(() => {
      settings.spacePolicy = id;
    });

    it("only renders '$id' option as selected", () => {
      plainRender(<ProposalSpacePolicySection settings={settings} />);
      const picker = screen.getByRole("listbox");
      within(picker).getByRole("option", { name: nameRegexp, selected: true });
      expect(within(picker).getAllByRole("option", { selected: false }).length).toEqual(3);
    });

    it("does not allow to modify the space actions", () => {
      plainRender(<ProposalSpacePolicySection settings={settings} />);
      // NOTE: HTML `disabled` attribute removes the element from the a11y tree.
      // That's why the test is using `hidden: true` here to look for disabled actions.
      // https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled
      // https://testing-library.com/docs/queries/byrole/#hidden
      // TODO: use a more inclusive way to disable the actions.
      // https://css-tricks.com/making-disabled-buttons-more-inclusive/
      const spaceActions = screen.getAllByRole("combobox", { name: /Space action selector/, hidden: true });
      expect(spaceActions.length).toEqual(3);
    });
  });

  describe("when space policy is 'custom'", () => {
    beforeEach(() => {
      settings.spacePolicy = "custom";
    });

    it("only renders 'custom' option as selected", () => {
      plainRender(<ProposalSpacePolicySection settings={settings} />);
      const picker = screen.getByRole("listbox");
      within(picker).getByRole("option", { name: /custom/i, selected: true });
      expect(within(picker).getAllByRole("option", { selected: false }).length).toEqual(3);
    });

    it("allows to modify the space actions", () => {
      plainRender(<ProposalSpacePolicySection settings={settings} />);
      const spaceActions = screen.getAllByRole("combobox", { name: /Space action selector/ });
      expect(spaceActions.length).toEqual(3);
    });
  });

  describe("DeviceActionColumn", () => {
    it("renders the space actions selector for devices without partition table", () => {
      plainRender(<ProposalSpacePolicySection settings={settings} />);
      const sdaRow = screen.getByRole("row", { name: /sda/ });
      const sdaActionsSelector = within(sdaRow).queryByRole("combobox", { name: "Space action selector for /dev/sda" });
      // sda has partition table, the selector shouldn't be found
      expect(sdaActionsSelector).toBeNull();
      const sdbRow = screen.getByRole("row", { name: /sdb/ });
      // sdb does not have partition table, selector should be there
      within(sdbRow).getByRole("combobox", { name: "Space action selector for /dev/sdb" });
    });

    it("does not renders the 'resize' option for drives", () => {
      plainRender(<ProposalSpacePolicySection settings={settings} />);
      const sdbRow = screen.getByRole("row", { name: /sdb/ });
      const spaceActionsSelector = within(sdbRow).getByRole("combobox", { name: "Space action selector for /dev/sdb" });
      const resizeOption = within(spaceActionsSelector).queryByRole("option", { name: /resize/ });
      expect(resizeOption).toBeNull();
    });

    it("renders the 'resize' option for devices other than drives", async () => {
      const { user } = plainRender(<ProposalSpacePolicySection settings={settings} />);
      const sdaRow = screen.getByRole("row", { name: /sda/ });
      const sdaToggler = within(sdaRow).getByRole("button", { name: /expand/i });
      await user.click(sdaToggler);
      const sda1Row = screen.getByRole("row", { name: /sda1/ });
      const spaceActionsSelector = within(sda1Row).getByRole("combobox", { name: "Space action selector for /dev/sda1" });
      within(spaceActionsSelector).getByRole("option", { name: /resize/ });
    });

    it("renders as selected the option matching the given device space action", async () => {
      const { user } = plainRender(<ProposalSpacePolicySection settings={settings} />);
      const sdaRow = screen.getByRole("row", { name: /sda/ });
      const sdaToggler = within(sdaRow).getByRole("button", { name: /expand/i });
      await user.click(sdaToggler);
      const sda1Row = screen.getByRole("row", { name: /sda1/ });
      const sda1SpaceActionsSelector = within(sda1Row).getByRole("combobox", { name: "Space action selector for /dev/sda1" });
      within(sda1SpaceActionsSelector).getByRole("option", { name: /delete/i, selected: true });
      const sda2Row = screen.getByRole("row", { name: /sda2/ });
      const sda2SpaceActionsSelector = within(sda2Row).getByRole("combobox", { name: "Space action selector for /dev/sda2" });
      within(sda2SpaceActionsSelector).getByRole("option", { name: /resize/i, selected: true });
    });

    it("triggers the onChange callback when user changes space action", async () => {
      const onChangeFn = jest.fn();
      const { user } = plainRender(
        <ProposalSpacePolicySection settings={{ ...settings, spacePolicy: "custom" }} onChange={onChangeFn} />
      );

      const sda1Row = screen.getByRole("row", { name: /sda1/ });
      const selector = within(sda1Row).getByRole("combobox", { name: "Space action selector for /dev/sda1" });
      await user.selectOptions(
        selector,
        within(selector).getByRole("option", { name: /resize/i, selected: false })
      );
      expect(onChangeFn).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceActions: expect.arrayContaining([{ action: "resize", device: "/dev/sda1" }])
        })
      );
    });
  });
});
