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
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-details/entry";
import UsedByStatement from "~/components/storage/device-details/UsedByStatement";

const mockConfig = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useFlattenDevices: () => [{ sid: 1, name: "/dev/vdd" }],
}));

const entry: Entry = {
  config: { name: "/dev/vdd" } as Partitionable.Device,
  device: null,
  name: "vdd",
  isVolumeGroup: false,
};

const config = (targetDevices: string[]): ConfigModel.Config => ({
  drives: [{ name: "/dev/vdd" }],
  mdRaids: [],
  volumeGroups: [{ vgName: "system", targetDevices }],
});

describe("UsedByStatement", () => {
  it("names the volume group the disk gives room to, as a way to its panel", () => {
    mockConfig.mockReturnValue(config(["/dev/vdd"]));
    installerRender(<UsedByStatement entry={entry} />);

    screen.getByText(/Partitions needed as physical volumes for/);
    screen.getByRole("link", { name: "system" });
  });

  it("says nothing when no volume group takes room from the disk", () => {
    mockConfig.mockReturnValue(config([]));
    installerRender(<UsedByStatement entry={entry} />);

    expect(screen.queryByText(/physical volumes/)).toBeNull();
  });
});
