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
import { installerRender } from "~/test-utils";
import SimpleDropdown from "./SimpleDropdown";

const mockItems = [
  { title: "Activate", onClick: jest.fn() },
  { title: "Deactivate", onClick: jest.fn() },
  { title: "Format", onClick: jest.fn(), isDanger: true },
];

describe("SimpleDropdown", () => {
  beforeEach(() => {
    mockItems.forEach((item) => item.onClick.mockClear());
  });

  it("renders the toggle button with the given label", () => {
    installerRender(<SimpleDropdown items={mockItems} label="Actions for 0.0.0160" />);
    screen.getByRole("button", { name: "Actions for 0.0.0160" });
  });

  it("does not show the menu items initially", () => {
    installerRender(<SimpleDropdown items={mockItems} label="Actions for 0.0.0160" />);
    expect(screen.queryByRole("menuitem", { name: "Activate" })).toBeNull();
  });

  it("shows the menu items when the toggle is clicked", async () => {
    const { user } = installerRender(
      <SimpleDropdown items={mockItems} label="Actions for 0.0.0160" />,
    );

    const toggle = screen.getByRole("button", { name: "Actions for 0.0.0160" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    screen.getByRole("menuitem", { name: "Activate" });
    screen.getByRole("menuitem", { name: "Deactivate" });
    screen.getByRole("menuitem", { name: "Format" });
  });

  it("shows the group label when the menu is open", async () => {
    const { user } = installerRender(
      <SimpleDropdown items={mockItems} label="Actions for 0.0.0160" />,
    );
    await user.click(screen.getByRole("button", { name: "Actions for 0.0.0160" }));
    screen.getByText("Actions for 0.0.0160");
  });

  it("calls onClick when a menu item is clicked", async () => {
    const { user } = installerRender(
      <SimpleDropdown items={mockItems} label="Actions for 0.0.0160" />,
    );
    await user.click(screen.getByRole("button", { name: "Actions for 0.0.0160" }));
    await user.click(screen.getByRole("menuitem", { name: "Activate" }));
    expect(mockItems[0].onClick).toHaveBeenCalled();
  });

  it("closes the menu after clicking an item", async () => {
    const { user } = installerRender(
      <SimpleDropdown items={mockItems} label="Actions for 0.0.0160" />,
    );
    await user.click(screen.getByRole("button", { name: "Actions for 0.0.0160" }));
    await user.click(screen.getByRole("menuitem", { name: "Activate" }));
    expect(screen.queryByRole("menuitem", { name: "Activate" })).not.toBeVisible();
  });

  it("renders danger items", async () => {
    const { user } = installerRender(
      <SimpleDropdown items={mockItems} label="Actions for 0.0.0160" />,
    );
    await user.click(screen.getByRole("button", { name: "Actions for 0.0.0160" }));
    screen.getByRole("menuitem", { name: "Format" });
  });

  describe("when custom popperProps are given", () => {
    it("uses them instead of the defaults", async () => {
      const { user } = installerRender(
        <SimpleDropdown
          items={mockItems}
          label="Actions for 0.0.0160"
          popperProps={{ position: "left" }}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Actions for 0.0.0160" }));
      screen.getByRole("menuitem", { name: "Activate" });
    });
  });
});
