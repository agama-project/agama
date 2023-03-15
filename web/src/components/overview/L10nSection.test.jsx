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
import { installerRender, createCallbackMock } from "~/test-utils";
import { L10nSection } from "~/components/overview";
import { createClient } from "~/client";

jest.mock("~/client");

const languages = [
  { id: "en_US", name: "English" },
  { id: "de_DE", name: "German" }
];

let onLanguageChangeFn = jest.fn();

const languageMock = {
  getLanguages: () => Promise.resolve(languages),
  getSelectedLanguages: () => Promise.resolve(["en_US"]),
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

it("displays the selected language", async () => {
  installerRender(<L10nSection />);

  await screen.findByText("English (en_US)");
});

describe("when the Language Selection changes", () => {
  it("updates the proposal", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    onLanguageChangeFn = mockFunction;

    installerRender(<L10nSection />);
    await screen.findByText("English (en_US)");

    const [cb] = callbacks;
    act(() => {
      cb("de_DE");
    });

    await screen.findByText("German (de_DE)");
  });
});
