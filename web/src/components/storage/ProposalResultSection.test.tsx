/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { ProposalResultSection } from "~/components/storage";
import { devices, actions } from "./test-data/full-result-example";

const mockUseActionsFn = jest.fn();
const mockConfig = { drives: [] };

jest.mock("~/hooks/api/system/storage", () => ({
  ...jest.requireActual("~/hooks/api/system/storage"),
  useDevices: () => devices.staging,
}));

jest.mock("~/hooks/api/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/api/proposal/storage"),
  useActions: () => mockUseActionsFn(),
}));

jest.mock("~/hooks/api/storage", () => ({
  ...jest.requireActual("~/hooks/api/storage"),
  useStorageModel: () => mockConfig,
}));

describe("ProposalResultSection", () => {
  beforeEach(() => {
    mockUseActionsFn.mockReturnValue(actions);
  });

  describe("when there are no delete actions", () => {
    beforeEach(() => {
      mockUseActionsFn.mockReturnValue(actions.filter((a) => !a.delete));
    });

    it("does not render a warning when there are not delete actions", () => {
      installerRender(<ProposalResultSection />);
      expect(screen.queryByText(/destructive/)).not.toBeInTheDocument();
    });
  });

  describe("when there are delete actions affecting a previous system", () => {
    beforeEach(() => {
      // NOTE: simulate the deletion of vdc2 (sid: 79) for checking that
      // affected systems are rendered in the warning summary
      mockUseActionsFn.mockReturnValue([
        { device: 79, subvol: false, delete: true, resize: false, text: "" },
      ]);
    });

    it("renders the affected systems in the deletion reminder, if any", () => {
      installerRender(<ProposalResultSection />);
      expect(screen.queryByText(/affecting openSUSE/)).toBeInTheDocument();
    });
  });

  it("renders a reminder about the delete actions", () => {
    installerRender(<ProposalResultSection />);
    expect(screen.queryByText(/4 destructive/)).toBeInTheDocument();
  });

  it("renders a treegrid including all relevant information about final result", async () => {
    const { user } = installerRender(<ProposalResultSection />);
    const tab = screen.getByRole("tab", { name: /Final layout/ });

    await user.click(tab);
    const treegrid = screen.getByRole("treegrid");
    /**
     * Expected rows for full-result-example
     * --------------------------------------------------
     * "/dev/vdc Disk GPT 30 GiB"
     * "vdc1 BIOS Boot Partition 8 MiB"
     * "vdc3 swap Swap Partition 1.5 GiB"
     * "Unused space 3.49 GiB"
     * "vdc2 openSUSE Leap 15.2, Fedora 10.30 5 GiB"
     * "Unused space 1 GiB"
     * "vdc4 Linux Before 2 GiB 1.5 GiB"
     * "vdc5 / New Btrfs Partition 17.5 GiB"
     *
     * Device      Mount point      Details                                 Size
     * -------------------------------------------------------------------------
     * /dev/vdc                     Disk GPT                              30 GiB
     *     vdc1                     BIOS Boot Partition                    8 MiB
     *     vdc3    swap             Swap Partition                       1.5 GiB
     *                              Unused space                        3.49 GiB
     *     vdc2                     openSUSE Leap 15.2, Fedora 10.30       5 GiB
     *                              Unused space                           1 GiB
     *     vdc4                     Linux                                1.5 GiB
     *     vdc5    /                Btrfs Partition                     17.5 GiB
     * -------------------------------------------------------------------------
     */
    within(treegrid).getByRole("row", { name: "/dev/vdc Disk GPT 30 GiB" });
    within(treegrid).getByRole("row", { name: "vdc1 BIOS Boot Partition 8 MiB" });
    within(treegrid).getByRole("row", { name: "vdc3 swap Swap Partition 1.5 GiB" });
    within(treegrid).getByRole("row", { name: "Unused space 3.49 GiB" });
    within(treegrid).getByRole("row", { name: "vdc2 openSUSE Leap 15.2, Fedora 10.30 5 GiB" });
    within(treegrid).getByRole("row", { name: "Unused space 1 GiB" });
    within(treegrid).getByRole("row", { name: "vdc4 Linux 1.5 GiB" });
    within(treegrid).getByRole("row", { name: "vdc5 / Btrfs Partition 17.5 GiB" });
  });
});
