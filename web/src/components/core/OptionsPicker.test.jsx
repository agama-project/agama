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
import { OptionsPicker } from "~/components/core";

describe("OptionsPicker", () => {
  it("renders a node with listbox role", () => {
    plainRender(<OptionsPicker />);
    screen.getByRole("listbox");
  });
});

describe("OptionsPicker.Option", () => {
  it("renders a node with option role", () => {
    plainRender(<OptionsPicker.Option />);
    screen.getByRole("option");
  });

  it("renders given title", () => {
    plainRender(<OptionsPicker.Option title="Custom" />);
    screen.getByRole("option", { name: "Custom" });
  });

  it("renders given body", () => {
    plainRender(<OptionsPicker.Option body="More freedom for user" />);
    screen.getByRole("option", { name: "More freedom for user" });
  });

  it("triggers given onClick callback when user clicks on it", async () => {
    const onClick = jest.fn();
    const { user } = plainRender(<OptionsPicker.Option title="Custom" onClick={onClick} />);
    const option = screen.getByRole("option", { name: "Custom" });
    await user.click(option);
    expect(onClick).toHaveBeenCalled();
  });

  it("sets as selected if isSelected is given", () => {
    plainRender(<OptionsPicker.Option isSelected />);
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  it("sets as not selected if isSelected is not given", () => {
    plainRender(<OptionsPicker.Option />);
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("aria-selected", "false");
  });

  it("sets as not selected if isSelected=false", () => {
    plainRender(<OptionsPicker.Option isSelected={false} />);
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("aria-selected", "false");
  });
});
