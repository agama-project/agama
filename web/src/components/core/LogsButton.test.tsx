/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { LogsButton } from "~/components/core";

const executor = jest.fn();
const fetchLogsFn = jest.fn();

jest.mock("~/api/manager", () => ({
  ...jest.requireActual("~/api/manager"),
  fetchLogs: () => fetchLogsFn(),
}));

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation();
  window.URL.createObjectURL = jest.fn(() => "fake-blob-url");
  window.URL.revokeObjectURL = jest.fn();

  fetchLogsFn.mockImplementation(() => new Promise(executor));
});

afterAll(() => {
  jest.restoreAllMocks(); // <-- it restore all spies
  (window.URL.createObjectURL as jest.Mock).mockRestore();
  (window.URL.revokeObjectURL as jest.Mock).mockRestore();
});

describe("LogsButton", () => {
  it("renders a link for downloading logs", () => {
    installerRender(<LogsButton />);
    screen.getByRole("link", { name: "Download logs" });
  });
});
