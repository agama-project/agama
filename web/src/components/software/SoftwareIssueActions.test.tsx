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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import SoftwareIssueActions from "./SoftwareIssueActions";

const mockProbeAction = jest.fn();
jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  probeAction: (only) => mockProbeAction(only),
}));

const mockUseProgressTracking = jest.fn();
jest.mock("~/hooks/use-progress-tracking", () => ({
  useProgressTracking: (...args) => mockUseProgressTracking(...args),
}));

beforeEach(() => {
  mockProbeAction.mockClear();
  mockUseProgressTracking.mockReturnValue({ loading: false, progress: undefined });
});

it("offers a link to the network settings", () => {
  installerRender(<SoftwareIssueActions />);
  const link = screen.getByRole("link", { name: "Go to network settings" });
  expect(link).toHaveAttribute("href", "/network");
});

it("reads the software information again when reloading", async () => {
  const { user } = installerRender(<SoftwareIssueActions />);
  await user.click(screen.getByRole("button", { name: /Reload/ }));
  expect(mockProbeAction).toHaveBeenCalledWith(["software"]);
});

describe("while the software information is being read", () => {
  beforeEach(() => {
    mockUseProgressTracking.mockReturnValue({ loading: true, progress: undefined });
  });

  it("does not allow reading it again", async () => {
    const { user } = installerRender(<SoftwareIssueActions />);
    const button = screen.getByRole("button", { name: /Reload/ });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(mockProbeAction).not.toHaveBeenCalled();
  });

  it("still allows going to the network settings", () => {
    installerRender(<SoftwareIssueActions />);
    screen.getByRole("link", { name: "Go to network settings" });
  });
});
