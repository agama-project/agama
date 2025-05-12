/*
 * Copyright (c) [2025] SUSE LLC
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
import LanguageAndKeyboard from "./LanguageAndKeyboard";
import { InstallationPhase } from "~/types/status";

let phase: InstallationPhase;
let isBusy: boolean;

jest.mock("~/queries/status", () => ({
  useInstallerStatus: () => ({
    phase,
    isBusy,
  }),
}));

const locales = [
  { id: "en_US.UTF-8", name: "English", territory: "United States" },
  { id: "es_ES.UTF-8", name: "Spanish", territory: "Spain" },
];

const keymaps = [
  { id: "us", name: "English (US)" },
  { id: "gb", name: "English (UK)" },
];

const mockL10nConfigMutation = {
  mutate: jest.fn(),
};

const mockChangeUIKeymap = jest.fn();
const mockChangeUILanguage = jest.fn();

jest.mock("~/queries/l10n", () => ({
  ...jest.requireActual("~/queries/l10n"),
  useL10n: () => ({ locales, selectedLocale: locales[0] }),
  useConfigMutation: () => mockL10nConfigMutation,
  keymapsQuery: () => ({
    queryKey: ["keymaps"],
    queryFn: () => keymaps,
  }),
}));

jest.mock("~/context/installerL10n", () => ({
  ...jest.requireActual("~/context/installerL10n"),
  useInstallerL10n: () => ({
    keymap: "us",
    language: "de-DE",
    changeKeymap: mockChangeUIKeymap.mockResolvedValue(true),
    changeLanguage: mockChangeUILanguage.mockResolvedValue(true),
  }),
}));

describe("ChangeProductOption", () => {
  beforeEach(() => {
    phase = InstallationPhase.Config;
    isBusy = false;
  });

  it("renders button with current language and keyboard values", () => {
    installerRender(<LanguageAndKeyboard />, { withL10n: true });
    const languageAndKeyboardButton = screen.getByRole("button", {
      name: "Change display language and keyboard layout",
    });
    within(languageAndKeyboardButton).getByText(/Deutsch/);
    within(languageAndKeyboardButton).getByText(/us/);
  });

  it("allows opening the language and keyboard settings dialog", async () => {
    const { user } = installerRender(<LanguageAndKeyboard />, { withL10n: true });
    const languageAndKeyboardButton = screen.getByRole("button", {
      name: "Change display language and keyboard layout",
    });
    await user.click(languageAndKeyboardButton);
    screen.getByRole("dialog", { name: "Language & Keyboard" });
  });
});
