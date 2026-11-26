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
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type { Entry } from "~/components/storage/device-details/entry";
import DetailsSection from "~/components/storage/device-details/DetailsSection";
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

const home: ConfigModel.LogicalVolume = {
  mountPath: "/home",
  size: { default: false, min: 5 * 1024 ** 3 },
};

const disk = (partitions: ConfigModel.Partition[]): Entry => ({
  config: { name: "/dev/vdd", partitions } as Partitionable.Device,
  device: {
    sid: 1,
    name: "/dev/vdd",
    class: "drive",
    partitions: [
      { sid: 2, name: "/dev/vdd1", class: "partition", filesystem: { sid: 3, type: "ext4" } },
    ],
  } as System.Device,
  name: "vdd",
  isVolumeGroup: false,
});

const diskSubject = { collection: "drives" as const, index: 0 };

const reused = (reuse: boolean): ConfigModel.Partition => ({
  name: "/dev/vdd1",
  mountPath: "/data",
  filesystem: { reuse, default: false, type: "ext4" },
  size: { default: true, min: 1024 ** 3 },
});

const actionOf = (path: string) =>
  within(screen.getByRole("row", { name: new RegExp(path) })).getAllByRole("cell")[2];

describe("PlannedContentSection", () => {
  it("lists what is planned, with a generic name outside a section", () => {
    installerRender(<PlannedContentSection entry={group([home])} subject={subject} />);

    const table = screen.getByRole("table", { name: "Planned content" });
    expect(table).toHaveTextContent("/home");
  });

  it("takes its name from the title of the section it is in", () => {
    installerRender(
      <DetailsSection title="Logical volumes for the new system">
        <PlannedContentSection entry={group([home])} subject={subject} />
      </DetailsSection>,
    );

    screen.getByRole("table", { name: "Logical volumes for the new system" });
  });

  it("sets apart a reused partition that is formatted, since its data is lost", () => {
    installerRender(<PlannedContentSection entry={disk([reused(false)])} subject={diskSubject} />);

    const loss = within(actionOf("/data")).getByRole("strong");
    expect(loss).toHaveTextContent('Format "vdd1"');
  });

  it("does not set apart a reused partition that keeps its data", () => {
    installerRender(<PlannedContentSection entry={disk([reused(true)])} subject={diskSubject} />);

    const action = actionOf("/data");
    expect(action).toHaveTextContent('Mount "vdd1"');
    expect(within(action).queryByRole("strong")).toBeNull();
  });
});
