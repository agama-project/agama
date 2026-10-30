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
import SpaceDecision, {
  SpaceDecisionProps,
} from "~/components/storage/device-details/SpaceDecision";

const mockSetSpacePolicy = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useSetSpacePolicy: () => mockSetSpacePolicy,
}));

const Example = (props: Partial<SpaceDecisionProps>) => (
  <SpaceDecision collection="drives" index={0} policy="keep" {...props} />
);

const toggle = () => screen.getByRole("button", { name: /^Actions for all/ });

/** Opens the menu and gives back the title of each item, in order. */
const openItems = async (user) => {
  await user.click(toggle());
  return screen
    .getAllByRole("menuitem")
    .map((item) => within(item).getByText(/^(Keep|Shrink|Delete)/).textContent);
};

const item = (name: RegExp) => screen.getByRole("menuitem", { name });

describe("SpaceDecision", () => {
  beforeEach(() => mockSetSpacePolicy.mockClear());

  it("is named by what its actions apply to", () => {
    installerRender(<Example />);
    screen.getByRole("button", { name: "Actions for all partitions" });
  });

  it("offers the three actions safest first", async () => {
    const { user } = installerRender(<Example />);

    expect(await openItems(user)).toEqual([
      "Keep all partitions",
      "Shrink partitions if needed and possible",
      "Delete all partitions",
    ]);
  });

  it("speaks of logical volumes on a volume group", async () => {
    const { user } = installerRender(<Example collection="volumeGroups" />);

    screen.getByRole("button", { name: "Actions for all logical volumes" });
    expect(await openItems(user)).toEqual([
      "Keep all logical volumes",
      "Shrink logical volumes if needed and possible",
      "Delete all logical volumes",
    ]);
  });

  it("leaves partitions with a mount point out of deleting them all", async () => {
    const { user } = installerRender(<Example someReused />);

    expect(await openItems(user)).toContain("Delete all partitions with no mount point");
  });

  it("says what each action means", async () => {
    const { user } = installerRender(<Example />);
    await user.click(toggle());

    screen.getByText("Only the currently available space will be used for new partitions.");
    screen.getByText("The size of some existing partitions may be reduced, keeping their data.");
    screen.getByText("Their data is lost and their space is freed.");
  });

  it("gives every partition the action chosen", async () => {
    const { user } = installerRender(<Example />);
    await user.click(toggle());
    await user.click(item(/^Shrink partitions if needed/));

    expect(mockSetSpacePolicy).toHaveBeenCalledWith("drives", 0, { type: "resize" });
  });

  it("leaves the configuration alone when the device already has the action", async () => {
    const { user } = installerRender(<Example policy="delete" />);
    await user.click(toggle());
    await user.click(item(/^Delete all partitions/));

    expect(mockSetSpacePolicy).not.toHaveBeenCalled();
  });
});
