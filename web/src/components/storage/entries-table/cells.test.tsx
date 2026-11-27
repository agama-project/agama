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
import { plainRender } from "~/test-utils";
import CellValues from "~/components/storage/entries-table/CellValues";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import {
  driveUsedFor,
  volumeGroupUsedFor,
  ExistingDataCell,
} from "~/components/storage/entries-table/cells";

const mockSystemDevices = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useFlattenDevices: () => mockSystemDevices(),
}));

const partition = (values: Partial<ConfigModel.Partition>) => values as ConfigModel.Partition;
const volume = (values: Partial<ConfigModel.LogicalVolume>) => values as ConfigModel.LogicalVolume;
const drive = (values: Partial<ConfigModel.Drive>) =>
  ({ name: "/dev/vda", ...values }) as ConfigModel.Drive;
const group = (values: Partial<ConfigModel.VolumeGroup>) =>
  ({ vgName: "system", ...values }) as ConfigModel.VolumeGroup;

const systemPart = (name: string, canShrink = false) =>
  ({ name, block: { shrinking: { supported: canShrink } } }) as System.Device;

/** The values a cell shows, one per line. */
const lines = (values: React.ReactNode[]) => {
  const { container, unmount } = plainRender(<CellValues values={values} />);
  const items = within(container).queryAllByRole("listitem");
  const texts = items.length ? items.map((item) => item.textContent) : [container.textContent];
  unmount();
  return texts;
};

describe("driveUsedFor", () => {
  it("says a disk with nothing planned is skipped", () => {
    expect(lines(driveUsedFor(drive({}), [], false, true))).toEqual(["Nothing yet (skipped)"]);
  });

  it("says where a reused whole-disk file system is mounted", () => {
    const device = drive({ mountPath: "/home", filesystem: { reuse: true, default: false } });
    expect(lines(driveUsedFor(device, [], false, false))).toEqual(['Mounting it at "/home"']);
  });

  it("says where a new whole-disk file system is mounted", () => {
    const device = drive({ mountPath: "/home", filesystem: { reuse: false, default: false } });
    expect(lines(driveUsedFor(device, [], false, false))).toEqual(['Formatting it for "/home"']);
  });

  it("says when the disk holds the system and boots it", () => {
    const device = drive({ partitions: [partition({ mountPath: "/" })] });
    expect(lines(driveUsedFor(device, [], true, false))).toEqual([
      "Installing and booting the system",
    ]);
  });

  it("says when the disk only boots the system", () => {
    expect(lines(driveUsedFor(drive({ partitions: [] }), [], true, false))).toEqual([
      "Booting the system",
    ]);
  });

  it("names the volume groups it hosts, and counts them past the naming limit", () => {
    expect(lines(driveUsedFor(drive({}), ["system"], false, false))).toEqual([
      'Hosting the volume group "system"',
    ]);
    expect(lines(driveUsedFor(drive({}), ["a", "b", "c"], false, false))).toContain(
      "Hosting 3 LVM volume groups",
    );
  });

  it("names reused partitions, and counts them past the naming limit", () => {
    const reused = (path: string) => partition({ name: `/dev/vda${path.length}`, mountPath: path });
    expect(lines(driveUsedFor(drive({ partitions: [reused("/home")] }), [], false, false))).toEqual(
      ['"/home" on an existing partition'],
    );

    const many = [reused("/a"), reused("/bb"), reused("/ccc")];
    expect(lines(driveUsedFor(drive({ partitions: many }), [], false, false))).toEqual([
      "3 existing partitions",
    ]);
  });

  it("names new partitions next to hosted volume groups as additional ones", () => {
    const device = drive({ partitions: [partition({ mountPath: "/data" })] });
    expect(lines(driveUsedFor(device, ["system"], false, false))).toEqual([
      'Hosting the volume group "system"',
      '"/data" as an additional partition',
    ]);
  });

  it("counts new partitions past the naming limit", () => {
    const device = drive({
      partitions: [
        partition({ mountPath: "/a" }),
        partition({ mountPath: "/b" }),
        partition({ mountPath: "/c" }),
      ],
    });
    expect(lines(driveUsedFor(device, [], false, false))).toEqual(["3 new partitions"]);
  });
});

