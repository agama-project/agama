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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import type { Issue } from "~/model/issue";
import FixableConfigInfo from "~/components/storage/FixableConfigInfo";

const issue = (description: string): Issue => ({
  description,
  class: "configNoRoot",
  scope: "storage",
});

const showIssues = () => screen.getByRole("button", { name: "Show issues…" });

describe("FixableConfigInfo", () => {
  it("says the configuration cannot be installed, with a way to see why", () => {
    installerRender(<FixableConfigInfo issues={[issue("No root"), issue("No swap")]} />);

    screen.getByText("Warning alert:");
    screen.getByText("The configuration is not valid to install the system");
    showIssues();
  });

  it("keeps the issues out of the page until they are asked for", () => {
    installerRender(<FixableConfigInfo issues={[issue("No root")]} />);

    expect(screen.queryByText("No root")).not.toBeInTheDocument();
  });

  it("lists the issues in a popup", async () => {
    const { user } = installerRender(
      <FixableConfigInfo issues={[issue("No root"), issue("No swap")]} />,
    );
    await user.click(showIssues());

    const popup = screen.getByRole("dialog", { name: "Invalid storage configuration" });
    within(popup).getByText("The configuration must be adapted to address the following issues.");
    const items = within(popup)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items).toEqual(["No root", "No swap"]);
  });

  it("uses the singular for a single issue", async () => {
    const { user } = installerRender(<FixableConfigInfo issues={[issue("No root")]} />);
    await user.click(showIssues());

    screen.getByText("The configuration must be adapted to address the following issue.");
  });
});
