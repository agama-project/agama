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
import { installerRender } from "~/test-utils";
import { SPACE_POLICIES } from "~/components/storage/utils";
import ProposalActionsSummary from "~/components/storage/ProposalActionsSummary";
import { devices, actions } from "./test-data/full-result-example";

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
const deletePolicy = SPACE_POLICIES.find(p => p.id === "delete");
const resizePolicy = SPACE_POLICIES.find(p => p.id === "resize");

const defaultProps = {
  isLoading: false,
  policy: keepPolicy,
  onActionsClick: jest.fn(),
  system: devices.system,
  staging: devices.staging,
  actions
};

describe("ProposalActionsSummary", () => {
  it("renders a button for navigating to the space policy selection", async () => {
    installerRender(<ProposalActionsSummary {...defaultProps} />);
    screen.getByRole("link", { name: "Change" });
  });

  it("renders the affected systems in the deletion reminder, if any", () => {
    // NOTE: simulate the deletion of vdc2 (sid: 79) for checking that
    // affected systems are rendered in the warning summary
    const props = {
      ...defaultProps,
      policy: deletePolicy,
      actions: [{ device: 79, subvol: false, delete: true, text: "" }]
    };

    installerRender(<ProposalActionsSummary {...props} />);
    screen.getByText(/destructive/);
    screen.getByText(/affecting/);
    screen.getByText(/openSUSE/);
  });

  it("renders the affected systems in the resize reminder, if any", () => {
    // NOTE: simulate the deletion of vdc2 (sid: 79) for checking that
    // affected systems are rendered in the warning summary
    const props = {
      ...defaultProps,
      policy: resizePolicy,
      actions: [{ device: 79, subvol: false, delete: false, resize: true, text: "" }]
    };

    installerRender(<ProposalActionsSummary {...props} />);
    screen.getByText(/shrunk/);
    screen.getByText(/affecting/);
    screen.getByText(/openSUSE/);
  });

  it.todo("test the actions and drawer behaviour");
});
