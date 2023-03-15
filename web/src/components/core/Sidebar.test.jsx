/*
 * Copyright (c) [2022-2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { plainRender, mockComponent, mockLayout } from "~/test-utils";
import { PageOptions, Sidebar } from "~/components/core";

jest.mock("~/components/layout/Layout", () => mockLayout());
jest.mock("~/components/core/PageOptions", () => mockComponent(
  <>
    <a href="#">Goes somewhere</a>
    <a href="#" data-keep-sidebar-open="true">Keep it open!</a>
    <button>Do something</button>
    <button data-keep-sidebar-open="true">Keep it open!</button>
  </>
));

it("renders the sidebar initially hidden", async () => {
  plainRender(<Sidebar />);
  const nav = await screen.findByRole("navigation", { name: /options/i });
  expect(nav).toHaveAttribute("data-state", "hidden");
});

it("renders a link for displaying the sidebar", async () => {
  const { user } = plainRender(<Sidebar><PageOptions /></Sidebar>);

  const link = await screen.findByLabelText(/Show/i);
  const nav = await screen.findByRole("navigation", { name: /options/i });

  expect(nav).toHaveAttribute("data-state", "hidden");
  await user.click(link);
  expect(nav).toHaveAttribute("data-state", "visible");
});

it("renders a link for hiding the sidebar", async () => {
  const { user } = plainRender(<Sidebar><PageOptions /></Sidebar>);

  const openLink = await screen.findByLabelText(/Show/i);
  const closeLink = await screen.findByLabelText(/Hide/i);

  const nav = await screen.findByRole("navigation", { name: /options/i });

  await user.click(openLink);
  expect(nav).toHaveAttribute("data-state", "visible");
  await user.click(closeLink);
  expect(nav).toHaveAttribute("data-state", "hidden");
});

it("moves the focus to the close action after opening it", async () => {
  const { user } = plainRender(<Sidebar><PageOptions /></Sidebar>);

  const openLink = await screen.findByLabelText(/Show/i);
  const closeLink = await screen.findByLabelText(/Hide/i);

  expect(closeLink).not.toHaveFocus();
  await user.click(openLink);
  expect(closeLink).toHaveFocus();
});

describe("onClick bubbling", () => {
  it("hides the sidebar only if the user clicked on a link or button w/o keepSidebarOpen attribute", async () => {
    const { user } = plainRender(<Sidebar><PageOptions /></Sidebar>);
    const openLink = screen.getByLabelText(/Show/i);
    await user.click(openLink);
    const nav = screen.getByRole("navigation", { name: /options/i });
    expect(nav).toHaveAttribute("data-state", "visible");

    // user clicks in the sidebar body
    await user.click(nav);
    expect(nav).toHaveAttribute("data-state", "visible");

    // user clicks on a button set for keeping the sidebar open
    const keepOpenButton = within(nav).getByRole("button", { name: "Keep it open!" });
    await user.click(keepOpenButton);
    expect(nav).toHaveAttribute("data-state", "visible");

    // user clicks a button NOT set for keeping the sidebar open
    const button = within(nav).getByRole("button", { name: "Do something" });
    await user.click(button);
    expect(nav).toHaveAttribute("data-state", "hidden");

    // open it again
    await user.click(openLink);
    expect(nav).toHaveAttribute("data-state", "visible");

    // user clicks on link set for keeping the sidebar open
    const keepOpenLink = within(nav).getByRole("link", { name: "Keep it open!" });
    await user.click(keepOpenLink);
    expect(nav).toHaveAttribute("data-state", "visible");

    // user clicks on link NOT set for keeping the sidebar open
    const link = within(nav).getByRole("link", { name: "Goes somewhere" });
    await user.click(link);
    expect(nav).toHaveAttribute("data-state", "hidden");
  });
});
