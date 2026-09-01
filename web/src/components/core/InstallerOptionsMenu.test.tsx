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
import { PRODUCT, ROOT } from "~/routes/paths";
import InstallerOptionsMenu from "./InstallerOptionsMenu";

jest.mock("~/components/core/ChangeProductOption", () => () => (
  <a role="menuitem">Change product</a>
));

// Monaco editor used in <ConfigEditor> is too heavy to render in tests
jest.mock("~/components/core/ConfigEditor", () => () => <div>ConfigEditor Mock</div>);

describe("InstallerOptionsMenu", () => {
  describe("toggle button", () => {
    it("renders a toggle with 'More options' aria-label", () => {
      installerRender(<InstallerOptionsMenu />);
      screen.getByRole("button", { name: /More options/i });
    });

    it("renders the 'More' label by default", () => {
      installerRender(<InstallerOptionsMenu />);
      expect(screen.getByRole("button", { name: /More options/i })).toHaveTextContent("More");
    });

    it("hides the 'More' label when hideLabel is true", () => {
      installerRender(<InstallerOptionsMenu hideLabel />);
      const toggle = screen.getByRole("button", { name: /More options/i });
      expect(toggle).not.toHaveTextContent("More");
    });

    it("keeps a single accessible name despite the visual tooltip", () => {
      installerRender(<InstallerOptionsMenu hideLabel />);
      // The visual-only tooltip (aria="none") must not add a second source for
      // the accessible name, so there is exactly one matching control.
      const toggles = screen.getAllByRole("button", { name: "More options" });
      expect(toggles).toHaveLength(1);
      expect(toggles[0]).not.toHaveAttribute("aria-describedby");
    });

    it("reveals the tooltip text on hover", async () => {
      const { user } = installerRender(<InstallerOptionsMenu hideLabel />);
      const toggle = screen.getByRole("button", { name: "More options" });
      await user.hover(toggle);
      // The tooltip renders its label as visible text (separate from the
      // toggle's aria-label, which is not text content).
      await screen.findByText("More options");
    });
  });

  describe("dropdown open/close behavior", () => {
    it("is closed by default", () => {
      installerRender(<InstallerOptionsMenu />);
      expect(screen.queryByRole("menu")).toBeNull();
    });

    it("opens the dropdown when the toggle is clicked", async () => {
      const { user } = installerRender(<InstallerOptionsMenu />);
      await user.click(screen.getByRole("button", { name: /More options/i }));
      screen.getByRole("menu");
    });

    it("closes the dropdown after selecting an item", async () => {
      const { user } = installerRender(<InstallerOptionsMenu />);
      await user.click(screen.getByRole("button", { name: /More options/i }));
      const menu = screen.getByRole("menu");
      await user.click(screen.getByRole("menuitem", { name: /Show configuration/i }));
      expect(menu).not.toBeVisible();
    });
  });

  describe("dropdown items", () => {
    it("renders the 'Change product' option", async () => {
      const { user } = installerRender(<InstallerOptionsMenu />);
      await user.click(screen.getByRole("button", { name: /More options/i }));
      screen.getByRole("menuitem", { name: /Change product/i });
    });

    it("does not render the 'Change product' option on the product selection page", async () => {
      mockRoutes(PRODUCT.changeProduct);
      const { user } = installerRender(<InstallerOptionsMenu />);
      await user.click(screen.getByRole("button", { name: /More options/i }));
      expect(screen.queryByRole("menuitem", { name: /Change product/i })).not.toBeInTheDocument();
    });

    it("does not render the 'Change product' option once the installation started", async () => {
      mockRoutes(ROOT.installationProgress);
      const { user } = installerRender(<InstallerOptionsMenu />);
      await user.click(screen.getByRole("button", { name: /More options/i }));
      expect(screen.queryByRole("menuitem", { name: /Change product/i })).not.toBeInTheDocument();
    });

    it("renders the 'Download config' link", async () => {
      const { user } = installerRender(<InstallerOptionsMenu />);
      await user.click(screen.getByRole("button", { name: /More options/i }));
      screen.getByRole("menuitem", { name: /Show configuration/i });
    });

    it("renders the 'Download logs' link", async () => {
      const { user } = installerRender(<InstallerOptionsMenu />);
      await user.click(screen.getByRole("button", { name: /More options/i }));
      screen.getByRole("menuitem", { name: /Download logs/i });
    });
  });
});
