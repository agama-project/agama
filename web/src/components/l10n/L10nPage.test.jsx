/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import L10nPage from "~/components/l10n/L10nPage";

let mockLoadedData;

const locales = [
  { id: "en_US.UTF-8", name: "English", territory: "United States" },
  { id: "es_ES.UTF-8", name: "Spanish", territory: "Spain" },
];

const keymaps = [
  { id: "us", name: "English" },
  { id: "es", name: "Spanish" },
];

const timezones = [
  { id: "Europe/Berlin", parts: ["Europe", "Berlin"] },
  { id: "Europe/Madrid", parts: ["Europe", "Madrid"] },
];

jest.mock("~/queries/l10n", () => ({
  useL10n: () => mockLoadedData,
}));

beforeEach(() => {
  mockLoadedData = {
    locales,
    keymaps,
    timezones,
    selectedLocale: locales[0],
    selectedKeymap: keymaps[0],
    selectedTimezone: timezones[0],
  };
});

it("renders a section for configuring the language", () => {
  plainRender(<L10nPage />);
  const region = screen.getByRole("region", { name: "Language" });
  within(region).getByText("English - United States");
  within(region).getByText("Change");
});

describe("if there is no selected language", () => {
  beforeEach(() => {
    mockLoadedData.selectedLocale = undefined;
  });

  it("renders a button for selecting a language", () => {
    plainRender(<L10nPage />);
    const region = screen.getByRole("region", { name: "Language" });
    within(region).getByText("Not selected yet");
    within(region).getByText("Select");
  });
});

it("renders a section for configuring the keyboard", () => {
  plainRender(<L10nPage />);
  const region = screen.getByRole("region", { name: "Keyboard" });
  within(region).getByText("English");
  within(region).getByText("Change");
});

describe("if there is no selected keyboard", () => {
  beforeEach(() => {
    mockLoadedData.selectedKeymap = undefined;
  });

  it("renders a button for selecting a keyboard", () => {
    plainRender(<L10nPage />);
    const region = screen.getByRole("region", { name: "Keyboard" });
    within(region).getByText("Not selected yet");
    within(region).getByText("Select");
  });
});

it("renders a section for configuring the time zone", () => {
  plainRender(<L10nPage />);
  const region = screen.getByRole("region", { name: "Time zone" });
  within(region).getByText("Europe - Berlin");
  within(region).getByText("Change");
});

describe("if there is no selected time zone", () => {
  beforeEach(() => {
    mockLoadedData.selectedTimezone = undefined;
  });

  it("renders a button for selecting a time zone", () => {
    plainRender(<L10nPage />);
    const region = screen.getByRole("region", { name: "Time zone" });
    within(region).getByText("Not selected yet");
    within(region).getByText("Select");
  });
});
