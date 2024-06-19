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

import InstallerKeymapSwitcher from "./InstallerKeymapSwitcher";

let mockChangeKeyboardFn;

jest.mock("~/lib/cockpit", () => ({
  gettext: term => term,
}));

jest.mock("~/context/installerL10n", () => ({
  ...jest.requireActual("~/context/installerL10n"),
  useInstallerL10n: () => ({
    changeKeymap: mockChangeKeyboardFn,
    keymap: "us"
  })
}));

jest.mock("~/context/l10n", () => ({
  ...jest.requireActual("~/context/l10n"),
  useL10n: () => ({
    keymaps: [
      { id: "cz", name: "Czech" },
      { id: "cz(qwerty)", name: "Czech (QWERTY)" },
      { id: "de", name: "German" },
      { id: "us", name: "English (US)" },
      { id: "us(dvorak)", name: "English (Dvorak)" }
    ]
  })
}));

beforeEach(() => {
  mockChangeKeyboardFn = jest.fn();
});

it("InstallerKeymapSwitcher", async () => {
  const { user } = plainRender(<InstallerKeymapSwitcher />);
  const button = screen.getByRole("button", { name: "English (US)" });
  await user.click(button);
  const option = screen.getByRole("option", { name: "Czech" });
  await user.click(option);
  expect(mockChangeKeyboardFn).toHaveBeenCalledWith("cz");
});
