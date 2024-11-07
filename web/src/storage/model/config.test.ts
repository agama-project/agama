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

import * as model from "~/storage/model/config";

describe("#generate", () => {
  it("returns a list of devices", () => {
    expect(
      model.generate(
        {
          drives: [
            { partitions: [{ search: "*", delete: true }] },
            { partitions: [{ filesystem: { path: "/test" } }] },
          ],
        },
        {
          drives: [
            {
              search: "/dev/vda",
              partitions: [
                { search: "/dev/vda1", delete: true },
                { search: "/dev/vda2", delete: true },
              ],
            },
            {
              search: "/dev/vdb",
              partitions: [
                {
                  filesystem: { type: "xfs", path: "/test" },
                  size: { min: 1024, max: 2048 },
                },
              ],
            },
          ],
        },
      ),
    ).toEqual([
      {
        name: "/dev/vda",
        alias: undefined,
        spacePolicy: "delete",
        partitions: [
          {
            name: "/dev/vda1",
            delete: true,
          },
          {
            name: "/dev/vda2",
            delete: true,
          },
        ],
      },
      {
        name: "/dev/vdb",
        alias: undefined,
        spacePolicy: "keep",
        partitions: [
          {
            name: undefined,
            alias: undefined,
            resizeIfNeeded: true,
            filesystem: "xfs",
            mountPath: "/test",
            snapshots: undefined,
            size: { min: 1024, max: 2048 },
          },
        ],
      },
    ]);
  });
});
