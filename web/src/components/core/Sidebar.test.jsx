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
import { plainRender } from "~/test-utils";
import { If, Sidebar } from "~/components/core";

// Mock some components
jest.mock("~/components/core/About", () => () => <div>About link mock</div>);
jest.mock("~/components/core/DevelopmentInfo", () => () => <div>DevelopmentInfo mock</div>);
jest.mock("~/components/core/LogsButton", () => () => <div>LogsButton mock</div>);
jest.mock("~/components/core/ShowLogButton", () => () => <div>ShowLogButton mock</div>);
jest.mock("~/components/core/ShowTerminalButton", () => () => <div>ShowTerminalButton mock</div>);
jest.mock("~/components/l10n/InstallerKeymapSwitcher", () => () => <div>Installer keymap switcher mock</div>);
jest.mock("~/components/l10n/InstallerLocaleSwitcher", () => () => <div>Installer locale switcher mock</div>);

it("renders the sidebar hidden if isOpen prop is not given", () => {
  plainRender(<Sidebar />);

  const nav = screen.getByRole("complementary", { name: /options/i });
  expect(nav).toHaveAttribute("data-state", "hidden");
});

it("renders the sidebar hidden if isOpen prop is false", () => {
  plainRender(<Sidebar isOpen={false} />);

  const nav = screen.getByRole("complementary", { name: /options/i });
  expect(nav).toHaveAttribute("data-state", "hidden");
});

it("renders expected options", () => {
  plainRender(<Sidebar />);
  screen.getByText("Installer keymap switcher mock");
  screen.getByText("Installer locale switcher mock");
  screen.getByText("LogsButton mock");
  screen.getByText("ShowLogButton mock");
  screen.getByText("ShowTerminalButton mock");
  screen.getByText("About link mock");
  screen.getByText("DevelopmentInfo mock");
});

it("renders given children", () => {
  plainRender(<Sidebar><button>An extra button</button></Sidebar>);
  screen.getByRole("button", { name: "An extra button" });
});

describe("when isOpen prop is given", () => {
  it("renders the sidebar visible", () => {
    plainRender(<Sidebar isOpen />);

    const nav = screen.getByRole("complementary", { name: /options/i });
    expect(nav).toHaveAttribute("data-state", "visible");
  });

  it("moves the focus to the close action", () => {
    plainRender(<Sidebar isOpen />);
    const closeLink = screen.getByLabelText(/Hide/i);
    expect(closeLink).toHaveFocus();
  });

  it("renders a link intended for closing it that triggers the onClose callback", async () => {
    const onClose = jest.fn();
    const { user } = plainRender(<Sidebar isOpen onClose={onClose} />);
    const closeLink = screen.getByLabelText(/Hide/i);
    await user.click(closeLink);
    expect(onClose).toHaveBeenCalled();
  });
});

// NOTE: maybe it's time to kill this feature of keeping the sidebar open
describe("onClick bubbling", () => {
  it("triggers onClose callback only if the user clicked on a link or button w/o keepSidebarOpen attribute", async () => {
    const onClose = jest.fn();
    const { user } = plainRender(
      <Sidebar isOpen onClose={onClose}>
        <a href="#">Goes somewhere</a>
        <a href="#" data-keep-sidebar-open="true">Keep it open!</a>
        <button>Do something</button>
        <button data-keep-sidebar-open="true">Keep it open!</button>
      </Sidebar>
    );

    const sidebar = screen.getByRole("complementary", { name: /options/i });

    // user clicks in the sidebar body
    await user.click(sidebar);
    expect(onClose).not.toHaveBeenCalled();

    // user clicks a button NOT set for keeping the sidebar open
    const button = within(sidebar).getByRole("button", { name: "Do something" });
    await user.click(button);
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();

    // user clicks on a button set for keeping the sidebar open
    const keepOpenButton = within(sidebar).getByRole("button", { name: "Keep it open!" });
    await user.click(keepOpenButton);
    expect(onClose).not.toHaveBeenCalled();

    onClose.mockClear();

    // user clicks on link NOT set for keeping the sidebar open
    const link = within(sidebar).getByRole("link", { name: "Goes somewhere" });
    await user.click(link);
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();

    // user clicks on link set for keeping the sidebar open
    const keepOpenLink = within(sidebar).getByRole("link", { name: "Keep it open!" });
    await user.click(keepOpenLink);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("side effects on siblings", () => {
  const SidebarWithSiblings = () => {
    const [sidebarOpen, setSidebarOpen] = React.useState(false);
    const [sidebarMount, setSidebarMount] = React.useState(true);

    const openSidebar = () => setSidebarOpen(true);
    const closeSidebar = () => setSidebarOpen(false);

    // NOTE: using the "data-keep-sidebar-open" to avoid triggering the #close
    // function before unmounting the component.
    const Content = () => (
      <button data-keep-sidebar-open onClick={() => setSidebarMount(false)}>
        Unmount Sidebar
      </button>
    );

    return (
      <>
        <button onClick={openSidebar}>open the sidebar</button>
        <article>A sidebar sibling</article>
        <If
          condition={sidebarMount}
          then={<Sidebar isOpen={sidebarOpen} onClose={closeSidebar}><Content /></Sidebar>}
        />
      </>
    );
  };

  it("sets siblings as inert and aria-hidden while it's open", async () => {
    const { user } = plainRender(<SidebarWithSiblings />);

    const openButton = screen.getByRole("button", { name: "open the sidebar" });
    const closeLink = screen.getByLabelText(/Hide/i);
    const sidebarSibling = screen.getByText("A sidebar sibling");

    expect(openButton).not.toHaveAttribute("aria-hidden");
    expect(openButton).not.toHaveAttribute("inert");
    expect(sidebarSibling).not.toHaveAttribute("aria-hidden");
    expect(sidebarSibling).not.toHaveAttribute("inert");

    await user.click(openButton);

    expect(openButton).toHaveAttribute("aria-hidden");
    expect(openButton).toHaveAttribute("inert");
    expect(sidebarSibling).toHaveAttribute("aria-hidden");
    expect(sidebarSibling).toHaveAttribute("inert");

    await user.click(closeLink);

    expect(openButton).not.toHaveAttribute("aria-hidden");
    expect(openButton).not.toHaveAttribute("inert");
    expect(sidebarSibling).not.toHaveAttribute("aria-hidden");
    expect(sidebarSibling).not.toHaveAttribute("inert");
  });

  it("removes inert and aria-hidden siblings attributes if it's unmounted", async () => {
    const { user } = plainRender(<SidebarWithSiblings />);

    const openButton = screen.getByRole("button", { name: "open the sidebar" });
    const sidebarSibling = screen.getByText("A sidebar sibling");

    expect(openButton).not.toHaveAttribute("aria-hidden");
    expect(openButton).not.toHaveAttribute("inert");
    expect(sidebarSibling).not.toHaveAttribute("aria-hidden");
    expect(sidebarSibling).not.toHaveAttribute("inert");

    await user.click(openButton);

    expect(openButton).toHaveAttribute("aria-hidden");
    expect(openButton).toHaveAttribute("inert");
    expect(sidebarSibling).toHaveAttribute("aria-hidden");
    expect(sidebarSibling).toHaveAttribute("inert");

    const unmountButton = screen.getByRole("button", { name: "Unmount Sidebar" });
    await user.click(unmountButton);

    expect(openButton).not.toHaveAttribute("aria-hidden");
    expect(openButton).not.toHaveAttribute("inert");
    expect(sidebarSibling).not.toHaveAttribute("aria-hidden");
    expect(sidebarSibling).not.toHaveAttribute("inert");
  });
});
