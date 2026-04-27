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
import { useIsDesktopMissing, useSelectedPatterns } from "~/hooks/model/system/software";
import { useIssues } from "~/hooks/model/issue";
import { SOFTWARE } from "~/routes/paths";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import SoftwareSummary from "./SoftwareSummary";

const mockUseProposalFn: jest.Mock<ReturnType<typeof useProposal>> = jest.fn();
const mockUseSelectedPatternsFn: jest.Mock<ReturnType<typeof useSelectedPatterns>> = jest.fn();
const mockUseIsDesktopMissingFn: jest.Mock<ReturnType<typeof useIsDesktopMissing>> = jest.fn();
const mockUseIssuesFn: jest.Mock<ReturnType<typeof useIssues>> = jest.fn();

jest.mock("~/hooks/model/proposal/software", () => ({
  useProposal: () => mockUseProposalFn(),
}));

jest.mock("~/hooks/model/system/software", () => ({
  useSelectedPatterns: () => mockUseSelectedPatternsFn(),
  useIsDesktopMissing: () => mockUseIsDesktopMissingFn(),
}));

jest.mock("~/hooks/model/issue", () => ({
  ...jest.requireActual("~/hooks/model/issue"),
  useIssues: () => mockUseIssuesFn(),
}));

const gnome = {
  name: "gnome",
  category: "Graphical Environments",
  icon: "./pattern-gnome-wayland",
  description: "The GNOME desktop environment ...",
  summary: "GNOME Desktop",
  order: 1010,
  preselected: false,
  desktop: true,
};

const yast2Basis = {
  name: "yast2_basis",
  category: "Base Technologies",
  icon: "./yast",
  description: "YaST tools for basic system administration.",
  summary: "YaST Base Utilities",
  order: 1220,
  preselected: false,
  desktop: false,
};

describe("SoftwareSummary", () => {
  beforeEach(() => {
    mockProgresses([]);
    mockUseIssuesFn.mockReturnValue([]);
    mockUseProposalFn.mockReturnValue({ usedSpace: 6239191, patterns: {} }); // ~5.95 GiB
    mockUseSelectedPatternsFn.mockReturnValue([]);
    mockUseIsDesktopMissingFn.mockReturnValue(false);
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
      expect(screen.queryByText(/Requires/)).not.toBeInTheDocument();
    });
  });

  describe("when software data is loaded (no progress active)", () => {
    describe("but there are issues", () => {
      beforeEach(() => {
        mockUseIssuesFn.mockReturnValue([
          {
            description: "Fake Issue",
            class: "generic",
            details: "Fake Issue details",
            scope: "software",
          },
        ]);
      });

      it("renders `Invalid software selection` text", () => {
        installerRender(<SoftwareSummary />);

        screen.getByText("Invalid software selection");
        expect(screen.queryByText(/Requires/)).toBeNull();
      });
    });

    describe("and no desktop context applies", () => {
      it("shows 'Default selection' as the headline when nothing is selected", () => {
        mockUseProposalFn.mockReturnValue({ usedSpace: 1955420, patterns: {} });
        mockUseSelectedPatternsFn.mockReturnValue([]);

        installerRender(<SoftwareSummary />);

        screen.getByText("Default selection");
        screen.getByText("Requires 1.86 GiB");
      });

      it("shows the patterns count as the headline when patterns are selected", () => {
        mockUseSelectedPatternsFn.mockReturnValue([yast2Basis]);

        const { rerender } = installerRender(<SoftwareSummary />);

        // Singular
        screen.getByText("Using 1 additional pattern");
        screen.getByText("Requires 5.95 GiB");

        mockUseSelectedPatternsFn.mockReturnValue([
          yast2Basis,
          { ...yast2Basis, name: "selinux", summary: "SELinux" },
        ]);
        rerender(<SoftwareSummary />);

        // Plural
        screen.getByText("Using 2 additional patterns");
        screen.getByText("Requires 5.95 GiB");
      });

      it("falls back to 'Default selection' without a summary description when the proposal size is not available", () => {
        mockUseProposalFn.mockReturnValue({ usedSpace: 0, patterns: {} });
        mockUseSelectedPatternsFn.mockReturnValue([]);

        installerRender(<SoftwareSummary />);

        screen.getByText("Default selection");
        expect(screen.queryByText(/Requires/)).toBeNull();
      });
    });

    describe("and a desktop is selected", () => {
      it("shows the desktop as the headline and size as the summary description", () => {
        mockUseSelectedPatternsFn.mockReturnValue([gnome]);

        installerRender(<SoftwareSummary />);

        screen.getByText("GNOME Desktop");
        screen.getByText("Requires 5.95 GiB");
        expect(screen.queryByText(/additional pattern/)).toBeNull();
      });

      it("counts only non-desktop patterns in the summary description", () => {
        mockUseSelectedPatternsFn.mockReturnValue([gnome, yast2Basis]);

        installerRender(<SoftwareSummary />);

        screen.getByText("GNOME Desktop");
        screen.getByText("Includes 1 additional pattern. Requires 5.95 GiB");
      });

      it("shows the desktop count when several are selected", () => {
        mockUseSelectedPatternsFn.mockReturnValue([
          gnome,
          { ...gnome, name: "kde", summary: "KDE Plasma" },
        ]);

        installerRender(<SoftwareSummary />);

        screen.getByText("2 desktops selected");
        expect(screen.queryByText("GNOME Desktop")).toBeNull();
        expect(screen.queryByText("KDE Plasma")).toBeNull();
        screen.getByText("Requires 5.95 GiB");
        expect(screen.queryByText(/additional pattern/)).toBeNull();
      });
    });

    describe("and the missing-desktop hint is active", () => {
      beforeEach(() => {
        mockUseIsDesktopMissingFn.mockReturnValue(true);
      });

      it("shows 'No desktop selected' as the headline and size as the summary description", () => {
        mockUseSelectedPatternsFn.mockReturnValue([]);

        installerRender(<SoftwareSummary />);

        expect(screen.getByText("No desktop selected")).toHaveClass(textStyles.fontWeightBold);
        screen.getByText("Requires 5.95 GiB");
      });

      it("takes precedence over any other non-desktop selection", () => {
        mockUseSelectedPatternsFn.mockReturnValue([yast2Basis]);

        installerRender(<SoftwareSummary />);

        expect(screen.getByText("No desktop selected")).toHaveClass(textStyles.fontWeightBold);
        screen.getByText("Includes 1 additional pattern. Requires 5.95 GiB");
      });
    });
  });
});
