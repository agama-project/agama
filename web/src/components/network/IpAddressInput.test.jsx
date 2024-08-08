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

// @ts-check

import React from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import IpAddressInput from "~/components/network/IpAddressInput";

const getInput = () => screen.getByRole("textbox", { name: "IP Address" });

describe("IpAddressInput", () => {
  it("renders a textbox using given or default label", () => {
    const { rerender } = plainRender(<IpAddressInput />);
    screen.getByRole("textbox", { name: "IP Address" });
    rerender(<IpAddressInput label="Internet Protocol Address" />);
    screen.getByRole("textbox", { name: "Internet Protocol Address" });
  });

  it("renders its as valid when given defaultValue is none, empty, or valid ip", () => {
    const { rerender } = plainRender(<IpAddressInput />);
    expect(getInput()).toHaveAttribute("aria-invalid", "false");
    rerender(<IpAddressInput defaultValue="" />);
    expect(getInput()).toHaveAttribute("aria-invalid", "false");
    rerender(<IpAddressInput defaultValue="1.1.1.1" />);
    expect(getInput()).toHaveAttribute("aria-invalid", "false");
  });

  it("renders its as not valid when given defaultValue a not valid ip", () => {
    plainRender(<IpAddressInput defaultValue="8.7." />);
    expect(getInput()).toHaveAttribute("aria-invalid", "true");
  });

  it("updates its validation status on user interactions", async () => {
    // Let's start with a not valid value
    const { container, user } = plainRender(<IpAddressInput defaultValue="x" />);
    const input = getInput();
    expect(input).toHaveAttribute("aria-invalid", "true");
    // Getting the focus means that the user is gonna enter a different value,
    // the validation status should be reset until user leaves the input
    await user.click(input);
    expect(input).toHaveAttribute("aria-invalid", "false");
    // User clears and leave the input, input should remain valid
    await user.clear(input);
    await user.click(container);
    expect(input).toHaveAttribute("aria-invalid", "false");
    // User enters a not valid value again and leaves the input
    await user.type(input, "192.168.1");
    await user.click(container);
    expect(input).toHaveAttribute("aria-invalid", "true");
    // User fixes the wrong value and leaves the input
    await user.type(input, ".1");
    await user.click(container);
    expect(input).toHaveAttribute("aria-invalid", "false");
  });
});
