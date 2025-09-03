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
import { plainRender } from "~/test-utils";
import SelectWrapper, { SelectWrapperProps } from "~/components/core/SelectWrapper";
import { SelectList, SelectOption } from "@patternfly/react-core";

const TestingSelector = (props: Partial<SelectWrapperProps>) => (
  <SelectWrapper label="Selector" value="2" {...props}>
    <SelectList>
      <SelectOption value="1">First</SelectOption>
      <SelectOption value="2">Second</SelectOption>
    </SelectList>
  </SelectWrapper>
);

describe("SelectWrapper", () => {
  it("renders a toggle button using label or value", () => {
    const { rerender } = plainRender(<TestingSelector label="The label" value="The value" />);
    const button = screen.getByRole("button");
    expect(button.classList.contains("pf-v6-c-menu-toggle")).toBe(true);
    within(button).getByText("The label");
    rerender(<TestingSelector label={undefined} value="The value" />);
    within(button).getByText("The value");
  });

  it("toggles select options when the toggle button is clicked", async () => {
    const { user } = plainRender(<TestingSelector />);
    const button = screen.getByRole("button", { name: "Selector" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("option")).toEqual([]);
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryAllByRole("option").length).toEqual(2);
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    await waitForElementToBeRemoved(() => screen.getAllByRole("option"));
  });

  it("toggles select options when an option is clicked", async () => {
    const { user } = plainRender(<TestingSelector />);
    const button = screen.getByRole("button", { name: "Selector" });
    await user.click(button);
    const firstOption = screen.getByRole("option", { name: "First" });
    await user.click(firstOption);
    await waitForElementToBeRemoved(() => screen.getByRole("listbox"));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("triggers onChange callback when not selected option is clicked", async () => {
    const onChangeFn = jest.fn();
    const { user } = plainRender(<TestingSelector onChange={onChangeFn} />);
    const button = screen.getByRole("button", { name: "Selector" });
    await user.click(button);
    const secondOption = screen.getByRole("option", { name: "Second" });
    await user.click(secondOption);
    expect(onChangeFn).not.toHaveBeenCalled();
    await user.click(button);
    const firstOption = screen.getByRole("option", { name: "First" });
    await user.click(firstOption);
    expect(onChangeFn).toHaveBeenCalledWith("1");
  });

  it("focuses the button toggle after selection", async () => {
    const { user } = plainRender(<TestingSelector />);
    const button = screen.getByRole("button", { name: "Selector" });
    await user.click(button);
    const secondOption = screen.getByRole("option", { name: "Second" });
    await user.click(secondOption);
    expect(button).toHaveFocus();
  });
});
