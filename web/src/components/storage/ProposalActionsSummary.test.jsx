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

// @ts-check

import React from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { SPACE_POLICIES } from "~/components/storage/utils";
import ProposalActionsSummary from "~/components/storage/ProposalActionsSummary";

const sda = {
  sid: 59,
  description: "A fake disk for testing",
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
  systems: [],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

const keepPolicy = SPACE_POLICIES.find(p => p.id === "keep");

const props = {
  isLoading: false,
  policy: keepPolicy,
  devices: [sda],
  actions: [
    { device: "/dev/sda", action: "force_delete" },
  ],
  onActionsClick: jest.fn(),
  onChange: jest.fn()
};

describe("ProposalActionsSummary", () => {
  it("renders a button for opening the space policy dialog", async () => {
    const { user } = plainRender(<ProposalActionsSummary {...props} />);
    const button = screen.getByRole("button", { name: "Change" });
    await user.click(button);
    screen.getByRole("dialog", { name: "Find space" });
  });

  it.todo("test the actions and drawer behaviour");
});
