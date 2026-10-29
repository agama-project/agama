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

import type { Storage as System } from "~/model/system";
import { volumeGroupFacts } from "~/components/storage/utils/device";

const GiB = 1024 ** 3;

describe("volumeGroupFacts", () => {
  it("gives a group being created its kind, with no size", () => {
    expect(volumeGroupFacts({ vgName: "system" }, null)).toEqual({
      size: undefined,
      description: "LVM",
    });
  });

  it("gives a group the machine has its size and its kind, as a disk has", () => {
    const device = {
      sid: 1,
      name: "/dev/system",
      volumeGroup: { size: 100 * GiB, physicalVolumes: [] },
    } as System.Device;

    expect(volumeGroupFacts({ vgName: "system", name: "/dev/system" }, device)).toEqual({
      size: "100 GiB",
      description: "LVM",
    });
  });

  it("gives only its kind to a group the machine does not have", () => {
    expect(volumeGroupFacts({ vgName: "system", name: "/dev/system" }, null)).toEqual({
      size: undefined,
      description: "LVM",
    });
  });
});
