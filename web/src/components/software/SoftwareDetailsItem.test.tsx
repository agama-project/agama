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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useSelectedPatterns } from "~/hooks/model/system/software";
import SoftwareDetailsItem from "./SoftwareDetailsItem";
import { useProgressTracking } from "~/hooks/use-progress-tracking";
import { useProposal } from "~/hooks/model/proposal/software";
import { SelectedBy } from "~/model/proposal/software";

let mockUseProgressTrackingFn: jest.Mock<ReturnType<typeof useProgressTracking>> = jest.fn();
let mockUseProposalFn: jest.Mock<ReturnType<typeof useProposal>> = jest.fn();
let mockUseSelectedPatternsFn: jest.Mock<ReturnType<typeof useSelectedPatterns>> = jest.fn();

jest.mock("~/hooks/model/system/software", () => ({
  ...jest.requireActual("~/hooks/model/system/software"),
  useSelectedPatterns: () => mockUseSelectedPatternsFn(),
}));

jest.mock("~/hooks/model/proposal/software", () => ({
  ...jest.requireActual("~/hooks/model/proposal/software"),
  useProposal: () => mockUseProposalFn(),
}));

jest.mock("~/hooks/use-progress-tracking", () => ({
  ...jest.requireActual("~/hooks/use-progress-tracking"),
  useProgressTracking: () => mockUseProgressTrackingFn(),
}));

describe("SoftwareDetailsItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("when software data is still loading", () => {
    beforeEach(() => {
      mockUseProgressTrackingFn.mockReturnValue({
        loading: true,
        progress: {
          index: 1,
          scope: "software",
          size: 3,
          steps: ["one", "two", "three"],
          step: "two",
        },
      });
    });

    it("renders skeletons instead of content", () => {
      mockUseProposalFn.mockReturnValue({ usedSpace: 0, patterns: {} });
      mockUseSelectedPatternsFn.mockReturnValue([]);

      installerRender(<SoftwareDetailsItem />);

      screen.queryByText(/Software/);
      screen.queryByText("Waiting for proposal"); // Skeleton aria-label
      expect(screen.queryByText(/Needs about/)).not.toBeInTheDocument();
    });
  });

  describe("when software data is loaded (no progress active)", () => {
    beforeEach(() => {
      mockUseProgressTrackingFn.mockReturnValue({
        loading: false,
        progress: undefined,
      });
    });

    it("renders 'Required packages' without patterns count when no none is selected", () => {
      mockUseProposalFn.mockReturnValue({ usedSpace: 1955420, patterns: {} });
      mockUseSelectedPatternsFn.mockReturnValue([]);

      installerRender(<SoftwareDetailsItem />);

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

      const { rerender } = installerRender(<SoftwareDetailsItem />);

      // Singular
      expect(screen.getByText("Required packages and 1 pattern")).toBeInTheDocument();
      expect(screen.getByText(/Needs about 5\.95 GiB/i)).toBeInTheDocument();

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
      rerender(<SoftwareDetailsItem />);

      // Plural
      expect(screen.getByText("Required packages and 2 patterns")).toBeInTheDocument();
      expect(screen.getByText(/Needs about 5\.95 GiB/i)).toBeInTheDocument();
    });
  });
});
