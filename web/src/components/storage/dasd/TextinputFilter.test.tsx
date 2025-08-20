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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import TextinputFilter from "./TextinputFilter";

const onChangeFn = jest.fn();

describe("DASD/TextinputFilter", () => {
  it("renders label and input", () => {
    plainRender(
      <TextinputFilter id="search-input" label="Search" value="" onChange={onChangeFn} />,
    );

    screen.getByRole("textbox", { name: "Search" });
  });

  it("calls onChange when typing", async () => {
    const { user } = plainRender(
      <TextinputFilter id="search-input" label="Search" value="" onChange={onChangeFn} />,
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "1234");

    expect(onChangeFn).toHaveBeenCalledTimes(4);
    // Since component is stateless and receive value from outside, expect only
    // the last character entered.
    expect(onChangeFn).toHaveBeenNthCalledWith(4, expect.anything(), "4");
  });

  it("allows clearing the input with a butotn when value is not empty", async () => {
    const { rerender, user } = plainRender(
      <TextinputFilter id="search-input" label="Search" value="" onChange={onChangeFn} />,
    );

    expect(screen.queryByRole("button", { name: "Clear input" })).not.toBeInTheDocument();

    rerender(
      <TextinputFilter id="search-input" label="Search" value="something" onChange={onChangeFn} />,
    );
    const clearButton = screen.getByRole("button", { name: "Clear input" });

    await user.click(clearButton);
    expect(onChangeFn).toHaveBeenCalledWith(expect.anything(), "");
  });
});
