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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import UnsupportedModelInfo from "./UnsupportedModelInfo";
import { useStorageModel } from "~/hooks/api/storage";
import { useReset } from "~/hooks/api/config/storage";

jest.mock("~/hooks/api/storage");
jest.mock("~/hooks/api/config/storage");

const mockedUseStorageModel = useStorageModel as jest.Mock;
const mockedUseReset = useReset as jest.Mock;

beforeEach(() => {
  mockedUseReset.mockReturnValue(jest.fn());
});

describe("if there is not a model", () => {
  beforeEach(() => {
    mockedUseStorageModel.mockReturnValue(null);
  });

  it("renders an alert", () => {
    plainRender(<UnsupportedModelInfo />);
    expect(screen.queryByText(/Unable to modify the settings/)).toBeInTheDocument();
  });

  it("renders a button for resetting the config", () => {
    plainRender(<UnsupportedModelInfo />);
    expect(screen.queryByRole("button", { name: /Reset/ })).toBeInTheDocument();
  });
});

describe("if there is a model", () => {
  beforeEach(() => {
    mockedUseStorageModel.mockReturnValue({ drives: [] });
  });

  it("does not renders an alert", () => {
    plainRender(<UnsupportedModelInfo />);
    expect(screen.queryByText(/settings cannot be edited/)).not.toBeInTheDocument();
  });

  it("does not render a button for resetting the config", () => {
    plainRender(<UnsupportedModelInfo />);
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });
});
