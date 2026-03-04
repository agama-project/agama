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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import L10nSummary from "./L10nSummary";
import { L10N } from "~/routes/paths";
import { useSystem } from "~/hooks/model/system/l10n";

jest.mock("~/hooks/model/system/l10n", () => ({
  useSystem: (): ReturnType<typeof useSystem> => ({
    locales: [
      {
        id: "es_ES",
        language: "Spanish",
        territory: "Spain",
      },
      {
        id: "en_US",
        language: "English",
        territory: "United States",
      },
    ],
    keymaps: [
      {
        id: "es",
        description: "Spanish",
      },
      {
        id: "us",
        description: "English (US)",
      },
    ],
    timezones: [
      {
        id: "Atlantic/Canary",
        parts: ["Atlantic", "Canary"],
        country: "Spain",
        utcOffset: 0,
      },
      {
        id: "America/New_York",
        parts: ["America", "New_York"],
        country: "United States",
        utcOffset: -300,
      },
    ],
  }),
}));

jest.mock("~/hooks/model/proposal/l10n", () => ({
  useProposal: () => ({
    locale: "es_ES",
    keymap: "es",
    timezone: "Atlantic/Canary",
  }),
}));

describe("L10nSummary", () => {
  it("renders the clickable 'Language and region' header", () => {
    installerRender(<L10nSummary />);
    const heading = screen.getByRole("heading");
    const link = within(heading).getByRole("link", { name: "Language and region" });
    expect(link).toHaveAttribute("href", expect.stringContaining(L10N.root));
  });

  it("renders the language and territory title", () => {
    installerRender(<L10nSummary />);
    screen.getByText("Spanish (Spain)");
  });

  it("renders the keyboard layout and timezone description", () => {
    installerRender(<L10nSummary />);
    screen.getByText("Spanish keyboard - Atlantic/Canary timezone");
  });
});
