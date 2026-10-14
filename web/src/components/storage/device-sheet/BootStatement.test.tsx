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
import type { Entry } from "~/components/storage/device-sheet/entry";
import BootStatement from "~/components/storage/device-sheet/BootStatement";

const mockConfig = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

const entry: Entry = {
  config: { name: "/dev/vdd" } as Partitionable.Device,
  device: null,
  name: "vdd",
  isVolumeGroup: false,
};

const config = (boot: ConfigModel.Config["boot"]): ConfigModel.Config => ({
  boot,
  drives: [{ name: "/dev/vdd" }],
  mdRaids: [],
  volumeGroups: [],
});

describe("BootStatement", () => {
  it("says the disk boots the machine, chosen automatically, with a way to change it", () => {
    mockConfig.mockReturnValue(
      config({ configure: true, device: { default: true, name: "/dev/vdd" } }),
    );
    installerRender(<BootStatement entry={entry} />);

    screen.getByText("Boot");
    screen.getByText("partitions configured here");
    screen.getByRole("link", { name: "automatically chosen" });
  });

  it("says when the disk was chosen by hand", () => {
    mockConfig.mockReturnValue(
      config({ configure: true, device: { default: false, name: "/dev/vdd" } }),
    );
    installerRender(<BootStatement entry={entry} />);

    screen.getByRole("link", { name: "explicitly chosen" });
  });

  it("says nothing when the disk does not boot the machine", () => {
    mockConfig.mockReturnValue(config({ configure: false }));
    installerRender(<BootStatement entry={entry} />);

    expect(screen.queryByText("Boot")).toBeNull();
  });
});
