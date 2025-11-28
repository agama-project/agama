/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import TimezoneSelection from "./TimezoneSelection";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { mockNavigateFn, installerRender } from "~/test-utils";
import { Timezone } from "~/model/system/l10n";

const mockPatchConfigFn = jest.fn();

const timezones: Timezone[] = [
  { id: "Europe/Berlin", parts: ["Europe", "Berlin"], country: "Germany", utcOffset: 120 },
  { id: "Europe/Madrid", parts: ["Europe", "Madrid"], country: "Spain", utcOffset: 120 },
  {
    id: "Australia/Adelaide",
    parts: ["Australia", "Adelaide"],
    country: "Australia",
    utcOffset: 570,
  },
  {
    id: "America/Antigua",
    parts: ["Americas", "Caracas"],
    country: "Antigua & Barbuda",
    utcOffset: -240,
  },
];

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/hooks/api", () => ({
  ...jest.requireActual("~/hooks/api"),
  useSystem: () => ({ l10n: { timezones } }),
  useProposal: () => ({ l10n: { timezones, timezone: "Europe/Berlin" } }),
}));

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  patchConfig: (config) => mockPatchConfigFn(config),
}));

jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigateFn,
}));

beforeEach(() => {
  const mockedDate = new Date(2024, 6, 1, 12, 0);

  jest.useFakeTimers();
  jest.setSystemTime(mockedDate);
});

afterEach(() => {
  jest.useRealTimers();
});

it("allows changing the timezone", async () => {
  installerRender(<TimezoneSelection />);

  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const option = await screen.findByText("Europe-Madrid");
  await user.click(option);
  const button = await screen.findByRole("button", { name: "Select" });
  await user.click(button);
  expect(mockPatchConfigFn).toHaveBeenCalledWith({ l10n: { timezone: "Europe/Madrid" } });
  expect(mockNavigateFn).toHaveBeenCalledWith(-1);
});

it("displays the UTC offset", () => {
  installerRender(<TimezoneSelection />);

  expect(screen.getByText("Australia/Adelaide UTC+9:30")).toBeInTheDocument();
  expect(screen.getByText("Europe/Madrid UTC+2")).toBeInTheDocument();
  expect(screen.getByText("America/Antigua UTC-4")).toBeInTheDocument();
});
