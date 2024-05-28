/*
 * Copyright (c) [2023] SUSE LLC
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
import { act, screen } from "@testing-library/react";
import { createCallbackMock, installerRender } from "~/test-utils";
import { L10nSection } from "~/components/overview";
import { createClient } from "~/client";

jest.mock("~/client");

const locales = [
  { id: "en_US", name: "English", territory: "United States" },
  { id: "de_DE", name: "German", territory: "Germany" },
];

const l10nClientMock = {
  locales: jest.fn().mockResolvedValue(locales),
  getLocales: jest.fn().mockResolvedValue(["en_US"]),
  getUILocale: jest.fn().mockResolvedValue("en_US"),
  getUIKeymap: jest.fn().mockResolvedValue("en"),
  keymaps: jest.fn().mockResolvedValue([]),
  getKeymap: jest.fn().mockResolvedValue(undefined),
  timezones: jest.fn().mockResolvedValue([]),
  getTimezone: jest.fn().mockResolvedValue(undefined),
  onLocalesChange: jest.fn(),
  onKeymapChange: jest.fn(),
  onTimezoneChange: jest.fn(),
};

beforeEach(() => {
  // if defined outside, the mock is cleared automatically
  createClient.mockImplementation(() => {
    return {
      onConnect: jest.fn(),
      onDisconnect: jest.fn(),
      l10n: l10nClientMock,
    };
  });
});

it("displays the selected locale", async () => {
  installerRender(<L10nSection />, { withL10n: true });

  await screen.findByText("English (United States)");
});

describe("when the selected locales change", () => {
  it("updates the proposal", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    l10nClientMock.onLocalesChange = mockFunction;

    installerRender(<L10nSection />, { withL10n: true });
    await screen.findByText("English (United States)");

    const [cb] = callbacks;
    act(() => cb(["de_DE"]));

    await screen.findByText("German (Germany)");
  });
});
