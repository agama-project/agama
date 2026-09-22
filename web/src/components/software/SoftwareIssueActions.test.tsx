/*
 * Copyright (c) [2026] SUSE LLC
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
import { screen, waitFor } from "@testing-library/react";
import { installerRender, mockProgresses } from "~/test-utils";
import SoftwareIssueActions from "./SoftwareIssueActions";

import type { Progress } from "~/model/status";

const mockProbeAction = jest.fn();
jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  probeAction: (only) => mockProbeAction(only),
}));

const readingRepositories: Progress = {
  scope: "software",
  step: "Refreshing metadata from the repositories",
  steps: [],
  index: 2,
  size: 3,
};

beforeEach(() => {
  mockProbeAction.mockClear();
  mockProgresses([]);
});

it("offers a link to the network settings", () => {
  installerRender(<SoftwareIssueActions />);
  const link = screen.getByRole("link", { name: "Go to network settings" });
  expect(link).toHaveAttribute("href", "/network");
});

it("reads the software information again when reloading", async () => {
  const { user } = installerRender(<SoftwareIssueActions />);
  await user.click(screen.getByRole("button", { name: /Try again/ }));
  expect(mockProbeAction).toHaveBeenCalledWith(["software"]);
});

describe("while the software information is being read", () => {
  beforeEach(() => {
    mockProgresses([readingRepositories]);
  });

  it("does not allow reading it again", async () => {
    const { user } = installerRender(<SoftwareIssueActions />);
    const button = screen.getByRole("button", { name: /Try again/ });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(mockProbeAction).not.toHaveBeenCalled();
  });

  it("keeps showing where to review the network settings", () => {
    installerRender(<SoftwareIssueActions />);
    screen.getByRole("link", { name: "Go to network settings" });
  });
});

describe("when reading finishes without solving the problem", () => {
  it("allows trying again", async () => {
    mockProgresses([readingRepositories]);
    const { rerender } = installerRender(<SoftwareIssueActions />);
    expect(screen.getByRole("button", { name: /Try again/ })).toBeDisabled();

    // Reading is over, but it found the same issues as before, so nothing else
    // is fetched afterwards. The actions must not stay waiting for that.
    mockProgresses([]);
    rerender(<SoftwareIssueActions />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Try again/ })).toBeEnabled());
  });
});
