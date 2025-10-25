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
import { screen, waitForElementToBeRemoved, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import SplitButton from "./SplitButton";

const mainOnClickFn = jest.fn();
const secondaryOnClickFn = jest.fn();

const SplitButtonTest = ({ href }: { href?: string }) => (
  <SplitButton label="Test" toggleAriaLabel="More actions" href={href} onClick={mainOnClickFn}>
    <SplitButton.Item onClick={secondaryOnClickFn}>Second test</SplitButton.Item>
  </SplitButton>
);

describe("SplitButton", () => {
  it("renders two buttons if href prop is not provided: the main action button and the toggle button", () => {
    installerRender(<SplitButtonTest />);

    screen.getByRole("button", { name: "Test" });
    screen.getByRole("button", { name: "More actions" });
  });

  it("renders the main action as a link and the toggle as a button when the 'href' prop is provided", () => {
    installerRender(<SplitButtonTest href="somewhere" />);

    screen.getByRole("link", { name: "Test" });
    screen.getByRole("button", { name: "More actions" });
  });

  it("triggers the 'onClick' function when the main action button is clicked", async () => {
    const { user } = installerRender(<SplitButtonTest />);

    const mainAction = screen.getByRole("button", { name: "Test" });
    await user.click(mainAction);
    expect(mainOnClickFn).toHaveBeenCalled();
  });

  it("allows expanding and collapsing the menu holding additional actions when the toggle button is clicked", async () => {
    const { user } = installerRender(<SplitButtonTest />);

    const toggleAction = screen.getByRole("button", { name: "More actions" });
    expect(toggleAction).toHaveAttribute("aria-haspopup");
    expect(toggleAction).toHaveAttribute("aria-controls");
    expect(toggleAction).toHaveAttribute("aria-expanded", "false");

    // Click on the toggle button to open the menu
    await user.click(toggleAction);
    expect(mainOnClickFn).not.toHaveBeenCalled();
    expect(toggleAction).toHaveAttribute("aria-expanded", "true");
    const moreActions = screen.getByRole("menu");

    // Click on the toggle button to open the menu
    await user.click(toggleAction);
    expect(toggleAction).toHaveAttribute("aria-expanded", "false");
    await waitForElementToBeRemoved(moreActions);
  });

  it("closes the menu when a secondary action is clicked", async () => {
    const { user } = installerRender(<SplitButtonTest />);

    const toggleAction = screen.getByRole("button", { name: "More actions" });
    expect(toggleAction).toHaveAttribute("aria-expanded", "false");

    // Click on the toggle button to open the menu
    await user.click(toggleAction);

    // Find and click on a secondary action inside the expanded menu
    const moreActions = screen.getByRole("menu");
    const secondaryAction = within(moreActions).getByRole("menuitem", { name: "Second test" });
    await user.click(secondaryAction);

    // Verify that the secondary action's onClick handler is called
    expect(secondaryOnClickFn).toHaveBeenCalled();

    // Ensure that the menu is closed
    expect(toggleAction).toHaveAttribute("aria-expanded", "false");
    await waitForElementToBeRemoved(moreActions);
  });
});
