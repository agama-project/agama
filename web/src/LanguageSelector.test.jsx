/*
 * Copyright (c) [2022] SUSE LLC
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
import userEvent from "@testing-library/user-event";
import { installerRender } from "./test-utils";
import LanguageSelector from "./LanguageSelector";
import { createClient } from "./lib/client";

jest.mock("./lib/client");

const languages = [
  { id: "en_US", name: "English" },
  { id: "de_DE", name: "German" }
];

const setLanguagesFn = jest.fn().mockResolvedValue();

const languageMock = {
  getLanguages: () => Promise.resolve(languages),
  getSelectedLanguages: () => Promise.resolve(["en_US"]),
  setLanguages: setLanguagesFn
};

beforeEach(() => {
  // if defined outside, the mock is cleared automatically
  createClient.mockImplementation(() => {
    return { language: languageMock };
  });
});

it("displays the proposal", async () => {
  installerRender(<LanguageSelector />);
  await screen.findByText("English");
});

describe("when the user changes the language", () => {
  it("changes the selected language", async () => {
    installerRender(<LanguageSelector />);
    const button = await screen.findByRole("button", { name: "English" });
    userEvent.click(button);

    const languageSelector = await screen.findByLabelText("Select language");
    userEvent.selectOptions(languageSelector, ["German"]);
    userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByRole("button", { name: "German" });
    expect(setLanguagesFn).toHaveBeenCalledWith(["de_DE"]);
  });
});
