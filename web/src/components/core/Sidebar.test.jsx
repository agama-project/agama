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
import { installerRender, withNotificationProvider } from "~/test-utils";
import { If, Sidebar } from "~/components/core";
import { createClient } from "~/client";

// Mock some components using contexts and not relevant for below tests
jest.mock("~/components/core/LogsButton", () => () => <div>LogsButton Mock</div>);
jest.mock("~/components/software/ChangeProductLink", () => () => <div>ChangeProductLink Mock</div>);

let hasIssues = false;

jest.mock("~/client");

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      issues: {
        any: () => Promise.resolve(hasIssues),
        onIssuesChange: jest.fn()
      }
    };
  });
});

it("renders the sidebar initially hidden", async () => {
  installerRender(withNotificationProvider(<Sidebar />));

  const nav = await screen.findByRole("complementary", { name: /options/i });
  expect(nav).toHaveAttribute("data-state", "hidden");
});

it("renders a link for displaying the sidebar", async () => {
  const { user } = installerRender(withNotificationProvider(<Sidebar />));

  const link = await screen.findByLabelText(/Show/i);
  const sidebar = await screen.findByRole("complementary", { name: /options/i });

  expect(sidebar).toHaveAttribute("data-state", "hidden");
  await user.click(link);
  expect(sidebar).toHaveAttribute("data-state", "visible");
});

it("renders a link for hiding the sidebar", async () => {
  const { user } = installerRender(withNotificationProvider(<Sidebar />));

  const openLink = await screen.findByLabelText(/Show/i);
  const closeLink = await screen.findByLabelText(/Hide/i);

  const sidebar = await screen.findByRole("complementary", { name: /options/i });

  await user.click(openLink);
  expect(sidebar).toHaveAttribute("data-state", "visible");
  await user.click(closeLink);
  expect(sidebar).toHaveAttribute("data-state", "hidden");
});

it("moves the focus to the close action after opening it", async () => {
  const { user } = installerRender(withNotificationProvider(<Sidebar />));

  const openLink = await screen.findByLabelText(/Show/i);
  const closeLink = await screen.findByLabelText(/Hide/i);

  expect(closeLink).not.toHaveFocus();
  await user.click(openLink);
  expect(closeLink).toHaveFocus();
});

describe("onClick bubbling", () => {
  it("hides the sidebar only if the user clicked on a link or button w/o keepSidebarOpen attribute", async () => {
    const { user } = installerRender(
      withNotificationProvider(
        <Sidebar>
          <a href="#">Goes somewhere</a>
          <a href="#" data-keep-sidebar-open="true">Keep it open!</a>
          <button>Do something</button>
          <button data-keep-sidebar-open="true">Keep it open!</button>
        </Sidebar>
      )
    );

    const openLink = screen.getByLabelText(/Show/i);
    await user.click(openLink);
    const sidebar = screen.getByRole("complementary", { name: /options/i });
    expect(sidebar).toHaveAttribute("data-state", "visible");

    // user clicks in the sidebar body
    await user.click(sidebar);
    expect(sidebar).toHaveAttribute("data-state", "visible");

    // user clicks on a button set for keeping the sidebar open
    const keepOpenButton = within(sidebar).getByRole("button", { name: "Keep it open!" });
    await user.click(keepOpenButton);
    expect(sidebar).toHaveAttribute("data-state", "visible");

    // user clicks a button NOT set for keeping the sidebar open
    const button = within(sidebar).getByRole("button", { name: "Do something" });
    await user.click(button);
    expect(sidebar).toHaveAttribute("data-state", "hidden");

    // open it again
    await user.click(openLink);
    expect(sidebar).toHaveAttribute("data-state", "visible");

    // user clicks on link set for keeping the sidebar open
    const keepOpenLink = within(sidebar).getByRole("link", { name: "Keep it open!" });
    await user.click(keepOpenLink);
    expect(sidebar).toHaveAttribute("data-state", "visible");

    // user clicks on link NOT set for keeping the sidebar open
    const link = within(sidebar).getByRole("link", { name: "Goes somewhere" });
    await user.click(link);
    expect(sidebar).toHaveAttribute("data-state", "hidden");
  });
});

describe("if there are issues", () => {
  beforeEach(() => {
    hasIssues = true;
  });

  it("includes a notification mark", async () => {
    installerRender(withNotificationProvider(<Sidebar />));
    const link = await screen.findByLabelText(/Show/i);
    within(link).getByRole("status", { name: /New issues/ });
  });
});

describe("if there are not issues", () => {
  beforeEach(() => {
    hasIssues = false;
  });

  it("does not include a notification mark", async () => {
    installerRender(withNotificationProvider(<Sidebar />));
    const link = await screen.findByLabelText(/Show/i);
    const mark = within(link).queryByRole("status", { name: /New issues/ });
    expect(mark).toBeNull();
  });
});

describe("side effects on siblings", () => {
  const SidebarWithSiblings = () => {
    const [isSidebarMount, setIsSidebarMount] = React.useState(true);

    // NOTE: using the "data-keep-sidebar-open" to avoid triggering the #close
    // function before unmounting the component.
    const Content = () => (
      <button data-keep-sidebar-open onClick={() => setIsSidebarMount(false)}>
        Unmount Sidebar
      </button>
    );

    return (
      <>
        <article>A sidebar sibling</article>
        <If condition={isSidebarMount} then={<Sidebar><Content /></Sidebar>} />
      </>
    );
  };

  it("sets siblings as inert and aria-hidden while it's open", async () => {
    const { user } = installerRender(withNotificationProvider(<SidebarWithSiblings />));

    const openLink = await screen.findByLabelText(/Show/i);
    const closeLink = await screen.findByLabelText(/Hide/i);
    const sidebarSibling = screen.getByText("A sidebar sibling");
    expect(sidebarSibling).not.toHaveAttribute("aria-hidden");
    expect(sidebarSibling).not.toHaveAttribute("inert");
    await user.click(openLink);
    expect(sidebarSibling).toHaveAttribute("aria-hidden");
    expect(sidebarSibling).toHaveAttribute("inert");
    await user.click(closeLink);
    expect(sidebarSibling).not.toHaveAttribute("aria-hidden");
    expect(sidebarSibling).not.toHaveAttribute("inert");
  });

  it("removes inert and aria-hidden siblings attributes if it's unmounted", async () => {
    const { user } = installerRender(withNotificationProvider(<SidebarWithSiblings />));

    const openLink = await screen.findByLabelText(/Show/i);
    const unmountButton = await screen.getByRole("button", { name: "Unmount Sidebar" });
    const sidebarSibling = screen.getByText("A sidebar sibling");
    expect(sidebarSibling).not.toHaveAttribute("aria-hidden");
    expect(sidebarSibling).not.toHaveAttribute("inert");
    await user.click(openLink);
    expect(sidebarSibling).toHaveAttribute("aria-hidden");
    expect(sidebarSibling).toHaveAttribute("inert");
    await user.click(unmountButton);
    expect(sidebarSibling).not.toHaveAttribute("aria-hidden");
    expect(sidebarSibling).not.toHaveAttribute("inert");
  });
});
