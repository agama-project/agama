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
import { act, screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import mockTestingPatterns from "~/components/software/patterns.test.json";
import testingProposal from "~/components/software/proposal.test.json";
import SoftwareSection from "~/components/overview/SoftwareSection";
import { SoftwareProposal } from "~/types/software";

let mockTestingProposal: SoftwareProposal;

jest.mock("~/queries/software", () => ({
  usePatterns: () => mockTestingPatterns,
  useProposal: () => mockTestingProposal,
  useProposalChanges: jest.fn(),
}));

describe("SoftwareSection", () => {
  describe("when the proposal does not have patterns to select", () => {
    beforeEach(() => {
      mockTestingProposal = { patterns: {}, size: "" };
    });

    it("renders nothing", () => {
      const { container } = installerRender(<SoftwareSection />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when the proposal has patterns to select", () => {
    beforeEach(() => {
      mockTestingProposal = testingProposal;
    });

    it("renders the required space and the selected patterns", () => {
      installerRender(<SoftwareSection />);
      screen.getByText("4.6 GiB");
      screen.getAllByText(/GNOME/);
      screen.getByText("YaST Base Utilities");
      screen.getByText("YaST Desktop Utilities");
      screen.getByText("Multimedia");
      screen.getAllByText(/Office Software/);
      expect(screen.queryByText("KDE")).toBeNull();
      expect(screen.queryByText("XFCE")).toBeNull();
      expect(screen.queryByText("YaST Server Utilities")).toBeNull();
    });
  });
});
