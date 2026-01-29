/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { PRODUCT, ROOT, STORAGE } from "~/routes/paths";
import ReviewAndInstallButton from "./ReviewAndInstallButton";

describe("InstallButton", () => {
  describe("when not in an extended side paths", () => {
    beforeEach(() => {
      mockRoutes(STORAGE.addPartition);
    });

    it("renders the button with 'Review and install' label ", () => {
      installerRender(<ReviewAndInstallButton />);
      screen.getByRole("button", { name: "Review and install" });
    });
  });

  describe.each([
    ["overview", ROOT.root],
    ["overview (full route)", ROOT.overview],
    ["login", ROOT.login],
    ["product selection", PRODUCT.changeProduct],
    ["installation progress", ROOT.installationProgress],
    ["installation finished", ROOT.installationFinished],
    ["installation exit", ROOT.installationExit],
    ["storage progress", STORAGE.progress],
  ])(`when rendering %s screen`, (_, path) => {
    beforeEach(() => {
      mockRoutes(path);
    });

    it("renders nothing", () => {
      const { container } = installerRender(<ReviewAndInstallButton />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
