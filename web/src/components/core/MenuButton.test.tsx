/*
 * Copyright (c) [2025] SUSE LLC
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
import { plainRender } from "~/test-utils";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";

it("toggles the menu state on click", async () => {
  const { user } = plainRender(
    <MenuButton menuProps={{ "aria-label": "test menu" }}>{"test"}</MenuButton>,
  );

  const button = screen.getByRole("button", { name: "test" });
  expect(button).toHaveAttribute("aria-expanded", "false");
  await user.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");
  await user.click(button);
  expect(button).toHaveAttribute("aria-expanded", "false");
});

it("toggles the menu state on [Enter]", async () => {
  const { user } = plainRender(
    <MenuButton menuProps={{ "aria-label": "test menu" }}>{"test"}</MenuButton>,
  );

  const button = screen.getByRole("button", { name: "test" });
  expect(button).toHaveAttribute("aria-expanded", "false");
  await user.tab();
  expect(button).toHaveFocus();
  await user.keyboard("[Enter]");
  expect(button).toHaveAttribute("aria-expanded", "true");
  await user.keyboard("[Enter]");
  expect(button).toHaveAttribute("aria-expanded", "false");
});

it("closes menu on [Escape]", async () => {
  const { user } = plainRender(
    <MenuButton menuProps={{ "aria-label": "test menu" }}>{"test"}</MenuButton>,
  );

  const button = screen.getByRole("button", { name: "test" });
  expect(button).toHaveAttribute("aria-expanded", "false");
  await user.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");
  await user.keyboard("[Escape]");
  expect(button).toHaveAttribute("aria-expanded", "false");
});

// Regression test to ensure MenuButton does not open due to unintended keyboard events.
// This issue was caused by reusing the `toggle` callback for the `onOpenChange` prop.
// The `toggle` function is meant for handling onClick events on the menu button,
// while `onOpenChange` is intended for automatically managing the open state.
// Additionally, the two functions receive different argument types:
// `toggle` receives a SyntheticEvent, whereas `onOpenChange` expects a boolean
// representing the next `isOpen` state.
it("does not open the menu on [Tab] when focused", async () => {
  const { user } = plainRender(
    <MenuButton menuProps={{ "aria-label": "test menu" }}>{"test"}</MenuButton>,
  );

  const button = screen.getByRole("button", { name: "test" });
  await user.tab();
  expect(button).toHaveFocus();
  await user.tab();
  expect(button).not.toHaveFocus();
  const menu = screen.queryByRole("menu", { name: "test menu" });
  expect(menu).not.toBeInTheDocument();
});

it("renders all the given menu items", async () => {
  const { user } = plainRender(
    <MenuButton
      items={[
        <MenuButtonItem key="item1">{"item 1"}</MenuButtonItem>,
        <MenuButtonItem key="item2">{"item 2"}</MenuButtonItem>,
        <MenuButtonItem key="item3">{"item 3"}</MenuButtonItem>,
      ]}
    >
      test
    </MenuButton>,
  );

  const button = screen.getByRole("button", { name: "test" });
  await user.click(button);
  const menu = screen.getByRole("menu");
  within(menu).getByRole("menuitem", { name: "item 1" });
  within(menu).getByRole("menuitem", { name: "item 2" });
  within(menu).getByRole("menuitem", { name: "item 3" });
});

it("allows passing props to the toggle", () => {
  plainRender(
    <MenuButton
      toggleProps={{ className: "inline-toggle" }}
      items={[
        <MenuButtonItem key="item1">{"item 1"}</MenuButtonItem>,
        <MenuButtonItem key="item2">{"item 2"}</MenuButtonItem>,
      ]}
    >
      test
    </MenuButton>,
  );

  const button = screen.getByRole("button", { name: "test" });
  expect(button).toHaveClass("inline-toggle");
});

it("allows to set accessible menu name via aria-labelledby", async () => {
  const { user } = plainRender(
    <>
      <span id="menu-label">Accessible menu</span>
      <MenuButton
        menuProps={{ "aria-label": "test menu", "aria-labelledby": "menu-label" }}
        items={[
          <MenuButtonItem
            key="item1"
            items={[
              <MenuButtonItem key="item11">{"item 1-1"}</MenuButtonItem>,
              <MenuButtonItem key="item12">{"item 1-2"}</MenuButtonItem>,
            ]}
          >
            item 1
          </MenuButtonItem>,
        ]}
      >
        test
      </MenuButton>
      ,
    </>,
  );
  const button = screen.getByRole("button", { name: "test" });
  await user.click(button);
  screen.getByRole("menu", { name: "Accessible menu" });
});

it("allows to drill in", async () => {
  const { user } = plainRender(
    <MenuButton
      menuProps={{ "aria-label": "test menu" }}
      items={[
        <MenuButtonItem
          key="item1"
          items={[
            <MenuButtonItem key="item11">{"item 1-1"}</MenuButtonItem>,
            <MenuButtonItem key="item12">{"item 1-2"}</MenuButtonItem>,
          ]}
        >
          item 1
        </MenuButtonItem>,
      ]}
    >
      test
    </MenuButton>,
  );
  const button = screen.getByRole("button", { name: "test" });
  await user.click(button);
  const menu = screen.getByRole("menu", { name: "test menu" });
  const item1 = within(menu).getByRole("menuitem", { name: "item 1" });
  // Jsdom does not report correct styles, see https://github.com/jsdom/jsdom/issues/2986.
  // const item11 = within(menu).getByRole("menuitem", { name: "item 1-1" });
  // expect(item11).not.toBeVisible();
  expect(item1).toHaveAttribute("aria-current", "false");
  await user.click(item1);
  expect(item1).toHaveAttribute("aria-current", "true");
});

it("allows to drill out", async () => {
  const { user } = plainRender(
    <MenuButton
      menuProps={{ "aria-label": "test menu" }}
      items={[
        <MenuButtonItem
          key="item1"
          items={[
            <MenuButtonItem key="item11">{"item 1-1"}</MenuButtonItem>,
            <MenuButtonItem key="item12">{"item 1-2"}</MenuButtonItem>,
          ]}
          upProps={{ label: "return" }}
        >
          item 1
        </MenuButtonItem>,
      ]}
    >
      test
    </MenuButton>,
  );
  const button = screen.getByRole("button", { name: "test" });
  await user.click(button);
  const menu = screen.getByRole("menu", { name: "test menu" });
  const item1 = within(menu).getByRole("menuitem", { name: "item 1" });
  await user.click(item1);
  expect(item1).toHaveAttribute("aria-current", "true");
  const back = within(menu).getByRole("menuitem", { name: "return" });
  await user.click(back);
  expect(item1).not.toHaveAttribute("aria-current");
});

it("calls the item action on click", async () => {
  const action = jest.fn();
  const { user } = plainRender(
    <MenuButton
      items={[
        <MenuButtonItem key="item1">{"item 1"}</MenuButtonItem>,
        <MenuButtonItem key="item2" onClick={action}>
          item 2
        </MenuButtonItem>,
      ]}
    >
      test
    </MenuButton>,
  );

  const button = screen.getByRole("button", { name: "test" });
  await user.click(button);
  const menu = screen.getByRole("menu");
  const item2 = within(menu).getByRole("menuitem", { name: "item 2" });
  await user.click(item2);
  expect(action).toHaveBeenCalled();
});
