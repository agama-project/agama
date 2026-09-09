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
import { installerRender, mockRoutes } from "~/test-utils";
import ResultSheet from "~/components/storage/storage-page/ResultSheet";

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useFlattenDevices: () => [],
}));

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useFlattenDevices: () => [],
  useActions: () => [],
}));

jest.mock("~/components/storage/ProposalActions", () => () => <div>every change, in order</div>);
jest.mock("~/components/storage/ProposalResultTable", () => () => <div>the machine after</div>);

describe("ResultSheet", () => {
  it("offers what the installer will do and what it leaves behind", () => {
    installerRender(<ResultSheet />);

    screen.getByRole("tab", { name: "Actions" });
    screen.getByRole("tab", { name: "Final layout" });
  });

  it("opens on what the installer will do", () => {
    installerRender(<ResultSheet />);

    screen.getByText("every change, in order");
  });

  it("opens on the half the address names", () => {
    mockRoutes("/storage?sheet=result&sheetTab=layout");
    installerRender(<ResultSheet />);

    screen.getByText("the machine after");
  });
});
