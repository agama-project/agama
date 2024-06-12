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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import InstallerLocaleSwitcher from "./InstallerLocaleSwitcher";

const mockLanguage = "es-es";
let mockChangeLanguageFn;

jest.mock("~/languages.json", () => ({
  "de-de": "Deutsch",
  "en-us": "English (US)",
  "es-es": "Español"
}));

jest.mock("~/context/installerL10n", () => ({
  ...jest.requireActual("~/context/installerL10n"),
  useInstallerL10n: () => ({
    language: mockLanguage,
    changeLanguage: mockChangeLanguageFn
  })
}));

beforeEach(() => {
  mockChangeLanguageFn = jest.fn();
});

it("InstallerLocaleSwitcher", async () => {
  const { user } = plainRender(<InstallerLocaleSwitcher />);
  const button = screen.getByRole("button", { name: "Español" });
  await user.click(button);
  const option = screen.getByRole("option", { name: "English (US)" });
  await user.click(option);
  expect(mockChangeLanguageFn).toHaveBeenCalledWith("en-us");
});
