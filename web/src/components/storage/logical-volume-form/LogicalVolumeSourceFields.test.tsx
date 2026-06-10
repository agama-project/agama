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
import { useAppForm } from "~/hooks/form";
import { defaultOptions } from "./fields";
import LogicalVolumeSourceFields from "./LogicalVolumeSourceFields";

import type { Storage as System } from "~/model/system";

const existingLogicalVolume = {
  name: "/dev/system/data",
  description: "5.00 GiB",
  filesystem: { type: "ext4" as const, label: "Data" },
} as System.Device;

const systemVolumeGroup = {
  name: "/dev/system",
  description: "Volume group",
  logicalVolumes: [existingLogicalVolume],
} as System.Device;

function TestForm({
  volumeGroup,
  availableLogicalVolumes = [existingLogicalVolume],
}: {
  volumeGroup?: System.Device;
  availableLogicalVolumes?: System.Device[];
}) {
  const form = useAppForm({ ...defaultOptions });
  return (
    <LogicalVolumeSourceFields
      form={form}
      volumeGroup={volumeGroup}
      availableLogicalVolumes={availableLogicalVolumes}
    />
  );
}

describe("LogicalVolumeSourceFields", () => {
  describe("when the volume group is new", () => {
    it("shows a read-only field instead of a selector", () => {
      installerRender(<TestForm volumeGroup={undefined} availableLogicalVolumes={[]} />);
      screen.getByText("New logical volume");
      expect(screen.queryByRole("button", { name: "Logical volume" })).not.toBeInTheDocument();
    });
  });

  describe("when the volume group already exists", () => {
    it("offers a 'New logical volume' option and the existing logical volumes", async () => {
      const { user } = installerRender(<TestForm volumeGroup={systemVolumeGroup} />);
      await user.click(screen.getByLabelText("Logical volume"));
      screen.getByRole("option", { name: /New logical volume/ });
      screen.getByRole("option", { name: /data/ });
    });
  });
});
