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
import { installerRender } from "~/test-utils";
import testingPatterns from "./patterns.test.json";
import SoftwarePatternsSelection from "./SoftwarePatternsSelection";

const onConfigMutationMock = { mutate: jest.fn() };

jest.mock("~/queries/software", () => ({
  usePatterns: () => testingPatterns,
  useConfigMutation: () => onConfigMutationMock,
}));

describe("SoftwarePatternsSelection", () => {
  it("displays the pattern in the correct order", async () => {
    installerRender(<SoftwarePatternsSelection />);
    const headings = screen.getAllByRole("heading", { level: 3 });
    const headingsText = headings.map((node) => node.textContent);
    expect(headingsText).toEqual([
      "Graphical Environments",
      "Base Technologies",
      "Desktop Functions",
    ]);

    // the "Base Technologies" pattern group
    const baseGroup = await screen.findByRole("list", { name: "Base Technologies" });
    // the "Base Technologies" pattern items
    const items = within(baseGroup).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(/YaST Base Utilities/);
    expect(items[1]).toHaveTextContent(/YaST Desktop Utilities/);
    expect(items[2]).toHaveTextContent(/YaST Server Utilities/);
  });

  it("displays only the matching patterns when filtering", async () => {
    const { user } = installerRender(<SoftwarePatternsSelection />);

    // enter "multimedia" into the search filter
    const searchFilter = await screen.findByRole("textbox", { name: /Filter/ });
    await user.type(searchFilter, "multimedia");

    const headings = screen.getAllByRole("heading", { level: 3 });
    const headingsText = headings.map((node) => node.textContent);
    expect(headingsText).toEqual(["Desktop Functions"]);

    const desktopGroup = screen.getByRole("list", { name: "Desktop Functions" });
    expect(
      within(desktopGroup).queryByRole("listitem", { name: /Multimedia/ }),
    ).toBeInTheDocument();
    expect(
      within(desktopGroup).queryByRole("listitem", { name: /Office Software/ }),
    ).not.toBeInTheDocument();
  });

  it("displays the checkbox reflecting the current pattern selection status", async () => {
    installerRender(<SoftwarePatternsSelection />);

    // the "Base Technologies" pattern group
    const baseGroup = await screen.findByRole("list", { name: "Base Technologies" });

    const basisItem = within(baseGroup).getByRole("listitem", { name: /YaST Base/ });
    const basisCheckbox = await within(basisItem).findByRole("checkbox");
    expect(basisCheckbox).toBeChecked();

    const serverItem = within(baseGroup).getByRole("listitem", { name: /YaST Server/ });
    const serverCheckbox = await within(serverItem).findByRole("checkbox");
    expect(serverCheckbox).not.toBeChecked();
  });

  it("allows changing the selection", async () => {
    const { user } = installerRender(<SoftwarePatternsSelection />);
    const y2BasisPattern = testingPatterns.find((p) => p.name === "yast2_basis");

    const basisItem = screen.getByRole("listitem", { name: y2BasisPattern.summary });
    const basisCheckbox = await within(basisItem).findByRole("checkbox");
    expect(basisCheckbox).toBeChecked();

    await user.click(basisCheckbox);
    expect(onConfigMutationMock.mutate).toHaveBeenCalledWith({
      patterns: expect.objectContaining({ yast2_basis: false }),
    });
  });
});
