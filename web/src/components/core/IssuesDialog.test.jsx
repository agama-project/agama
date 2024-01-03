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
import { act, screen, waitFor, within } from "@testing-library/react";
import { installerRender, createCallbackMock } from "~/test-utils";
import { createClient } from "~/client";
import { IssuesDialog } from "~/components/core";

jest.mock("~/client");
jest.mock("@patternfly/react-core", () => {
  return {
    ...jest.requireActual("@patternfly/react-core"),
    Skeleton: () => <div>PFSkeleton</div>
  };
});
jest.mock("~/components/core/Sidebar", () => () => <div>Agama sidebar</div>);

const issues = {
  product: [],
  storage: [
    { description: "storage issue 1", details: "Details 1", source: "system", severity: "warn" },
    { description: "storage issue 2", details: "Details 2", source: "config", severity: "error" }
  ],
  software: [
    { description: "software issue 1", details: "Details 1", source: "system", severity: "warn" }
  ]
};

let mockIssues;

let mockOnIssuesChange;

beforeEach(() => {
  mockIssues = { ...issues };
  mockOnIssuesChange = jest.fn();

  createClient.mockImplementation(() => {
    return {
      issues: jest.fn().mockResolvedValue(mockIssues),
      onIssuesChange: mockOnIssuesChange
    };
  });
});

it("loads the issues", async () => {
  installerRender(<IssuesDialog />);

  screen.getAllByText(/PFSkeleton/);
  await screen.findByText(/storage issue 1/);
});

it("renders sections with issues", async () => {
  installerRender(<IssuesDialog />);

  await waitFor(() => expect(screen.queryByText("Product")).not.toBeInTheDocument());

  const storageSection = await screen.findByText(/Storage/);
  within(storageSection).findByText(/storage issue 1/);
  within(storageSection).findByText(/storage issue 2/);

  const softwareSection = await screen.findByText(/Software/);
  within(softwareSection).findByText(/software issue 1/);
});

describe("if there are not issues", () => {
  beforeEach(() => {
    mockIssues = { product: [], storage: [], software: [] };
  });

  it("renders a success message", async () => {
    installerRender(<IssuesDialog />);

    await screen.findByText(/No issues found/);
  });
});

describe("if the issues change", () => {
  it("shows the new issues", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    mockOnIssuesChange = mockFunction;

    installerRender(<IssuesDialog />);

    await screen.findByText("Storage");

    mockIssues.storage = [];
    act(() => callbacks.forEach(c => c({ storage: mockIssues.storage })));

    await waitFor(() => expect(screen.queryByText("Storage")).not.toBeInTheDocument());
    const softwareSection = await screen.findByText(/Software/);
    within(softwareSection).findByText(/software issue 1/);
  });
});
