/*
 * Copyright (c) [2023] SUSE LLC
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
import testingPatterns from "./patterns.test.json";
import testingProposal from "./proposal.test.json";
import SoftwarePage from "./SoftwarePage";

const onProposalChangesMock = jest.fn();

jest.mock("~/queries/issues", () => ({
  useIssues: () => [],
}));

jest.mock("~/queries/software", () => ({
  usePatterns: () => testingPatterns,
  useProposal: () => testingProposal,
  useProposalChanges: () => onProposalChangesMock(),
}));

describe("SoftwarePage", () => {
  it("renders a list of selected patterns", () => {
    installerRender(<SoftwarePage />);
    screen.getAllByText(/GNOME/);
    screen.getByText("YaST Base Utilities");
    screen.getByText("YaST Desktop Utilities");
    screen.getByText("Multimedia");
    screen.getAllByText(/Office software/);
    expect(screen.queryByText("KDE")).toBeNull();
    expect(screen.queryByText("XFCE")).toBeNull();
    expect(screen.queryByText("YaST Server Utilities")).toBeNull();
  });

  it("renders amount of size selected product and patterns will need", () => {
    installerRender(<SoftwarePage />);
    screen.getByText("Installation will take 4.6 GiB.");
  });

  it("renders a button for navigating to patterns selection", () => {
    installerRender(<SoftwarePage />);
    screen.getByRole("link", { name: "Change selection" });
  });

  it.skip("listen proposal sofware proposal changes", () => {
    installerRender(<SoftwarePage />);
    // act(() => triggerTheExpectedEvent());
    // expect(onProposalChangesMock).toHaveBeenCalled();
  });
});
