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
import { installerRender } from "~/test-utils";
import MenuButton from "~/components/core/MenuButton";
import { _ } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";
import SpacePolicyMenuItem from "~/components/storage/entries-table/SpacePolicyMenuItem";

const mockSetSpacePolicy = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useSetSpacePolicy: () => mockSetSpacePolicy,
}));

const renderIn = (collection: "drives" | "volumeGroups", policy: ConfigModel.SpacePolicy) =>
  installerRender(
    <MenuButton
      menuProps={{ "aria-label": _("Actions") }}
      items={[
        <SpacePolicyMenuItem key="policy" collection={collection} index={1} policy={policy} />,
      ]}
    >
      Actions
    </MenuButton>,
  );

const openChoices = async (user) => {
  await user.click(screen.getByRole("button", { name: "Actions" }));
  /* The drill-down also renders the title as its way back, so take the item itself. */
  const [item] = screen.getAllByRole("menuitem", { name: /Actions on current content/ });
  await user.click(item);
};

describe("SpacePolicyMenuItem", () => {
  it("sets the chosen policy", async () => {
    const { user } = renderIn("drives", "keep");
    await openChoices(user);
    await user.click(screen.getByRole("menuitem", { name: /Remove all data/ }));

    expect(mockSetSpacePolicy).toHaveBeenCalledWith("drives", 1, { type: "delete" });
  });

  it("changes nothing when choosing the current policy", async () => {
    const { user } = renderIn("drives", "delete");
    await openChoices(user);
    await user.click(screen.getByRole("menuitem", { name: /Remove all data/ }));

    expect(mockSetSpacePolicy).not.toHaveBeenCalled();
  });

  it("speaks of partitions on a disk and of logical volumes on a volume group", async () => {
    const disk = renderIn("drives", "keep");
    await openChoices(disk.user);
    screen.getByText("Some partitions may be reduced if needed");
    disk.unmount();

    const group = renderIn("volumeGroups", "keep");
    await openChoices(group.user);
    screen.getByText("Some logical volumes may be reduced if needed");
  });

  it("leads back to the full menu", async () => {
    const { user } = renderIn("drives", "keep");
    await openChoices(user);

    screen.getByRole("menuitem", { name: "Back from Actions on current content" });
  });
});
