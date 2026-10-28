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
  description: "Ext4 logical volume",
  filesystem: { type: "ext4" as const, label: "Data" },
} as System.Device;

const emptyLogicalVolume = {
  name: "/dev/system/scratch",
  description: "Logical volume",
  filesystem: undefined,
} as System.Device;

const systemVolumeGroup = {
  name: "/dev/system",
  description: "Volume group",
  logicalVolumes: [existingLogicalVolume, emptyLogicalVolume],
} as System.Device;

function TestForm({
  volumeGroup,
  availableLogicalVolumes = [existingLogicalVolume, emptyLogicalVolume],
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
    it("does not render the field at all", () => {
      installerRender(<TestForm volumeGroup={undefined} availableLogicalVolumes={[]} />);
      expect(screen.queryByText("Logical volume")).not.toBeInTheDocument();
      expect(screen.queryByText(/New logical volume/)).not.toBeInTheDocument();
    });
  });

  describe("when there are no logical volumes left to reuse", () => {
    it("shows a read-only field explaining that a new logical volume will be created", () => {
      installerRender(<TestForm volumeGroup={systemVolumeGroup} availableLogicalVolumes={[]} />);
      screen.getByText(/New logical volume. There are no available existing logical volumes/);
      expect(screen.queryByRole("button", { name: "Logical volume" })).not.toBeInTheDocument();
    });
  });

  describe("when the volume group already exists", () => {
    it("offers a 'New logical volume' option and the existing logical volumes", async () => {
      const { user } = installerRender(<TestForm volumeGroup={systemVolumeGroup} />);
      await user.click(screen.getByLabelText("Logical volume"));
      screen.getByRole("option", { name: /New logical volume/ });
      screen.getByRole("option", { name: /data/ });
      screen.getByRole("option", { name: /scratch/ });
    });

    it("explains the 'New logical volume' option", async () => {
      const { user } = installerRender(<TestForm volumeGroup={systemVolumeGroup} />);
      await user.click(screen.getByLabelText("Logical volume"));
      screen.getByRole("option", { name: /Create a new logical volume on system/ });
    });

    it("describes the data each existing logical volume holds", async () => {
      const { user } = installerRender(<TestForm volumeGroup={systemVolumeGroup} />);
      await user.click(screen.getByLabelText("Logical volume"));
      screen.getByRole("option", { name: /Use current Ext4 logical volume/ });
      screen.getByRole("option", { name: /scratch.*Use current Logical volume/ });
    });

    it("includes the filesystem label in the option label when available", async () => {
      const { user } = installerRender(<TestForm volumeGroup={systemVolumeGroup} />);
      await user.click(screen.getByLabelText("Logical volume"));
      screen.getByRole("option", { name: /data - Data/ });
    });

    it("pre-selects 'New logical volume' by default", async () => {
      const { user } = installerRender(<TestForm volumeGroup={systemVolumeGroup} />);
      await user.click(screen.getByLabelText("Logical volume"));
      expect(screen.getByRole("option", { name: /New logical volume/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });
});
