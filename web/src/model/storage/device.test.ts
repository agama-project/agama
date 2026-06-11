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

import { hasContent } from "~/model/storage/device";

import type { Storage as System } from "~/model/system";

const device = (props: Partial<System.Device> = {}): System.Device =>
  ({ sid: 1, name: "/dev/vda", ...props }) as System.Device;

describe("hasContent", () => {
  it("returns true when the device has a filesystem of its own", () => {
    expect(hasContent(device({ filesystem: { sid: 2, type: "ext4" } }))).toBe(true);
  });

  it("returns true for a volume group with logical volumes", () => {
    expect(
      hasContent(
        device({
          class: "volumeGroup",
          logicalVolumes: [device({ sid: 3, name: "/dev/system/root" })],
        }),
      ),
    ).toBe(true);
  });

  it("returns false for an empty volume group", () => {
    expect(hasContent(device({ class: "volumeGroup", logicalVolumes: [] }))).toBe(false);
  });

  it("returns true when the device has a partition table with partitions", () => {
    expect(
      hasContent(
        device({
          partitionTable: { type: "gpt", unusedSlots: [] },
          partitions: [device({ sid: 4, name: "/dev/vda1" })],
        }),
      ),
    ).toBe(true);
  });

  it("returns true when installed systems are detected on the device", () => {
    expect(
      hasContent(device({ block: { systems: ["openSUSE Tumbleweed"] } } as System.Device)),
    ).toBe(true);
  });

  it("returns false for an empty device", () => {
    expect(hasContent(device({ block: { systems: [] } } as System.Device))).toBe(false);
  });
});
