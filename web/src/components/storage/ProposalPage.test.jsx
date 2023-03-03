/*
 * Copyright (c) [2022] SUSE LLC
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
import { screen, waitForElementToBeRemoved } from "@testing-library/react";
import { installerRender, mockComponent } from "~/test-utils";
import { createClient } from "~/client";
import { ProposalPage } from "~/components/storage";

const FakeProposalTargetSection = ({ calculateProposal }) => {
  return (
    <div>
      Target section
      <a href="#" onClick={calculateProposal}>Calculate</a>
    </div>
  );
};

jest.mock("~/client");
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn()
}));

jest.mock("~/components/core/SectionSkeleton", () => mockComponent("Loading proposal"));
jest.mock("~/components/storage/ProposalTargetSection", () => FakeProposalTargetSection);

jest.mock("~/components/storage/ProposalSettingsSection", () => mockComponent("Settings section"));
jest.mock("~/components/storage/ProposalActionsSection", () => mockComponent("Actions section"));

let proposal;

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      storage: {
        getProposal: jest.fn().mockResolvedValue(proposal),
        getValidationErrors: jest.fn().mockResolvedValue([]),
        calculateProposal: jest.fn().mockResolvedValue(0)
      }
    };
  });
});

describe("when there is no proposal yet", () => {
  beforeEach(() => {
    proposal = undefined;
  });

  it("renders the skeleton", async () => {
    installerRender(<ProposalPage />);

    await screen.findByText("Loading proposal");
  });
});

describe("when there is a proposal", () => {
  beforeEach(() => {
    proposal = {};
  });

  it("renders the sections", async () => {
    installerRender(<ProposalPage />);

    await waitForElementToBeRemoved(() => screen.queryByText("Loading proposal"));
    screen.getByText("Target section");
    screen.getByText("Settings section");
    screen.getByText("Actions section");
  });

  describe("and the the proposal needs to be recalculated", () => {
    it("renders the skeleton while calculating proposal", async () => {
      const { user } = installerRender(<ProposalPage />);

      const link = await screen.findByRole("link", { name: "Calculate" });
      user.click(link);

      await screen.findByText("Loading proposal");
    });

    it("renders the sections after calculating the proposal", async () => {
      const { user } = installerRender(<ProposalPage />);

      const link = await screen.findByRole("link", { name: "Calculate" });
      user.click(link);

      screen.getByText("Target section");
      screen.getByText("Settings section");
      screen.getByText("Actions section");
    });
  });
});
