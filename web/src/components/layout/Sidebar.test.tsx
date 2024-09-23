/*
 * Copyright (c) [2024] SUSE LLC
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
import Sidebar from "./Sidebar";

jest.mock("~/components/core/About", () => () => <div>About Mock</div>);
jest.mock("~/components/core/LogsButton", () => () => <div>LogsButton Mock</div>);
jest.mock("~/components/core/ChangeProductLink", () => () => <div>ChangeProductLink Mock</div>);

jest.mock("~/router", () => ({
  rootRoutes: () => [
    { path: "/", handle: { name: "Main" } },
    { path: "/l10n", handle: { name: "L10n" } },
    { path: "/hidden" },
  ],
}));

describe("Sidebar", () => {
  it("renders a navigation on top of root routes with handle object", () => {
    installerRender(<Sidebar />);
    const mainNavigation = screen.getByRole("navigation");
    const mainNavigationLinks = within(mainNavigation).getAllByRole("link");
    expect(mainNavigationLinks.length).toBe(2);
    screen.getByRole("link", { name: "Main" });
    screen.getByRole("link", { name: "L10n" });
  });

  it("mounts core/About component", () => {
    installerRender(<Sidebar />);
    screen.getByText("About Mock");
  });

  it("mounts core/LogsButton component", () => {
    installerRender(<Sidebar />);
    screen.getByText("LogsButton Mock");
  });

  it("mounts core/ChangeProductLink component", () => {
    installerRender(<Sidebar />);
    screen.getByText("ChangeProductLink Mock");
  });
});
