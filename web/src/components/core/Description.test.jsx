/*
 * Copyright (c) [2023] SUSE LLC
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
import { Description } from "~/components/core";

describe("Description", () => {
  const description = "Some great description";
  const item = "Item with description";

  it("displays the description after clicking the object", async () => {
    const { user } = plainRender(<Description description={description}>{item}</Description>);

    // the description is not displayed just after the render
    expect(screen.queryByText(description)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // click it
    const item_node = screen.getByText(item);
    await user.click(item_node);

    // then the description is visible in a dialog
    screen.getByRole("dialog");
    screen.getByText(description);
  });

  const expectNoPopup = async (content) => {
    const { user } = plainRender(content);

    const item_node = screen.getByText(item);
    await user.click(item_node);

    // do not display empty popup
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  };

  it("displays the object without description when it is undefined", async () => {
    expectNoPopup(<Description>{item}</Description>);
  });

  it("displays the object without description when it is null", async () => {
    expectNoPopup(<Description description={null}>{item}</Description>);
  });

  it("displays the object without description when it is empty", async () => {
    expectNoPopup(<Description description="">{item}</Description>);
  });
});
