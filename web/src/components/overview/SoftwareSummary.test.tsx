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
import { screen, within } from "@testing-library/react";
import { installerRender, mockProgresses } from "~/test-utils";
import { useProposal } from "~/hooks/model/proposal/software";
import { useSelectedPatterns } from "~/hooks/model/system/software";
import { SOFTWARE } from "~/routes/paths";
import { SelectedBy } from "~/model/proposal/software";
import SoftwareSummary from "./SoftwareSummary";

const mockUseProposalFn: jest.Mock<ReturnType<typeof useProposal>> = jest.fn();
const mockUseSelectedPatternsFn: jest.Mock<ReturnType<typeof useSelectedPatterns>> = jest.fn();

jest.mock("~/hooks/model/proposal/software", () => ({
  useProposal: () => mockUseProposalFn(),
}));

jest.mock("~/hooks/model/system/software", () => ({
  useSelectedPatterns: () => mockUseSelectedPatternsFn(),
}));

describe("SoftwareSummary", () => {
  beforeEach(() => {
    mockProgresses([]);
    mockUseProposalFn.mockReturnValue({ usedSpace: 6291456, patterns: {} }); // 6 GiB
    mockUseSelectedPatternsFn.mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the clickable 'Software' header", () => {
    installerRender(<SoftwareSummary />);
    const heading = screen.getByRole("heading");
    const link = within(heading).getByRole("link", { name: "Software" });
    expect(link).toHaveAttribute("href", expect.stringContaining(SOFTWARE.root));
  });

  describe("when software data still loading", () => {
    beforeEach(() => {
      mockProgresses([
        {
          scope: "software",
          size: 3,
          steps: [
            "Updating the list of repositories",
            "Refreshing metadata from the repositories",
            "Calculating the software proposal",
          ],
          step: "Refreshing metadata from the repositories",
          index: 2,
        },
      ]);
    });

    it("renders skeleton instead of content", () => {
      installerRender(<SoftwareSummary />);
      screen.getByLabelText("Waiting for proposal");
      expect(screen.queryByText(/Required packages/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Needs about/)).not.toBeInTheDocument();
    });
  });

  describe("when software data is loaded (no progress active)", () => {
    it("renders 'Required packages' without patterns count when no none is selected", () => {
      mockUseProposalFn.mockReturnValue({ usedSpace: 1955420, patterns: {} });
      mockUseSelectedPatternsFn.mockReturnValue([]);

      installerRender(<SoftwareSummary />);

      screen.getByText("Required packages");
      screen.getByText(/Needs about 1\.86 GiB/);
    });

    it("renders 'Required packages' and the patterns count with correct pluralization when some is selected", () => {
      mockUseProposalFn.mockReturnValue({
        usedSpace: 6239191,
        patterns: {
          yast2_server: SelectedBy.NONE,
          basic_desktop: SelectedBy.NONE,
          xfce: SelectedBy.NONE,
          gnome: SelectedBy.USER,
          yast2_desktop: SelectedBy.NONE,
          kde: SelectedBy.NONE,
          multimedia: SelectedBy.NONE,
          office: SelectedBy.NONE,
          yast2_basis: SelectedBy.AUTO,
          selinux: SelectedBy.NONE,
          apparmor: SelectedBy.NONE,
        },
      });

      mockUseSelectedPatternsFn.mockReturnValue([
        {
          name: "gnome",
          category: "Graphical Environments",
          icon: "./pattern-gnome-wayland",
          description: "The GNOME desktop environment ...",
          summary: "GNOME Desktop Environment (Wayland)",
          order: 1010,
          preselected: false,
        },
      ]);

      const { rerender } = installerRender(<SoftwareSummary />);

      // Singular
      screen.getByText("Required packages and 1 pattern");
      screen.getByText(/Needs about 5\.95 GiB/);

      mockUseSelectedPatternsFn.mockReturnValue([
        {
          name: "gnome",
          category: "Graphical Environments",
          icon: "./pattern-gnome-wayland",
          description: "The GNOME desktop environment ...",
          summary: "GNOME Desktop Environment (Wayland)",
          order: 1010,
          preselected: false,
        },
        {
          name: "yast2_basis",
          category: "Base Technologies",
          icon: "./yast",
          description: "YaST tools for basic system administration.",
          summary: "YaST Base Utilities",
          order: 1220,
          preselected: false,
        },
      ]);
      rerender(<SoftwareSummary />);

      // Plural
      screen.getByText("Required packages and 2 patterns");
      screen.getByText(/Needs about 5\.95 GiB/);
    });
  });
});
