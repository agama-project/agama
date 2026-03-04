/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { useSystem } from "~/hooks/model/system/l10n";
import { useProposal } from "~/hooks/model/proposal/l10n";
import { Keymap, Locale, Timezone } from "~/model/system/l10n";
import L10nPage from "./L10nPage";

let mockSystemData: ReturnType<typeof useSystem>;
let mockProposedData: ReturnType<typeof useProposal>;

const locales: Locale[] = [
  { id: "en_US.UTF-8", language: "English", territory: "United States" },
  { id: "es_ES.UTF-8", language: "Spanish", territory: "Spain" },
];

const keymaps: Keymap[] = [
  { id: "us", description: "English" },
  { id: "es", description: "Spanish" },
];

const timezones: Timezone[] = [
  { id: "Europe/Berlin", parts: ["Europe", "Berlin"], country: "Germany", utcOffset: 120 },
  { id: "Europe/Madrid", parts: ["Europe", "Madrid"], country: "Spain", utcOffset: 120 },
];

jest.mock("~/components/core/InstallerL10nOptions", () => () => (
  <div>InstallerL10nOptions Mock</div>
));

jest.mock("~/hooks/model/system/l10n", () => ({
  ...jest.requireActual("~/hooks/model/system/l10n"),
  useSystem: () => mockSystemData,
}));

jest.mock("~/hooks/model/proposal/l10n", () => ({
  ...jest.requireActual("~/hooks/model/proposal/l10n"),
  useProposal: () => mockProposedData,
}));

beforeEach(() => {
  mockSystemData = {
    locales,
    keymaps,
    timezones,
  };

  mockProposedData = {
    locale: "en_US.UTF-8",
    keymap: "us",
    timezone: "Europe/Berlin",
  };
});

it("renders an clarification about settings", () => {
  installerRender(<L10nPage />);
  screen.getByText(/These are the settings for the product to install/);
  screen.getByText(/The installer language and keyboard layout can be adjusted via/);
  screen.getByText("InstallerL10nOptions Mock");
});

it("renders a section for configuring the language", () => {
  installerRender(<L10nPage />);
  const region = screen.getByRole("region", { name: "Language" });
  within(region).getByText("English - United States");
  within(region).getByText("Change");
});

describe("if the language selected is wrong", () => {
  beforeEach(() => {
    mockProposedData.locale = "us_US.UTF-8";
  });

  it("renders a button for selecting a language", () => {
    installerRender(<L10nPage />);
    const region = screen.getByRole("region", { name: "Language" });
    within(region).getByText("Wrong selection");
    within(region).getByText("Select");
  });
});

it("renders a section for configuring the keyboard", () => {
  installerRender(<L10nPage />);
  const region = screen.getByRole("region", { name: "Keyboard" });
  within(region).getByText("English");
  within(region).getByText("Change");
});

describe("if the keyboard selected is wrong", () => {
  beforeEach(() => {
    mockProposedData.keymap = "ess";
  });

  it("renders a button for selecting a keyboard", () => {
    installerRender(<L10nPage />);
    const region = screen.getByRole("region", { name: "Keyboard" });
    within(region).getByText("Wrong selection");
    within(region).getByText("Select");
  });
});

it("renders a section for configuring the time zone", () => {
  installerRender(<L10nPage />);
  const region = screen.getByRole("region", { name: "Time zone" });
  within(region).getByText("Europe - Berlin");
  within(region).getByText("Change");
});

describe("if the time zone selected is wrong", () => {
  beforeEach(() => {
    mockProposedData.timezone = "Europee/Beeerlin";
  });

  it("renders a button for selecting a time zone", () => {
    installerRender(<L10nPage />);
    const region = screen.getByRole("region", { name: "Time zone" });
    within(region).getByText("Wrong selection");
    within(region).getByText("Select");
  });
});
