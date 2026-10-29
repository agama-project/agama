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
import type { Storage as System } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import VolumeGroupCurrent from "~/components/storage/device-sheet/VolumeGroupCurrent";

const mockConfig = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

const entry = (group: ConfigModel.VolumeGroup, device: System.Device | null = null): Entry => ({
  config: group,
  device,
  name: "system",
  isVolumeGroup: true,
});

const subject = { collection: "volumeGroups" as const, index: 0 };

describe("VolumeGroupCurrent", () => {
  beforeEach(() => {
    mockConfig.mockReturnValue({
      drives: [{ name: "/dev/vda" }],
      mdRaids: [],
      volumeGroups: [{ vgName: "system", targetDevices: ["/dev/vda"] }],
    });
  });

  it("says an existing group holds nothing when it has no logical volumes", () => {
    installerRender(
      <VolumeGroupCurrent
        entry={entry(
          { vgName: "system", name: "/dev/system" },
          { sid: 9, name: "/dev/system", logicalVolumes: [] },
        )}
        subject={subject}
      />,
    );

    screen.getByText("No logical volumes detected.");
  });
});
