/*
 * Copyright (c) [2024] SUSE LLC
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
import KeyboardSelection from "./KeyboardSelection";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { mockNavigateFn, plainRender } from "~/test-utils";

const keymaps = [
  { id: "us", name: "English" },
  { id: "es", name: "Spanish" },
];

const mockConfigMutation = {
  mutate: jest.fn(),
};

jest.mock("~/queries/l10n", () => ({
  ...jest.requireActual("~/queries/l10n"),
  useConfigMutation: () => mockConfigMutation,
  useL10n: () => ({ keymaps, selectedKeymap: keymaps[0] }),
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigateFn,
}));

it("allows changing the keyboard", async () => {
  plainRender(<KeyboardSelection />);

  const option = await screen.findByText("Spanish");
  await userEvent.click(option);
  const button = await screen.findByRole("button", { name: "Select" });
  await userEvent.click(button);
  expect(mockConfigMutation.mutate).toHaveBeenCalledWith({ keymap: "es" });
  expect(mockNavigateFn).toHaveBeenCalledWith(-1);
});
