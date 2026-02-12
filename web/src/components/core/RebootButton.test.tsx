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
import { mockNavigateFn, plainRender } from "~/test-utils";
import RebootButton from "./RebootButton";

const mockFinishInstallation = jest.fn();

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  finishInstallation: () => mockFinishInstallation(),
}));

describe("RebootButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders a button with 'Reboot' label", () => {
    plainRender(<RebootButton />);
    screen.getByRole("button", { name: "Reboot" });
  });

  it("calls finishInstallation when clicked", async () => {
    const { user } = plainRender(<RebootButton />);
    const button = screen.getByRole("button", { name: "Reboot" });
    await user.click(button);
    expect(mockFinishInstallation).toHaveBeenCalled();
  });

  it("navigates to installation exit route when clicked", async () => {
    const { user } = plainRender(<RebootButton />);
    const button = screen.getByRole("button", { name: "Reboot" });
    await user.click(button);
    expect(mockNavigateFn).toHaveBeenCalledWith("/installation/exit", { replace: true });
  });

  it("accepts custom props", () => {
    plainRender(<RebootButton data-testid="custom-reboot" />);
    screen.getByTestId("custom-reboot");
  });

  it("allows overriding size and variant", () => {
    plainRender(<RebootButton size="sm" variant="secondary" />);
    const button = screen.getByRole("button", { name: "Reboot" });
    expect(button).toHaveClass("pf-m-secondary");
    expect(button).toHaveClass("pf-m-small");
  });
});
