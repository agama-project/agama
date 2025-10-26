/*
 * Copyright (c) [2024] SUSE LLC
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
import { Timezone } from "~/types/l10n";

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

const mockUpdateConfigFn = jest.fn();

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

jest.mock("~/queries/system", () => ({
  ...jest.requireActual("~/queries/system"),
  useSystem: () => ({ l10n: { timezones } }),
}));

jest.mock("~/queries/proposal", () => ({
  ...jest.requireActual("~/queries/proposal"),
  useProposal: () => ({ l10n: { timezones, timezone: "Europe/Berlin" } }),
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigateFn,
}));

jest.mock("~/api/api", () => ({
  ...jest.requireActual("~/api/api"),
  updateConfig: (config) => mockUpdateConfigFn(config),
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
  expect(mockUpdateConfigFn).toHaveBeenCalledWith({ l10n: { timezone: "Europe/Madrid" } });
  expect(mockNavigateFn).toHaveBeenCalledWith(-1);
});

it("displays the UTC offset", () => {
  installerRender(<TimezoneSelection />);

  expect(screen.getByText("Australia/Adelaide UTC+9:30")).toBeInTheDocument();
  expect(screen.getByText("Europe/Madrid UTC+2")).toBeInTheDocument();
  expect(screen.getByText("America/Antigua UTC-4")).toBeInTheDocument();
});
