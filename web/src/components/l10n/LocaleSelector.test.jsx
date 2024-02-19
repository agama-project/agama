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
import { LocaleSelector } from "~/components/l10n";

const locales = [
  { id: "es_ES", name: "Spanish", territory: "Spain" },
  { id: "en_US", name: "English", territory: "United States" }
];

const onChange = jest.fn();

describe("LocaleSelector", () => {
  it("renders a selector for given locales displaying their name, territory, and id", () => {
    plainRender(
      <LocaleSelector locales={locales} aria-label="Available locales" />
    );

    const selector = screen.getByRole("grid", { name: "Available locales" });

    const options = within(selector).getAllByRole("row");
    expect(options.length).toEqual(locales.length);

    within(selector).getByRole("row", { name: "Spanish Spain es_ES" });
    within(selector).getByRole("row", { name: "English United States en_US" });
  });

  it("renders an input for filtering locales", async () => {
    const { user } = plainRender(
      <LocaleSelector locales={locales} aria-label="Available locales" />
    );

    const filterInput = screen.getByRole("search");
    screen.getByRole("row", { name: "English United States en_US" });

    await user.type(filterInput, "Span");
    await waitFor(() => {
      const englishOption = screen.queryByRole("row", { name: "English United States en_US" });
      expect(englishOption).not.toBeInTheDocument();
    });

    screen.getByRole("row", { name: "Spanish Spain es_ES" });
  });

  describe("when user clicks an option", () => {
    it("calls the #onChange callback with the locale id", async () => {
      const { user } = plainRender(
        <LocaleSelector locales={locales} onChange={onChange} aria-label="Available locales" />
      );

      const selector = screen.getByRole("grid", { name: "Available locales" });
      const english = within(selector).getByRole("row", { name: "English United States en_US" });
      await user.click(english);

      expect(onChange).toHaveBeenCalledWith("en_US");
    });
  });
});
