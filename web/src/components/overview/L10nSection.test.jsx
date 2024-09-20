/*
 * Copyright (c) [2023] SUSE LLC
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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { L10nSection } from "~/components/overview";

const locales = [
  { id: "en_US.UTF-8", name: "English", territory: "United States" },
  { id: "de_DE.UTF-8", name: "German", territory: "Germany" },
];

jest.mock("~/queries/l10n", () => ({
  useL10n: () => ({ locales, selectedLocale: locales[0] }),
}));

it("displays the selected locale", async () => {
  plainRender(<L10nSection />, { withL10n: true });

  await screen.findByText("English (United States)");
});
