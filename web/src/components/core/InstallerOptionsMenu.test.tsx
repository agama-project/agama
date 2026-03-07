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
import { plainRender } from "~/test-utils";
import InstallerOptionsMenu from "./InstallerOptionsMenu";

jest.mock("~/components/core/ChangeProductOption", () => () => (
  <a role="menuitem">Change product</a>
));

describe("InstallerOptionsMenu", () => {
  describe("toggle button", () => {
    it("renders a toggle with 'More installer options' aria-label", () => {
      plainRender(<InstallerOptionsMenu />);
      screen.getByRole("button", { name: /More installer options/i });
    });

    it("renders the 'More' label by default", () => {
      plainRender(<InstallerOptionsMenu />);
      expect(screen.getByRole("button", { name: /More installer options/i })).toHaveTextContent(
        "More",
      );
    });

    it("hides the 'More' label when hideLabel is true", () => {
      plainRender(<InstallerOptionsMenu hideLabel />);
      const toggle = screen.getByRole("button", { name: /More installer options/i });
      expect(toggle).not.toHaveTextContent("More");
    });
  });

  describe("dropdown open/close behavior", () => {
    it("is closed by default", () => {
      plainRender(<InstallerOptionsMenu />);
      expect(screen.queryByRole("menu")).toBeNull();
    });

    it("opens the dropdown when the toggle is clicked", async () => {
      const { user } = plainRender(<InstallerOptionsMenu />);
      await user.click(screen.getByRole("button", { name: /More installer options/i }));
      screen.getByRole("menu");
    });

    it("closes the dropdown after selecting an item", async () => {
      const { user } = plainRender(<InstallerOptionsMenu />);
      await user.click(screen.getByRole("button", { name: /More installer options/i }));
      const menu = screen.getByRole("menu");
      await user.click(screen.getByRole("menuitem", { name: /Download config/i }));
      expect(menu).not.toBeVisible();
    });
  });

  describe("dropdown items", () => {
    it("renders the 'Change product' option when showChangeProductOption is true", async () => {
      const { user } = plainRender(<InstallerOptionsMenu showChangeProductOption />);
      await user.click(screen.getByRole("button", { name: /More installer options/i }));
      screen.getByRole("menuitem", { name: /Change product/i });
    });

    it("does not render the 'Change product' option by default", async () => {
      const { user } = plainRender(<InstallerOptionsMenu />);
      await user.click(screen.getByRole("button", { name: /More installer options/i }));
      expect(screen.queryByRole("menuitem", { name: /Change product/i })).not.toBeInTheDocument();
    });

    it("renders the 'Download config' link", async () => {
      const { user } = plainRender(<InstallerOptionsMenu />);
      await user.click(screen.getByRole("button", { name: /More installer options/i }));
      const link = screen.getByRole("menuitem", { name: /Download config/i });
      expect(link).toHaveAttribute("download", "agama-config.json");
    });

    it("renders the 'Download logs' link", async () => {
      const { user } = plainRender(<InstallerOptionsMenu />);
      await user.click(screen.getByRole("button", { name: /More installer options/i }));
      const link = screen.getByRole("menuitem", { name: /Download logs/i });
      expect(link).toHaveAttribute("download", "agama-logs.tar.gz");
    });
  });
});
