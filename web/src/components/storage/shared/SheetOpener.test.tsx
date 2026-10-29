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
import { screen } from "@testing-library/react";
import { installerRender, mockNavigateFn, mockRoutes } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import SheetOpener from "~/components/storage/shared/SheetOpener";

const mockConfig: ConfigModel.Config = { drives: [{ name: "/dev/sda" }] };

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig,
}));

const sda = { collection: "drives" as const, index: 0 };

describe("SheetOpener", () => {
  it("is a link, so it can be copied and opened like any other", () => {
    installerRender(<SheetOpener subject={sda}>sda</SheetOpener>);

    screen.getByRole("link", { name: "sda" });
  });

  it("points at the page showing what it opens", async () => {
    const { user } = installerRender(<SheetOpener subject={sda}>sda</SheetOpener>);
    await user.click(screen.getByRole("link"));

    expect(mockNavigateFn).toHaveBeenCalledWith(
      { search: "?device=drives.sda" },
      { replace: true },
    );
  });

  it("keeps whatever else the address was saying", async () => {
    mockRoutes("/storage?settingsTab=1");
    const { user } = installerRender(<SheetOpener subject={sda}>sda</SheetOpener>);
    await user.click(screen.getByRole("link"));

    expect(mockNavigateFn).toHaveBeenCalledWith(
      { search: "?settingsTab=1&device=drives.sda" },
      { replace: true },
    );
  });
});
