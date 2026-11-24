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
import type { Storage } from "~/model/system";
import type { Entry } from "~/components/storage/device-details/entry";
import BootStatement from "~/components/storage/device-details/BootStatement";

const mockConfig = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

const entry = (device: Entry["device"] = null): Entry => ({
  config: { name: "/dev/vdd" } as Partitionable.Device,
  device,
  name: "vdd",
  isVolumeGroup: false,
});

const config = (boot: ConfigModel.Config["boot"]): ConfigModel.Config => ({
  boot,
  drives: [{ name: "/dev/vdd" }],
  mdRaids: [],
  volumeGroups: [],
});

const bootsFromDisk = config({ configure: true, device: { default: true, name: "/dev/vdd" } });

describe("BootStatement", () => {
  it("says new partitions may be created to boot the system", () => {
    mockConfig.mockReturnValue(bootsFromDisk);
    installerRender(<BootStatement entry={entry()} />);

    screen.getByText("Additional partitions to boot the system may be created if needed.");
  });

  it("says an existing partition may be used when the disk has one fit for booting", () => {
    mockConfig.mockReturnValue(bootsFromDisk);
    const disk = {
      name: "/dev/vdd",
      partitions: [{ name: "/dev/vdd1", partition: { efi: true } }],
    } as Storage.Device;
    installerRender(<BootStatement entry={entry(disk)} />);

    screen.getByText(/some existing partition may be used/);
  });

  it("leaves the way to the boot options to the view showing it", () => {
    mockConfig.mockReturnValue(bootsFromDisk);
    installerRender(<BootStatement entry={entry()} />);

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says nothing when the disk does not boot the machine", () => {
    mockConfig.mockReturnValue(config({ configure: false }));
    installerRender(<BootStatement entry={entry()} />);

    expect(screen.queryByText(/boot the system/)).toBeNull();
  });
});
