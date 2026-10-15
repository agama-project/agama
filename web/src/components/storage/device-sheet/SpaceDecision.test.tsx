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

const options = () => screen.getByRole("group", { name: "Set all partitions to" });

describe("SpaceDecision", () => {
  it("offers the three decisions in the words of the Action column", () => {
    installerRender(<SpaceDecision collection="drives" index={0} current="keep" />);

    const names = within(options())
      .getAllByRole("button")
      .map((button) => button.textContent);

    expect(names).toEqual(["Delete", "Shrink if needed", "Keep"]);
  });

  it("speaks of logical volumes in a volume group", () => {
    installerRender(
      <SpaceDecision collection="volumeGroups" index={0} isVolumeGroup current="keep" />,
    );

    screen.getByRole("group", { name: "Set all logical volumes to" });
  });

  it("reads pressed the decision every partition shares", () => {
    installerRender(<SpaceDecision collection="drives" index={0} current="keep" />);

    screen.getByRole("button", { name: "Keep", pressed: true });
    screen.getByRole("button", { name: "Delete", pressed: false });
  });

  it("reads none pressed when the partitions are given different decisions", () => {
    installerRender(<SpaceDecision collection="drives" index={0} />);

    expect(within(options()).queryAllByRole("button", { pressed: true })).toEqual([]);
  });

  it("gives every partition the decision chosen", async () => {
    const { user } = installerRender(<SpaceDecision collection="drives" index={0} />);
    await user.click(screen.getByRole("button", { name: "Shrink if needed" }));

    expect(mockSetSpacePolicy).toHaveBeenCalledWith("drives", 0, { type: "resize" });
  });

  it("leaves the configuration alone when the decision already taken is pressed", async () => {
    const { user } = installerRender(
      <SpaceDecision collection="drives" index={0} current="delete" />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(mockSetSpacePolicy).not.toHaveBeenCalled();
  });
});
