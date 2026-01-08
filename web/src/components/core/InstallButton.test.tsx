/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { screen, waitFor, within } from "@testing-library/react";
import { installerRender, mockRoutes } from "~/test-utils";
import { InstallButton } from "~/components/core";
import { PRODUCT, ROOT } from "~/routes/paths";
import type { Issue } from "~/model/issue";

const mockStartInstallationFn = jest.fn();

jest.mock("~/model/manager", () => ({
  ...jest.requireActual("~/model/manager"),
  startInstallation: () => mockStartInstallationFn(),
}));

const mockIssues = jest.fn();

jest.mock("~/hooks/model/issue", () => ({
  ...jest.requireActual("~/hooks/model/issue"),
  useIssues: () => mockIssues(),
}));

describe("InstallButton", () => {
  describe("when there are installation issues", () => {
    beforeEach(() => {
      mockIssues.mockReturnValue([
        {
          description: "Fake Issue",
          class: "generic",
          details: "Fake Issue details",
          scope: "product",
        },
      ] as Issue[]);
    });

    it("renders additional information to warn users about found problems", async () => {
      const { user, container } = installerRender(<InstallButton />);
      const button = screen.getByRole("button", { name: /Install/ });
      // An exlamation icon as visual mark
      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("data-icon-name", "error_fill");
      await user.hover(button);
      screen.getByRole("tooltip", { name: /Not possible with the current setup/ });
    });

    it("triggers the onClickWithIssues callback", async () => {
      const onClickWithIssuesFn = jest.fn();
      const { user } = installerRender(<InstallButton onClickWithIssues={onClickWithIssuesFn} />);
      const button = screen.getByRole("button", { name: /Install/ });
      await user.click(button);
      expect(onClickWithIssuesFn).toHaveBeenCalled();
    });
  });

  describe("when there are not installation issues", () => {
    beforeEach(() => {
      mockIssues.mockReturnValue([]);
    });

    it("renders the button without any additional information", async () => {
      const { user, container } = installerRender(<InstallButton />);
      const button = screen.getByRole("button", { name: "Install" });
      // Renders nothing else
      const icon = container.querySelector("svg");
      expect(icon).toBeNull();
      await user.hover(button);
      expect(
        screen.queryByRole("tooltip", { name: /Not possible with the current setup/ }),
      ).toBeNull();
    });

    describe.each([
      ["login", ROOT.login],
      ["product selection", PRODUCT.changeProduct],
      ["product selection progress", PRODUCT.progress],
      ["installation progress", ROOT.installationProgress],
      ["installation finished", ROOT.installationFinished],
    ])(`but the installer is rendering the %s screen`, (_, path) => {
      beforeEach(() => {
        mockRoutes(path);
      });

      it("renders nothing", () => {
        const { container } = installerRender(<InstallButton />);
        expect(container).toBeEmptyDOMElement();
      });
    });
  });
});
