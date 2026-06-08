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
    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(document.documentElement).toHaveClass("pf-v6-theme-dark");
  });

  it("applies high contrast when High is selected", async () => {
    const { user } = renderSelector();
    await openSelector(user);
    await user.click(screen.getByRole("button", { name: "High" }));

    expect(document.documentElement).toHaveClass("pf-v6-theme-high-contrast");
  });

  it("removes the dark theme again when switching back to Light", async () => {
    const { user } = renderSelector();
    await openSelector(user);
    await user.click(screen.getByRole("button", { name: "Dark" }));
    await user.click(screen.getByRole("button", { name: "Light" }));

    expect(document.documentElement).not.toHaveClass("pf-v6-theme-dark");
  });

  it("persists the selection so it survives a reload", async () => {
    const { user } = renderSelector();
    await openSelector(user);
    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(localStorage.getItem("agm-color-scheme")).toBe('"dark"');
  });
});
