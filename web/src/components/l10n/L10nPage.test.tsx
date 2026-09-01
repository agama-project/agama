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
import { useExtendedL10n } from "~/hooks/model/config/l10n";
import { Keymap, Locale, Timezone } from "~/model/system/l10n";
import L10nPage from "./L10nPage";

let mockSystemData: ReturnType<typeof useSystem>;
let mockConfigData: ReturnType<typeof useExtendedL10n>;

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

jest.mock("~/hooks/model/config/l10n", () => ({
  ...jest.requireActual("~/hooks/model/config/l10n"),
  useExtendedL10n: () => mockConfigData,
}));

beforeEach(() => {
  mockSystemData = {
    locales,
    keymaps,
    timezones,
  };

  mockConfigData = {
    locale: "en_US.UTF-8",
    keymap: "us",
    timezone: "Europe/Berlin",
  };
});

it("renders a clarification about settings", () => {
  installerRender(<L10nPage />);
  screen.getByText(/These are the settings for the product to install/);
  const clarification = screen.getByText(
    /The installer language and keyboard layout can be adjusted using/,
  );
  // The header also renders the localization options, so scope the assertion
  // to the clarification text to target the inline control.
  within(clarification).getByText("InstallerL10nOptions Mock");
});

it("renders the language, keyboard and time zone selectors", () => {
  installerRender(<L10nPage />);
  screen.getByRole("combobox", { name: "Language" });
  screen.getByRole("combobox", { name: "Keyboard" });
  screen.getByRole("combobox", { name: "Time zone" });
});

describe("when a configured id is not recognized", () => {
  beforeEach(() => {
    mockConfigData = { locale: "es_ES.UTF-8", keymap: "us", timezone: "Europe/ndorra" };
  });

  it("keeps the recognized settings selected", () => {
    installerRender(<L10nPage />);
    screen.getByRole("combobox", { name: "Language" });
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("Spanish (Spain)");
    expect(screen.getByRole("combobox", { name: "Keyboard" })).toHaveValue("English");
  });
});

describe("when the system reports no localization data yet", () => {
  beforeEach(() => {
    mockSystemData = null;
  });

  it("renders the selectors with no options to choose from", () => {
    installerRender(<L10nPage />);
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Keyboard" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Time zone" })).toHaveValue("");
  });
});
