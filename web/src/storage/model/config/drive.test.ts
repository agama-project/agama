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
  it("returns a drive object from a drive section", () => {
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
          partitions: [{ search: "*", delete: true }],
        },
        {
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
          search: "/dev/vda",
          partitions: [{ search: "/dev/vda1", delete: true }, { filesystem: { path: "/" } }],
        },
      ),
    ).toEqual({
      name: "/dev/vda",
      alias: undefined,
      spacePolicy: "delete",
      partitions: [
        {
          name: "/dev/vda1",
          delete: true,
        },
        {
          name: undefined,
          alias: undefined,
          filesystem: undefined,
          mountPath: "/",
          snapshots: undefined,
          size: undefined,
        },
      ],
    });
  });
});
