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
import { TimezoneSelector } from "~/components/l10n";

const timezones = [
  { id: "Asia/Bangkok", parts: ["Asia", "Bangkok"], country: "Thailand", utcOffset: NaN },
  { id: "Atlantic/Canary", parts: ["Atlantic", "Canary"], country: "Spain", utcOffset: 0 },
  { id: "America/New_York", parts: ["Americas", "New York"], country: "United States", utcOffset: -5 }
];

const onChange = jest.fn();
const mockedDate = new Date(2024, 0, 25, 0, 0, 0, 0);
let spyDate;

describe("TimezoneSelector", () => {
  beforeAll(() => {
    spyDate = jest.spyOn(global, "Date").mockImplementationOnce(() => mockedDate);
  });

  afterAll(() => {
    spyDate.mockRestore();
  });

  it("renders a selector for given timezones displaying their zone, city, country, current time, and id", () => {
    plainRender(
      <TimezoneSelector timezones={timezones} aria-label="Available timezones" />
    );

    const selector = screen.getByRole("grid", { name: "Available time zones" });

    const options = within(selector).getAllByRole("row");
    expect(options.length).toEqual(timezones.length);

    within(selector).getByRole("row", { name: "Asia-Bangkok Thailand 07:00 Asia/Bangkok UTC" });
    within(selector).getByRole("row", { name: "Atlantic-Canary Spain 24:00 Atlantic/Canary UTC" });
    within(selector).getByRole("row", { name: "Americas-New York United States 19:00 America/New_York UTC-5" });
  });

  it("renders an input for filtering timezones", async () => {
    const { user } = plainRender(
      <TimezoneSelector timezones={timezones} aria-label="Available time zones" />
    );

    const filterInput = screen.getByRole("search");
    screen.getByRole("row", { name: /Thailand/ });
    screen.getByRole("row", { name: /Canary/ });

    await user.type(filterInput, "york");

    await waitFor(() => {
      const bangkok = screen.queryByRole("row", { name: /Thailand/ });
      const canary = screen.queryByRole("row", { name: /Canary/ });
      expect(bangkok).not.toBeInTheDocument();
      expect(canary).not.toBeInTheDocument();
    });

    screen.getByRole("row", { name: /York/ });
  });

  describe("when user clicks an option", () => {
    it("calls the #onChange callback with the timezone id", async () => {
      const { user } = plainRender(
        <TimezoneSelector timezones={timezones} onChange={onChange} aria-label="Available time zones" />
      );

      const selector = screen.getByRole("grid", { name: "Available time zones" });
      const canary = within(selector).getByRole("row", { name: /Canary/ });
      await user.click(canary);

      expect(onChange).toHaveBeenCalledWith("Atlantic/Canary");
    });
  });
});
