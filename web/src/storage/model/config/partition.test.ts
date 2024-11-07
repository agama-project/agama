/*
 * Copyright (c) [2024] SUSE LLC
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

import * as model from "~/storage/model/config/partition";

describe("#generate", () => {
  it("returns a partition object from a partition section", () => {
    expect(
      model.generate({
        search: "/dev/vda1",
        delete: true,
      }),
    ).toEqual({
      name: "/dev/vda1",
      delete: true,
    });

    expect(
      model.generate({
        search: "/dev/vda1",
        deleteIfNeeded: true,
        size: 1024,
      }),
    ).toEqual({
      name: "/dev/vda1",
      deleteIfNeeded: true,
      resizeIfNeeded: false,
      size: { min: 1024, max: 1024 },
    });

    expect(
      model.generate({
        search: "/dev/vda1",
        alias: "test",
        filesystem: {
          path: "/test",
          type: {
            btrfs: { snapshots: true },
          },
        },
        size: { min: 0, max: 2048 },
      }),
    ).toEqual({
      name: "/dev/vda1",
      alias: "test",
      resizeIfNeeded: true,
      filesystem: "btrfs",
      mountPath: "/test",
      snapshots: true,
      size: { min: 0, max: 2048 },
    });

    expect(
      model.generate({
        filesystem: {
          path: "/test",
        },
      }),
    ).toEqual({
      name: undefined,
      alias: undefined,
      resizeIfNeeded: undefined,
      filesystem: undefined,
      mountPath: "/test",
      snapshots: undefined,
      size: undefined,
    });
  });
});
