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
import type { Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import PartitionableMountContent from "~/components/storage/device-sheet/PartitionableMountContent";

const mockSetFilesystem = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useSetFilesystem: () => mockSetFilesystem,
}));

const device: System.Device = {
  sid: 1,
  name: "/dev/vdd",
  class: "drive",
  filesystem: { sid: 2, type: "xfs" },
};

const entry = (config: Partial<Partitionable.Device>): Entry => ({
  config: { name: "/dev/vdd", ...config } as Partitionable.Device,
  device,
  name: "vdd",
  isVolumeGroup: false,
});

const subject = { collection: "drives" as const, index: 0 };

describe("PartitionableMountContent", () => {
  it("names a new file system and where it is mounted", () => {
    installerRender(
      <PartitionableMountContent
        entry={entry({ mountPath: "/home", filesystem: { default: false, type: "ext4" } })}
        subject={subject}
      />,
    );

    screen.getByText("Ext4");
    screen.getByText(/file system for "\/home"/);
  });

  it("names the file system there now when it is used as it is", () => {
    installerRender(
      <PartitionableMountContent
        entry={entry({ mountPath: "/srv", filesystem: { default: false, reuse: true } })}
        subject={subject}
      />,
    );

    screen.getByText("XFS");
    screen.getByText(/file system, used for "\/srv"/);
  });

  it("offers to change how it is used", () => {
    installerRender(
      <PartitionableMountContent
        entry={entry({ mountPath: "/home", filesystem: { default: false, type: "ext4" } })}
        subject={subject}
      />,
    );

    screen.getByRole("link", { name: "Edit" });
  });

  it("stops using the device for it, leaving nothing planned", async () => {
    const { user } = installerRender(
      <PartitionableMountContent
        entry={entry({ mountPath: "/home", filesystem: { default: false, type: "ext4" } })}
        subject={subject}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Stop using" }));

    expect(mockSetFilesystem).toHaveBeenCalledWith("drives", 0, {});
  });

  it("leaves its name out where a heading already says it", () => {
    installerRender(
      <PartitionableMountContent
        entry={entry({ mountPath: "/home", filesystem: { default: false, type: "ext4" } })}
        subject={subject}
        showName={false}
      />,
    );

    screen.getByText("Ext4");
    expect(screen.queryByText(/file system/)).toBeNull();
  });
});
