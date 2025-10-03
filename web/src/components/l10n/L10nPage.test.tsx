/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { installerRender } from "~/test-utils";
import L10nPage from "~/components/l10n/L10nPage";
import { Keymap, Locale, Timezone } from "~/types/l10n";
import { System } from "~/types/system";
import { Proposal } from "~/types/proposal";

let mockSystemData: System;
let mockProposedData: Proposal;
const locales: Locale[] = [
  { id: "en_US.UTF-8", name: "English", territory: "United States" },
  { id: "es_ES.UTF-8", name: "Spanish", territory: "Spain" },
];

const keymaps: Keymap[] = [
  { id: "us", name: "English" },
  { id: "es", name: "Spanish" },
];

const timezones: Timezone[] = [
  { id: "Europe/Berlin", parts: ["Europe", "Berlin"], country: "Germany", utcOffset: 120 },
  { id: "Europe/Madrid", parts: ["Europe", "Madrid"], country: "Spain", utcOffset: 120 },
];

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/components/core/InstallerOptions", () => () => <div>InstallerOptions Mock</div>);

jest.mock("~/queries/system", () => ({
  useSystem: () => mockSystemData,
}));

jest.mock("~/queries/proposal", () => ({
  useProposal: () => mockProposedData,
}));

beforeEach(() => {
  mockSystemData = {
    localization: {
      locales,
      keymaps,
      timezones,
    },
  };

  mockProposedData = {
    localization: {
      locales,
      keymaps,
      timezones,
      keymap: "us",
      timezone: "Europe/Berlin",
      locale: "en_US.UTF-8",
    },
  };
});

it("renders an clarification about settings", () => {
  installerRender(<L10nPage />);
  screen.getByText(/These are the settings for the product to install/);
  screen.getByText(/The installer language and keyboard layout can be adjusted via/);
  screen.getByText("InstallerOptions Mock");
});

it("renders a section for configuring the language", () => {
  installerRender(<L10nPage />);
  const region = screen.getByRole("region", { name: "Language" });
  within(region).getByText("English - United States");
  within(region).getByText("Change");
});

it("renders a section for configuring the keyboard", () => {
  installerRender(<L10nPage />);
  const region = screen.getByRole("region", { name: "Keyboard" });
  within(region).getByText("English");
  within(region).getByText("Change");
});

it("renders a section for configuring the time zone", () => {
  installerRender(<L10nPage />);
  const region = screen.getByRole("region", { name: "Time zone" });
  within(region).getByText("Europe - Berlin");
  within(region).getByText("Change");
});
