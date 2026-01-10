/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import LocaleSelection from "./LocaleSelection";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { mockNavigateFn, installerRender } from "~/test-utils";
import { Locale } from "~/model/system/l10n";

const mockPatchConfigFn = jest.fn();

const locales: Locale[] = [
  { id: "en_US.UTF-8", language: "English", territory: "United States" },
  { id: "es_ES.UTF-8", language: "Spanish", territory: "Spain" },
];

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigateFn,
}));

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  patchConfig: (config) => mockPatchConfigFn(config),
}));

jest.mock("~/hooks/model/system/l10n", () => ({
  ...jest.requireActual("~/hooks/model/system/l10n"),
  useSystem: () => ({ locales }),
}));

jest.mock("~/hooks/model/proposal/l10n", () => ({
  ...jest.requireActual("~/hooks/model/proposal/l10n"),
  useProposal: () => ({ locales, locale: "us_US.UTF-8", keymap: "us" }),
}));

it("allows changing the language", async () => {
  installerRender(<LocaleSelection />);

  const option = await screen.findByText("Spanish");
  await userEvent.click(option);
  const button = await screen.findByRole("button", { name: "Select" });
  await userEvent.click(button);
  expect(mockPatchConfigFn).toHaveBeenCalledWith({
    l10n: { locale: "es_ES.UTF-8" },
  });
  expect(mockNavigateFn).toHaveBeenCalledWith(-1);
});
