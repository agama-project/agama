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
import { AppearanceProvider } from "~/context/appearance";
import AppearanceSettings from "~/components/core/AppearanceSettings";

const renderSelector = () =>
  plainRender(
    <AppearanceProvider>
      <AppearanceSettings />
    </AppearanceProvider>,
  );

const openSelector = async (user: ReturnType<typeof plainRender>["user"]) =>
  user.click(screen.getByRole("button", { name: "Appearance" }));

describe("AppearanceSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("applies the dark theme on the document root when Dark is selected", async () => {
    const { user } = renderSelector();
    await openSelector(user);
    await user.click(screen.getByRole("button", { name: "Dark color scheme" }));

    expect(document.documentElement).toHaveClass("pf-v6-theme-dark");
  });

  it("applies high contrast when High is selected", async () => {
    const { user } = renderSelector();
    await openSelector(user);
    await user.click(screen.getByRole("button", { name: "High contrast" }));

    expect(document.documentElement).toHaveClass("pf-v6-theme-high-contrast");
  });

  it("removes the dark theme again when switching back to Light", async () => {
    const { user } = renderSelector();
    await openSelector(user);
    await user.click(screen.getByRole("button", { name: "Dark color scheme" }));
    await user.click(screen.getByRole("button", { name: "Light color scheme" }));

    expect(document.documentElement).not.toHaveClass("pf-v6-theme-dark");
  });

  it("persists the selection so it survives a reload", async () => {
    const { user } = renderSelector();
    await openSelector(user);
    await user.click(screen.getByRole("button", { name: "Dark color scheme" }));

    expect(localStorage.getItem("agm-color-scheme")).toBe('"dark"');
  });

  it("exposes the selected option to assistive technology via aria-pressed", async () => {
    const { user } = renderSelector();
    await openSelector(user);
    await user.click(screen.getByRole("button", { name: "Dark color scheme" }));

    expect(screen.getByRole("button", { name: "Dark color scheme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Light color scheme" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("disambiguates the two Automatic options with distinct accessible names", async () => {
    const { user } = renderSelector();
    await openSelector(user);

    // getByRole throws when the name is missing or ambiguous, so resolving each
    // option by its distinct accessible name is itself the assertion.
    screen.getByRole("button", { name: "Automatic color scheme" });
    screen.getByRole("button", { name: "Automatic contrast" });
  });

  it("explains what the Automatic option does", async () => {
    const { user } = renderSelector();
    await openSelector(user);

    screen.getByText(/honors the browser and system preferences/);
  });

  describe("the visual tooltip", () => {
    it("does not add a second source for the accessible name", () => {
      renderSelector();
      const buttons = screen.getAllByRole("button", { name: "Appearance" });
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).not.toHaveAttribute("aria-describedby");
    });

    it("reveals its text on hover", async () => {
      const { user } = renderSelector();
      await user.hover(screen.getByRole("button", { name: "Appearance" }));
      await screen.findByText("Appearance");
    });
  });
});
