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
import { act, screen } from "@testing-library/react";
import { createCallbackMock } from "@test-utils/mocks";
import { installerRender } from "@test-utils/renderers";
import { LanguageSelector } from "@components/language";
import { createClient } from "@client";

jest.mock("@client");

const languages = [
  { id: "en_US", name: "English" },
  { id: "de_DE", name: "German" }
];

const setLanguagesFn = jest.fn().mockResolvedValue();
let onLanguageChangeFn = jest.fn();

const languageMock = {
  getLanguages: () => Promise.resolve(languages),
  getSelectedLanguages: () => Promise.resolve(["en_US"]),
  setLanguages: setLanguagesFn,
};

beforeEach(() => {
  // if defined outside, the mock is cleared automatically
  createClient.mockImplementation(() => {
    return {
      language: {
        ...languageMock,
        onLanguageChange: onLanguageChangeFn
      }
    };
  });
});

it("displays the proposal", async () => {
  installerRender(<LanguageSelector />);
  await screen.findByText("English");
});

describe("when the user changes the language", () => {
  it("changes the selected language", async () => {
    const { user } = installerRender(<LanguageSelector />);
    const button = await screen.findByRole("button", { name: "English" });
    await user.click(button);

    const languageSelector = await screen.findByLabelText("Language");
    await user.selectOptions(languageSelector, ["German"]);
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByRole("button", { name: "German" });
    expect(setLanguagesFn).toHaveBeenCalledWith(["de_DE"]);
  });
});

describe("when the user changes the language but cancels", () => {
  it("does not change the selected language", async () => {
    const { user } = installerRender(<LanguageSelector />);
    const button = await screen.findByRole("button", { name: "English" });
    await user.click(button);

    const languageSelector = await screen.findByLabelText("Language");
    await user.selectOptions(languageSelector, ["German"]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await screen.findByRole("button", { name: "English" });
    expect(setLanguagesFn).not.toHaveBeenCalled();
  });
});

describe("when the user changes the language AND THEN cancels", () => {
  it("reverts to the selected language, not English", async () => {
    const { user } = installerRender(<LanguageSelector />);
    const button = await screen.findByRole("button", { name: "English" });
    await user.click(button);

    const languageSelector = await screen.findByLabelText("Language");
    await user.selectOptions(languageSelector, ["German"]);
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    const button2 = await screen.findByRole("button", { name: "German" });
    await user.click(button2);

    await screen.findByLabelText("Language");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await screen.findByRole("button", { name: "German" });
    expect(setLanguagesFn).toHaveBeenCalledTimes(1);
    expect(setLanguagesFn).toHaveBeenCalledWith(["de_DE"]);
  });
});

describe("when the Language Selection changes", () => {
  it("updates the proposal", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    onLanguageChangeFn = mockFunction;

    installerRender(<LanguageSelector />);
    await screen.findByRole("button", { name: "English" });

    const [cb] = callbacks;
    act(() => {
      cb("de_DE");
    });
    await screen.findByRole("button", { name: "German" });
  });
});
