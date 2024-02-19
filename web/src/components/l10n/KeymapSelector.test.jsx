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
import { screen, waitFor, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { KeymapSelector } from "~/components/l10n";

const keymaps = [
  { id: "de", name: "German" },
  { id: "us", name: "English" },
  { id: "es", name: "Spanish" }
];

const onChange = jest.fn();

describe("KeymapSelector", () => {
  it("renders a selector for given keymaps displaying their name and id", () => {
    plainRender(
      <KeymapSelector keymaps={keymaps} aria-label="Available keymaps" />
    );

    const selector = screen.getByRole("grid", { name: "Available keymaps" });

    const options = within(selector).getAllByRole("row");
    expect(options.length).toEqual(keymaps.length);

    within(selector).getByRole("row", { name: "German de" });
    within(selector).getByRole("row", { name: "English us" });
    within(selector).getByRole("row", { name: "Spanish es" });
  });

  it("renders an input for filtering keymaps", async () => {
    const { user } = plainRender(
      <KeymapSelector keymaps={keymaps} aria-label="Available keymaps" />
    );

    const filterInput = screen.getByRole("search");
    screen.getByRole("row", { name: "German de" });

    await user.type(filterInput, "ish");
    await waitFor(() => {
      const germanOption = screen.queryByRole("row", { name: "German de" });
      expect(germanOption).not.toBeInTheDocument();
    });

    screen.getByRole("row", { name: "Spanish es" });
    screen.getByRole("row", { name: "English us" });
  });

  describe("when user clicks an option", () => {
    it("calls the #onChange callback with the keymap id", async () => {
      const { user } = plainRender(
        <KeymapSelector keymaps={keymaps} onChange={onChange} aria-label="Available keymaps" />
      );

      const selector = screen.getByRole("grid", { name: "Available keymaps" });
      const english = within(selector).getByRole("row", { name: "English us" });
      await user.click(english);

      expect(onChange).toHaveBeenCalledWith("us");
    });
  });
});
