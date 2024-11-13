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

import * as model from "~/storage/model/config/drive";

describe("#generate", () => {
  it("returns the expected drive object from a drive section", () => {
    expect(
      model.generate(undefined, {
        search: "/dev/vda",
        alias: "test",
        filesystem: {
          type: "xfs",
          path: "/test",
        },
      }),
    ).toEqual({
      index: undefined,
      name: "/dev/vda",
      alias: "test",
      filesystem: "xfs",
      mountPath: "/test",
      snapshots: undefined,
      spacePolicy: undefined,
    });

    expect(
      model.generate(
        {
          alias: "test",
          filesystem: { path: "/test" },
        },
        {
          index: 0,
          search: "/dev/vda",
          alias: "test",
          filesystem: {
            type: {
              btrfs: { snapshots: false },
            },
            path: "/test",
          },
        },
      ),
    ).toEqual({
      index: 0,
      name: "/dev/vda",
      alias: "test",
      filesystem: "btrfs",
      mountPath: "/test",
      snapshots: false,
      spacePolicy: "delete",
    });

    expect(
      model.generate(
        {
          partitions: [{ search: "*", delete: true }, { generate: "default" }],
        },
        {
          index: 0,
          search: "/dev/vda",
          partitions: [
            {
              index: 0,
              search: "/dev/vda1",
              delete: true,
            },
            {
              index: 1,
              filesystem: { path: "/", type: "ext4" },
              size: { min: 1024, max: 2048 },
            },
          ],
        },
      ),
    ).toEqual({
      index: 0,
      name: "/dev/vda",
      alias: undefined,
      spacePolicy: "delete",
      partitions: [
        {
          index: 0,
          name: "/dev/vda1",
          delete: true,
        },
        {
          index: 1,
          name: undefined,
          alias: undefined,
          resize: undefined,
          resizeIfNeeded: undefined,
          filesystem: "ext4",
          mountPath: "/",
          snapshots: undefined,
          size: { auto: true, min: 1024, max: 2048 },
        },
      ],
    });
  });
});
