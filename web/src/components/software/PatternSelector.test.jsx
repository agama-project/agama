/*
 * Copyright (c) [2023-2024] SUSE LLC
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

import test_patterns from "./PatternSelector.test.json";
import PatternSelector from "./PatternSelector";

describe("PatternSelector", () => {
  it("displays the pattern groups in the correct order", () => {
    plainRender(<PatternSelector patterns={test_patterns} />);
    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingsText = headings.map((node) => node.textContent);
    expect(headingsText).toEqual([
      "Graphical Environments",
      "Base Technologies",
      "Desktop Functions",
    ]);
  });

  it("displays the patterns in a group in correct order", async () => {
    plainRender(
      <PatternSelector patterns={test_patterns} />,
    );

    // the "Base Technologies" pattern group
    const baseGroup = await screen.findByRole("region", { name: "Base Technologies" });

    // the pattern names
    const rows = within(baseGroup).getAllByRole("row");

    expect(rows[0]).toHaveTextContent(/YaST Base Utilities/);
    expect(rows[1]).toHaveTextContent(/YaST Desktop Utilities/);
    expect(rows[2]).toHaveTextContent(/YaST Server Utilities/);
  });

  it("displays only the matching patterns when using the search filter", async () => {
    const { user } = plainRender(
      <PatternSelector patterns={test_patterns} />,
    );

    // enter "multimedia" into the search filter
    const searchFilter = await screen.findByRole("textbox", { name: "Search" });
    await user.type(searchFilter, "multimedia");

    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingsText = headings.map((node) => node.textContent);
    expect(headingsText).toEqual(["Desktop Functions"]);

    const desktopGroup = screen.getByRole("region", { name: "Desktop Functions" });
    expect(within(desktopGroup).queryByRole("row", { name: /Multimedia/ })).toBeInTheDocument();
    expect(within(desktopGroup).queryByRole("row", { name: /Office Software/ })).not
      .toBeInTheDocument();
  });
});
