/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { screen } from "@testing-library/react";
import { installerRender, mockNavigateFn } from "~/test-utils";
import { L10nPage } from "~/components/l10n";
import { createClient } from "~/client";

const setLanguagesFn = jest.fn();
const languages = [
  { id: "en_US", name: "English" },
  { id: "de_DE", name: "German" }
];

jest.mock("~/client");

beforeEach(() => {
  // if defined outside, the mock is cleared automatically
  createClient.mockImplementation(() => {
    return {
      language: {
        getLanguages: () => Promise.resolve(languages),
        getSelectedLanguages: () => Promise.resolve(["en_US"]),
        setLanguages: setLanguagesFn,
      }
    };
  });
});

it("displays the language selector", async () => {
  installerRender(<L10nPage />);

  await screen.findByLabelText("Language");
});

describe("when the user accept changes", () => {
  it("changes the selected language", async () => {
    const { user } = installerRender(<L10nPage />);
    const germanOption = await screen.findByRole("option", { name: "German" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    await user.selectOptions(screen.getByLabelText("Language"), germanOption);
    await user.click(acceptButton);

    expect(setLanguagesFn).toHaveBeenCalledWith(["de_DE"]);
  });

  it("navigates to the root path", async () => {
    const { user } = installerRender(<L10nPage />);
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(acceptButton);

    expect(mockNavigateFn).toHaveBeenCalledWith("/");
  });
});
