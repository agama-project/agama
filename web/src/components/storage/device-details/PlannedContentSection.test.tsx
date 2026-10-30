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
import { installerRender, mockNavigateFn } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-details/entry";
import PlannedContentSection from "~/components/storage/device-details/PlannedContentSection";

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useDeletePartition: () => jest.fn(),
  useDeleteLogicalVolume: () => jest.fn(),
}));

const group = (logicalVolumes: ConfigModel.LogicalVolume[]): Entry => ({
  config: { vgName: "system", name: "/dev/system", logicalVolumes },
  device: null,
  name: "system",
  isVolumeGroup: true,
});

const subject = { collection: "volumeGroups" as const, index: 0 };

describe("PlannedContentSection", () => {
  it("says nothing is planned yet instead of showing a table with no rows", () => {
    installerRender(<PlannedContentSection entry={group([])} subject={subject} />);

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("paragraph")).toHaveTextContent("No logical volumes planned yet");
  });

  it("leads to the form of this very group, by its place in the configuration", async () => {
    const { user } = installerRender(
      <PlannedContentSection
        entry={group([])}
        subject={{ collection: "volumeGroups", index: 2 }}
      />,
    );
    await user.click(screen.getByRole("link", { name: "Add logical volume" }));

    expect(mockNavigateFn).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/storage/volume-groups/2/logical-volumes/add" }),
      expect.anything(),
    );
  });

  it("offers the same way to add as under a table", () => {
    const { rerender } = installerRender(
      <PlannedContentSection entry={group([])} subject={subject} />,
    );
    screen.getByRole("link", { name: "Add logical volume" });

    rerender(<PlannedContentSection entry={group([{ mountPath: "/home" }])} subject={subject} />);
    screen.getByRole("table", { name: "Planned content" });
    screen.getByRole("link", { name: "Add logical volume" });
  });
});