describe("volumeGroupUsedFor", () => {
  it("says nothing is planned yet", () => {
    expect(lines(volumeGroupUsedFor(group({})))).toEqual(["Nothing yet"]);
  });

  it("says when the group holds the system", () => {
    expect(
      lines(volumeGroupUsedFor(group({ logicalVolumes: [volume({ mountPath: "/" })] }))),
    ).toEqual(["Installing the system"]);
  });

  it("names new logical volumes, and counts them past the naming limit", () => {
    const vols = (paths: string[]) => paths.map((mountPath) => volume({ mountPath }));
    expect(lines(volumeGroupUsedFor(group({ logicalVolumes: vols(["/home"]) })))).toEqual([
      '"/home"',
    ]);
    expect(lines(volumeGroupUsedFor(group({ logicalVolumes: vols(["/a", "/b", "/c"]) })))).toEqual([
      "3 new logical volumes",
    ]);
  });

  it("names reused logical volumes, and counts them past the naming limit", () => {
    const reused = (paths: string[]) =>
      paths.map((mountPath, i) => volume({ name: `lv${i}`, mountPath }));
    expect(lines(volumeGroupUsedFor(group({ logicalVolumes: reused(["/home"]) })))).toEqual([
      '"/home" on an existing logical volume',
    ]);
    expect(
      lines(volumeGroupUsedFor(group({ logicalVolumes: reused(["/a", "/b", "/c"]) }))),
    ).toEqual(["3 existing logical volumes"]);
  });
});

describe("ExistingDataCell", () => {
  beforeEach(() => mockSystemDevices.mockReturnValue([]));

  const cell = (
    config: ConfigModel.Drive | ConfigModel.VolumeGroup,
    device: System.Device | null,
  ) => {
    plainRender(<ExistingDataCell config={config} device={device} />);
    const items = screen.queryAllByRole("listitem");
    return items.length ? items.map((item) => item.textContent) : [document.body.textContent];
  };

  it("tells screen readers when there is nothing planned yet", () => {
    plainRender(<ExistingDataCell config={drive({})} device={null} isIdle />);
    screen.getByText("No actions planned yet.");
  });

  it("tells screen readers when the device holds nothing", () => {
    expect(cell(drive({}), null)).toEqual(["No existing data"]);
  });

  it("keeps the data of a reused whole-disk file system", () => {
    expect(
      cell(drive({ filesystem: { reuse: true, default: false } }), systemPart("/dev/vda")),
    ).toEqual(["The current data will be kept"]);
  });

  it("deletes a disk without partitions that holds a file system", () => {
    const device = { ...systemPart("/dev/vda"), filesystem: { type: "ext4" } } as System.Device;
    expect(cell(drive({}), device)).toEqual(["All disk content will be deleted"]);
  });

  it("deletes a disk without partitions used by an existing volume group", () => {
    const device = { ...systemPart("/dev/vda"), sid: 7 } as System.Device;
    mockSystemDevices.mockReturnValue([{ volumeGroup: { physicalVolumes: [7] } }]);
    expect(cell(drive({}), device)).toEqual(["All disk content will be deleted"]);
  });

  it("says which partitions are formatted, shrunk or deleted", () => {
    const device = {
      ...systemPart("/dev/vda"),
      partitions: [systemPart("/dev/vda1"), systemPart("/dev/vda2", true), systemPart("/dev/vda3")],
    } as System.Device;
    const config = drive({
      partitions: [
        partition({ name: "/dev/vda1", mountPath: "/home" }),
        partition({ name: "/dev/vda2", resizeIfNeeded: true }),
      ],
    });
    expect(cell(config, device)).toEqual([
      "An existing partition will be formatted",
      "An existing partition may be shrunk",
    ]);
  });

  it("says when every partition is deleted", () => {
    const device = {
      ...systemPart("/dev/vda"),
      partitions: [systemPart("/dev/vda1")],
    } as System.Device;
    const config = drive({ partitions: [partition({ name: "/dev/vda1", delete: true })] });
    expect(cell(config, device)).toEqual(["All disk content will be deleted"]);
  });

  it("says when every partition is kept", () => {
    const device = {
      ...systemPart("/dev/vda"),
      partitions: [systemPart("/dev/vda1")],
    } as System.Device;
    expect(cell(drive({ partitions: [] }), device)).toEqual([
      "The current data and partitions will be kept",
    ]);
  });

  it("counts deleted partitions when only some are deleted", () => {
    const device = {
      ...systemPart("/dev/vda"),
      partitions: [systemPart("/dev/vda1"), systemPart("/dev/vda2"), systemPart("/dev/vda3")],
    } as System.Device;
    const config = drive({
      partitions: [
        partition({ name: "/dev/vda1", delete: true }),
        partition({ name: "/dev/vda2", delete: true }),
      ],
    });
    expect(cell(config, device)).toEqual(["2 partitions will be deleted"]);
  });

  it("says what happens to the logical volumes of an existing group", () => {
    const device = {
      ...systemPart("/dev/system"),
      logicalVolumes: [systemPart("/dev/system/a"), systemPart("/dev/system/b", true)],
    } as System.Device;
    const config = group({
      logicalVolumes: [
        volume({ name: "/dev/system/a", delete: true }),
        volume({ name: "/dev/system/b", resizeIfNeeded: true }),
      ],
    });
    expect(cell(config, device)).toEqual([
      "An existing logical volume may be shrunk",
      "1 logical volume will be deleted",
    ]);
  });

  it("says nothing about a group with no logical volumes today", () => {
    expect(cell(group({}), systemPart("/dev/system"))).toEqual(["No existing data"]);
  });
});
