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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import SpaceDecision from "~/components/storage/device-sheet/SpaceDecision";

const mockSetSpacePolicy = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useSetSpacePolicy: () => mockSetSpacePolicy,
}));

/** Opens the menu and gives back its items. */
const openMenu = async (user) => {
  await user.click(screen.getByRole("button", { name: "Set all to" }));
  return screen.getByRole("menu", { name: "Set all to" });
};

describe("SpaceDecision", () => {
  it("offers the three decisions in the words of the Action column, safest first", async () => {
    const { user } = installerRender(<SpaceDecision collection="drives" index={0} />);
    const menu = await openMenu(user);

    const names = within(menu)
      .getAllByRole("menuitem")
      .map((item) => within(item).getByText(/^(Keep|Shrink if needed|Delete)$/).textContent);

    expect(names).toEqual(["Keep", "Shrink if needed", "Delete"]);
  });

  it("says what each decision means in the menu", async () => {
    const { user } = installerRender(<SpaceDecision collection="drives" index={0} />);
    const menu = await openMenu(user);

    within(menu).getByText("Their data is lost, and the space is freed for the new system.");
  });

  it("gives every partition the decision chosen", async () => {
    const { user } = installerRender(<SpaceDecision collection="drives" index={0} />);
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole("menuitem", { name: /^Shrink if needed/ }));

    expect(mockSetSpacePolicy).toHaveBeenCalledWith("drives", 0, { type: "resize" });
  });

  it("leaves the configuration alone when every partition already has it", async () => {
    const { user } = installerRender(
      <SpaceDecision collection="drives" index={0} current="delete" />,
    );
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole("menuitem", { name: /^Delete/ }));

    expect(mockSetSpacePolicy).not.toHaveBeenCalled();
  });
});
