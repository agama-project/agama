/*
 * Copyright (c) [2023-2024] SUSE LLC
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
import { createClient } from "~/client";
import { IssuesDialog } from "~/components/core";

jest.mock("~/client");
jest.mock("@patternfly/react-core", () => {
  return {
    ...jest.requireActual("@patternfly/react-core"),
    Skeleton: () => <div>PFSkeleton</div>
  };
});

const issues = {
  product: [],
  storage: [
    { description: "storage issue 1", details: "Details 1", source: "system", severity: "warn" },
    { description: "storage issue 2", details: null, source: "config", severity: "error" }
  ],
  software: [
    { description: "software issue 1", details: "Details 1", source: "system", severity: "warn" }
  ]
};

let mockIssues;

beforeEach(() => {
  mockIssues = { ...issues };

  createClient.mockImplementation(() => {
    return {
      issues: jest.fn().mockResolvedValue(mockIssues),
      onIssuesChange: jest.fn()
    };
  });
});

it("loads the issues", async () => {
  installerRender(<IssuesDialog isOpen sectionId="storage" title="Storage issues" />);

  await screen.findByText(/storage issue 1/);
  await screen.findByText(/storage issue 2/);
});

it('calls onClose callback when close button is clicked', async () => {
  const mockOnClose = jest.fn();
  const { user } = installerRender(<IssuesDialog isOpen onClose={mockOnClose} sectionId="software" title="Software issues" />);

  await user.click(screen.getByText("Close"));
  expect(mockOnClose).toHaveBeenCalled();
});
