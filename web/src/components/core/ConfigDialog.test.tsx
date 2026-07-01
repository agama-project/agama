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
import ConfigDialog from "./ConfigDialog";
import { plainRender } from "~/test-utils";

const mockIsoTimestamp = jest.fn();
jest.mock("~/utils", () => ({
  ...jest.requireActual("~/utils"),
  isoTimestamp: () => mockIsoTimestamp(),
}));

// Monaco editor used in <ConfigEditor> is too heavy to render in tests
jest.mock("~/components/core/ConfigEditor", () => () => <div>ConfigEditor Mock</div>);

const mockOnClose = jest.fn();
global.fetch = jest.fn();

const renderConfigDialog = () => {
  const { user } = plainRender(<ConfigDialog onClose={mockOnClose} />);
  return { user };
};

describe("ConfigDialog", () => {
  beforeEach(() => {
    mockOnClose.mockReset();
  });

  it("renders the dialog with the correct title", async () => {
    renderConfigDialog();
    await screen.findByText("ConfigEditor Mock");
    screen.getByRole("dialog", { name: "Installation settings in JSON format" });
  });

  it("calls onClose when the close button is clicked", async () => {
    const { user } = renderConfigDialog();
    await screen.findByText("ConfigEditor Mock");
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    await user.click(closeButtons[1]);
    expect(mockOnClose).toHaveBeenCalled();
  });
});
