/*
 * Copyright (c) [2026] SUSE LLC
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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";

const mockPatchConfig = jest.fn();
const mockSystem = jest.fn();
const mockProposal = jest.fn();

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  patchConfig: (config) => mockPatchConfig(config),
}));

jest.mock("~/hooks/model/system/l10n", () => ({
  useSystem: () => mockSystem(),
}));

jest.mock("~/hooks/model/proposal/l10n", () => ({
  useProposal: () => mockProposal(),
}));

const SYSTEM = {
  locales: [
    { id: "en_US.UTF-8", language: "English", territory: "United States" },
    { id: "de_DE.UTF-8", language: "German", territory: "Germany" },
  ],
  keymaps: [
    { id: "us", description: "English (US)" },
    { id: "de", description: "German" },
  ],
  timezones: [
    {
      id: "America/New_York",
      parts: ["America", "New York"],
      country: "United States",
      utcOffset: -300,
    },
    { id: "Europe/Berlin", parts: ["Europe", "Berlin"], country: "Germany", utcOffset: 60 },
  ],
};

const PROPOSAL = {
  locale: "en_US.UTF-8",
  keymap: "us",
  timezone: "America/New_York",
};

const combobox = (name: string) => screen.getByRole("combobox", { name });
const accept = () => screen.getByRole("button", { name: "Accept" });

beforeAll(() => {
  // jsdom does not implement scrollIntoView; the field calls it when opening.
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  mockSystem.mockReturnValue(SYSTEM);
  mockProposal.mockReturnValue(PROPOSAL);
  mockPatchConfig.mockResolvedValue(true);
});

// Imported last so the mocks above are in place.
import L10nForm from "./Form";

describe("L10nForm", () => {
  it("renders a combobox for language, keyboard and time zone", () => {
    installerRender(<L10nForm />);
    combobox("Language");
    combobox("Keyboard");
    combobox("Time zone");
  });

  it("does not send config when nothing changed", async () => {
    const { user } = installerRender(<L10nForm />);
    await user.click(accept());

    expect(mockPatchConfig).not.toHaveBeenCalled();
    await screen.findByText("No changes to apply");
  });

  it("sends only the changed selector", async () => {
    const { user } = installerRender(<L10nForm />);

    await user.click(combobox("Language"));
    await user.click(await screen.findByRole("option", { name: /German/ }));
    await user.click(accept());

    expect(mockPatchConfig).toHaveBeenCalledWith({ l10n: { locale: "de_DE.UTF-8" } });
  });

  it("sends a combined patch when several selectors change", async () => {
    const { user } = installerRender(<L10nForm />);

    await user.click(combobox("Language"));
    await user.click(await screen.findByRole("option", { name: /German/ }));

    await user.click(combobox("Keyboard"));
    await user.click(await screen.findByRole("option", { name: /German/ }));

    await user.click(combobox("Time zone"));
    await user.click(await screen.findByRole("option", { name: /Berlin/ }));

    await user.click(accept());

    expect(mockPatchConfig).toHaveBeenCalledWith({
      l10n: { locale: "de_DE.UTF-8", keymap: "de", timezone: "Europe/Berlin" },
    });
  });

  it("requires a value and blocks submit when a selector is cleared", async () => {
    const { user } = installerRender(<L10nForm />);

    await user.click(combobox("Language"));
    await user.clear(combobox("Language"));
    await user.click(accept());

    expect(mockPatchConfig).not.toHaveBeenCalled();
    await screen.findByText("Value is required");
  });
});
