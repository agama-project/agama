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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import RowMenuToggle from "~/components/core/RowMenuToggle";

describe("RowMenuToggle", () => {
  it("renders a button named by the given label", () => {
    plainRender(<RowMenuToggle label="Actions for sda" />);
    screen.getByRole("button", { name: "Actions for sda" });
  });

  it("draws three dots in a line by default", () => {
    plainRender(<RowMenuToggle label="Actions for sda" />);
    const button = screen.getByRole("button", { name: "Actions for sda" });
    expect(button.querySelector("[data-icon-name]")).toHaveAttribute(
      "data-icon-name",
      "more_horiz",
    );
  });

  it("draws the given icon instead", () => {
    plainRender(<RowMenuToggle label="Change" icon="home_storage_gear" />);
    const button = screen.getByRole("button", { name: "Change" });
    expect(button.querySelector("[data-icon-name]")).toHaveAttribute(
      "data-icon-name",
      "home_storage_gear",
    );
  });

  it("passes other props down to the toggle", async () => {
    const onClick = jest.fn();
    const { user } = plainRender(
      <RowMenuToggle label="Actions for sda" isExpanded onClick={onClick} />,
    );
    const button = screen.getByRole("button", { name: "Actions for sda" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  it("forwards the ref to the button", () => {
    const ref = React.createRef<HTMLButtonElement>();
    plainRender(<RowMenuToggle ref={ref} label="Actions for sda" />);
    expect(ref.current).toBe(screen.getByRole("button", { name: "Actions for sda" }));
  });
});
