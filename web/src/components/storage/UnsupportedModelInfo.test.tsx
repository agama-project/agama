/*
 * Copyright (c) [2025] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import UnsupportedModelInfo from "./UnsupportedModelInfo";

const mockConfigModel = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfigModel(),
}));

const mockReset = jest.fn();

jest.mock("~/hooks/model/config/storage", () => ({
  ...jest.requireActual("~/hooks/model/config/storage"),
  useReset: () => mockReset,
}));

const seeOptions = () =>
  screen.getByRole("button", { name: "See options for the unsupported configuration" });
const popup = () => screen.getByRole("dialog", { name: "Unsupported configuration" });

describe("if there is not config model", () => {
  beforeEach(() => {
    mockConfigModel.mockReturnValue(null);
  });

  it("says in one line that the settings cannot be modified, with a way to the options", () => {
    installerRender(<UnsupportedModelInfo />);

    const line = screen.getByText(/Unable to modify the settings/);
    expect(line).toContainElement(seeOptions());
    expect(seeOptions()).toHaveTextContent("See options");
  });

  it("keeps the options out of the page until they are asked for", () => {
    installerRender(<UnsupportedModelInfo />);

    expect(screen.queryByText(/uses elements not supported/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reset/ })).not.toBeInTheDocument();
  });

  it("explains the options in a popup", async () => {
    const { user } = installerRender(<UnsupportedModelInfo />);
    await user.click(seeOptions());

    within(popup()).getByText(/uses elements not supported by this interface/);
    within(popup()).getByText(/You can proceed to install with the current settings/);
  });

  it("offers resetting the config in the popup", async () => {
    const { user } = installerRender(<UnsupportedModelInfo />);
    await user.click(seeOptions());
    await user.click(
      within(popup()).getByRole("button", { name: "Reset to the default configuration" }),
    );

    expect(mockReset).toHaveBeenCalled();
  });
});

describe("if there is config model", () => {
  beforeEach(() => {
    mockConfigModel.mockReturnValue({ drives: [] });
  });

  it("does not render an alert", () => {
    installerRender(<UnsupportedModelInfo />);
    expect(screen.queryByText(/Unable to modify the settings/)).not.toBeInTheDocument();
  });
});
