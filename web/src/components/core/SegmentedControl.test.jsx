/*
 * Copyright (c) [2024] SUSE LLC
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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { SegmentedControl } from "~/components/core";

const selectOption = { label: "Select", longLabel: "Select item", description: "Select an existing item" };
const createOption = { label: "Create", longLabel: "Create item", description: "Create a new item" };
const options = [
  selectOption, createOption
];

describe("SegmentedControl", () => {
  it("renders each given option as a button", () => {
    plainRender(<SegmentedControl options={options} />);
    screen.getByRole("button", { name: "Select" });
    screen.getByRole("button", { name: "Create" });
  });

  it("uses renderLabel for rendering the button text", () => {
    const onClick = jest.fn();
    const { user } = plainRender(
      <SegmentedControl options={options} renderLabel={(option) => option.longLabel }  />
    );

    const buttonByLabel = screen.queryByRole("button", { name: "Select" });
    expect(buttonByLabel).toBeNull();
    screen.getByRole("button", { name: "Select item" });
  });

  it("sets proper aria-current value for each button", () => {
    plainRender(<SegmentedControl options={options} selected={createOption} />);
    const selectButton = screen.getByRole("button", { name: "Select" });
    const createButton = screen.getByRole("button", { name: "Create" });
    expect(selectButton).toHaveAttribute("aria-current", "false");
    expect(createButton).toHaveAttribute("aria-current", "true");
  });

  it("triggers given onClick callback when user clicks an option", async () => {
    const onClick = jest.fn();
    const { user } = plainRender(
      <SegmentedControl options={options} selected={createOption} onClick={onClick} />
    );
    const selectButton = screen.getByRole("button", { name: "Select" });

    await user.click(selectButton);

    expect(onClick).toHaveBeenCalledWith(selectOption);
  });
});
