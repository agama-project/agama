/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import testingPatterns from "./patterns.test.json";
import testingProposal from "./proposal.test.json";
import SoftwarePage from "./SoftwarePage";

const mockProposal = jest.fn();

const desktops = testingPatterns.filter((p) => p.desktop);
const other = testingPatterns.filter((p) => !p.desktop);

jest.mock("~/components/layout/Header", () => () => <div>Header Mock</div>);
jest.mock("~/components/questions/Questions", () => () => <div>Questions Mock</div>);

jest.mock("~/hooks/model/issue", () => ({
  useIssues: () => [],
}));

jest.mock("~/hooks/model/proposal/software", () => ({
  useProposal: () => mockProposal(),
}));

jest.mock("~/hooks/model/system/software", () => ({
  useAvailablePatterns: () => ({
    all: testingPatterns,
    desktops,
    other,
  }),
}));

describe("SoftwarePage", () => {
  beforeEach(() => {
    mockProposal.mockReturnValue(testingProposal);
  });

  it("renders the Desktops section with the selected desktop", () => {
    installerRender(<SoftwarePage />);
    screen.getByText("Desktops");
    screen.getByText("GNOME Desktop Environment (Wayland)");
    expect(screen.queryByText("KDE Applications and Plasma 5 Desktop")).toBeNull();
    expect(screen.queryByText("XFCE Desktop Environment")).toBeNull();
  });

  it("renders the Additional patterns section with selected patterns", () => {
    installerRender(<SoftwarePage />);
    screen.getByText("Additional patterns");
    screen.getByText("YaST Base Utilities");
    screen.getByText("YaST Desktop Utilities");
    screen.getByText("Multimedia");
    screen.getByText("Office Software");
    expect(screen.queryByText("YaST Server Utilities")).toBeNull();
  });

  it("renders the summary including the selection context", () => {
    installerRender(<SoftwarePage />);
    screen.getByText(/Required space with current selection/);
    screen.getByText("4.60 GiB");
  });

  it("renders the summary without selection context when nothing is selected", () => {
    const proposalWithNoPatterns = {
      ...testingProposal,
      patterns: Object.fromEntries(Object.keys(testingProposal.patterns).map((k) => [k, "none"])),
    };
    mockProposal.mockReturnValue(proposalWithNoPatterns);

    installerRender(<SoftwarePage />);
    screen.getByText(/Required space:/);
    expect(screen.queryByText(/with current selection/)).toBeNull();
  });

  it("renders buttons for navigating to patterns selection", () => {
    installerRender(<SoftwarePage />);
    screen.getByRole("link", { name: "Change patterns" });
    // 1 desktop selected — singular form
    screen.getByRole("link", { name: "Change desktop" });
  });

  it("shows selection counter when patterns are selected", () => {
    installerRender(<SoftwarePage />);
    // 1 desktop selected out of 4 available
    screen.getByText(/1 of 4 selected/);
    // 4 other patterns selected out of 5 available
    screen.getByText(/4 of 5 selected/);
  });

  it("hides selection counter when no patterns are selected", () => {
    const proposalWithNoDesktop = {
      ...testingProposal,
      patterns: { ...testingProposal.patterns, gnome: "none" },
    };
    mockProposal.mockReturnValue(proposalWithNoDesktop);

    installerRender(<SoftwarePage />);
    expect(screen.queryByText(/0 of 4 selected/)).toBeNull();
  });

  it("shows auto selected label for automatically selected patterns", () => {
    installerRender(<SoftwarePage />);
    const baseUtilities = screen.getByText("YaST Base Utilities").closest("li");
    const desktopUtilities = screen.getByText("YaST Desktop Utilities").closest("li");
    const officeSoftware = screen.getByText("Office Software").closest("li");
    const multimedia = screen.getByText("Multimedia").closest("li");

    expect(baseUtilities).toHaveTextContent("auto selected");
    expect(desktopUtilities).toHaveTextContent("auto selected");
    expect(officeSoftware).toHaveTextContent("auto selected");
    expect(multimedia).toHaveTextContent("auto selected");
  });

  it("does not show auto selected label for user-selected patterns", () => {
    installerRender(<SoftwarePage />);
    const gnomeDesktop = screen.getByText("GNOME Desktop Environment (Wayland)").closest("li");
    expect(gnomeDesktop).not.toHaveTextContent("auto selected");
  });

  it("does not render patterns marked as removed", () => {
    const proposalWithRemovedPattern = {
      ...testingProposal,
      patterns: { ...testingProposal.patterns, multimedia: "removed" },
    };
    mockProposal.mockReturnValue(proposalWithRemovedPattern);

    installerRender(<SoftwarePage />);
    expect(screen.queryByText("Multimedia")).toBeNull();
  });

  it("shows empty state when no desktop is selected", () => {
    const proposalWithNoDesktop = {
      ...testingProposal,
      patterns: { ...testingProposal.patterns, gnome: "none" },
    };
    mockProposal.mockReturnValue(proposalWithNoDesktop);

    installerRender(<SoftwarePage />);
    screen.getByText("None selected");
    screen.getByText("Select a desktop environment to get a graphical interface.");
    screen.getByRole("link", { name: "Select a desktop" });
  });

  it("shows empty state when no additional patterns are selected", () => {
    const proposalWithNoPatterns = {
      ...testingProposal,
      patterns: {
        gnome: "user",
        yast2_basis: "none",
        yast2_desktop: "none",
        multimedia: "none",
        office: "none",
      },
    };
    mockProposal.mockReturnValue(proposalWithNoPatterns);

    installerRender(<SoftwarePage />);
    screen.getByText("None selected");
    screen.getByText("Select one or more to extend the system.");
    screen.getByRole("link", { name: "Select patterns" });
  });

  it("uses plural button label when multiple desktops are selected", () => {
    const proposalWithMultipleDesktops = {
      ...testingProposal,
      patterns: { ...testingProposal.patterns, kde: "user" },
    };
    mockProposal.mockReturnValue(proposalWithMultipleDesktops);

    installerRender(<SoftwarePage />);
    screen.getByRole("link", { name: "Change desktops" });
  });

  describe("when there is no proposal yet", () => {
    beforeEach(() => {
      mockProposal.mockReturnValue(null);
    });

    it("renders an informative message", () => {
      installerRender(<SoftwarePage />);
      screen.getByText("No information available yet");
    });
  });
});
