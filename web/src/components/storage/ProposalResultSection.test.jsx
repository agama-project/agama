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
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { ProposalResultSection } from "~/components/storage";
import { devices, actions } from "./test-data/full-result-example";

/**
 * @typedef {import("./ProposalResultSection").ProposalResultSectionProps} ProposalResultSectionProps
 */

const errorMessage = "Something went wrong, proposal not possible";
const errors = [{ severity: 0, message: errorMessage }];
/** @type {ProposalResultSectionProps} */
const defaultProps = { system: devices.system, staging: devices.staging, actions };

describe.skip("ProposalResultSection", () => {
  describe("when there are errors (proposal was not possible)", () => {
    it("renders given errors", () => {
      plainRender(<ProposalResultSection {...defaultProps} errors={errors} />);
      expect(screen.queryByText(errorMessage)).toBeInTheDocument();
    });

    it("does not render a warning for delete actions", () => {
      plainRender(<ProposalResultSection {...defaultProps} errors={errors} />);
      expect(screen.queryByText(/Warning alert:/)).toBeNull();
    });

    it("does not render a treegrid node", () => {
      plainRender(<ProposalResultSection {...defaultProps} errors={errors} />);
      expect(screen.queryByRole("treegrid")).toBeNull();
    });

    it("does not render the link for opening the planned actions dialog", () => {
      plainRender(<ProposalResultSection {...defaultProps} errors={errors} />);
      expect(screen.queryByRole("button", { name: /planned actions/ })).toBeNull();
    });
  });

  describe("when there are no errors (proposal was possible)", () => {
    it("does not render a warning when there are not delete actions", () => {
      const props = {
        ...defaultProps,
        actions: defaultProps.actions.filter(a => !a.delete)
      };

      plainRender(<ProposalResultSection {...props} />);
      expect(screen.queryByText(/Warning alert:/)).toBeNull();
    });

    it("renders a reminder when there are delete actions", () => {
      plainRender(<ProposalResultSection {...defaultProps} />);
      const reminder = screen.getByRole("status");
      within(reminder).getByText(/4 destructive/);
    });

    it("renders the affected systems in the deletion reminder, if any", () => {
      // NOTE: simulate the deletion of vdc2 (sid: 79) for checking that
      // affected systems are rendered in the warning summary
      const props = {
        ...defaultProps,
        actions: [{ device: 79, subvol: false, delete: true, text: "" }]
      };

      plainRender(<ProposalResultSection {...props} />);
      // FIXME: below line reveals that warning wrapper deserves a role or
      // something
      const reminder = screen.getByRole("status");
      within(reminder).getByText(/openSUSE/);
    });

    it("renders a treegrid including all relevant information about final result", () => {
      plainRender(<ProposalResultSection {...defaultProps} />);
      const treegrid = screen.getByRole("treegrid");
      /**
       * Expected rows for full-result-example
       * --------------------------------------------------
       * "/dev/vdc Disk GPT 30 GiB"
       * "vdc1 New BIOS Boot Partition 8 MiB"
       * "vdc3 swap New Swap Partition 1.5 GiB"
       * "Unused space 3.49 GiB"
       * "vdc2 openSUSE Leap 15.2, Fedora 10.30 5 GiB"
       * "Unused space 1 GiB"
       * "vdc4 Linux Before 2 GiB 1.5 GiB"
       * "vdc5 / New Btrfs Partition 17.5 GiB"
       *
       * Device      Mount point      Details                                 Size
       * -------------------------------------------------------------------------
       * /dev/vdc                     Disk GPT                              30 GiB
       *     vdc1                 New BIOS Boot Partition                    8 MiB
       *     vdc3    swap         New Swap Partition                       1.5 GiB
       *                              Unused space                        3.49 GiB
       *     vdc2                     openSUSE Leap 15.2, Fedora 10.30       5 GiB
       *                              Unused space                           1 GiB
       *     vdc4                     Linux                   Before 2 GiB 1.5 GiB
       *     vdc5    /            New Btrfs Partition                     17.5 GiB
       * -------------------------------------------------------------------------
       */
      within(treegrid).getByRole("row", { name: "/dev/vdc Disk GPT 30 GiB" });
      within(treegrid).getByRole("row", { name: "vdc1 New BIOS Boot Partition 8 MiB" });
      within(treegrid).getByRole("row", { name: "vdc3 swap New Swap Partition 1.5 GiB" });
      within(treegrid).getByRole("row", { name: "Unused space 3.49 GiB" });
      within(treegrid).getByRole("row", { name: "vdc2 openSUSE Leap 15.2, Fedora 10.30 5 GiB" });
      within(treegrid).getByRole("row", { name: "Unused space 1 GiB" });
      within(treegrid).getByRole("row", { name: "vdc4 Linux Before 2 GiB 1.5 GiB" });
      within(treegrid).getByRole("row", { name: "vdc5 / New Btrfs Partition 17.5 GiB" });
    });

    it("renders a button for opening the planned actions dialog", async () => {
      const { user } = plainRender(<ProposalResultSection {...defaultProps} />);
      const button = screen.getByRole("button", { name: /planned actions/ });

      await user.click(button);

      screen.getByRole("dialog", { name: "Planned Actions" });
    });
  });
});
