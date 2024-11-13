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
  it("returns the expeced partition object from a partition section", () => {
    expect(
      model.generate(
        {
          search: "*",
          delete: true,
        },
        {
          index: 1,
          search: "/dev/vda1",
          delete: true,
        },
      ),
    ).toEqual({
      index: 1,
      name: "/dev/vda1",
      delete: true,
    });

    expect(
      model.generate(
        {
          search: "*",
          deleteIfNeeded: true,
        },
        {
          index: 0,
          search: "/dev/vda1",
          deleteIfNeeded: true,
        },
      ),
    ).toEqual({
      index: 0,
      name: "/dev/vda1",
      deleteIfNeeded: true,
      resizeIfNeeded: false,
      resize: false,
      size: undefined,
    });

    expect(
      model.generate(
        {
          search: "*",
          deleteIfNeeded: true,
          size: 1024,
        },
        {
          index: 0,
          search: "/dev/vda1",
          deleteIfNeeded: true,
          size: { min: 1024, max: 1024 },
        },
      ),
    ).toEqual({
      index: 0,
      name: "/dev/vda1",
      deleteIfNeeded: true,
      resizeIfNeeded: false,
      resize: true,
      size: { auto: false, min: 1024, max: 1024 },
    });

    expect(
      model.generate(
        {
          search: "*",
          deleteIfNeeded: true,
          size: { min: 1024 },
        },
        {
          index: 0,
          search: "/dev/vda1",
          deleteIfNeeded: true,
          size: { min: 1024 },
        },
      ),
    ).toEqual({
      index: 0,
      name: "/dev/vda1",
      deleteIfNeeded: true,
      resizeIfNeeded: true,
      resize: false,
      size: { auto: false, min: 1024 },
    });

    expect(
      model.generate(
        {
          search: "/dev/vda1",
          alias: "test",
          filesystem: { path: "/test" },
        },
        {
          index: 0,
          search: "/dev/vda1",
          alias: "test",
          filesystem: {
            path: "/test",
            type: {
              btrfs: { snapshots: true },
            },
          },
          size: { min: 0, max: 2048 },
        },
      ),
    ).toEqual({
      index: 0,
      name: "/dev/vda1",
      alias: "test",
      resizeIfNeeded: false,
      resize: false,
      filesystem: "btrfs",
      mountPath: "/test",
      snapshots: true,
      size: { auto: true, min: 0, max: 2048 },
    });

    expect(
      model.generate(
        {
          filesystem: { path: "/test" },
          size: 1024,
        },
        {
          index: 0,
          filesystem: {
            path: "/test",
            type: {
              btrfs: { snapshots: true },
            },
          },
          size: { min: 1024, max: 1024 },
        },
      ),
    ).toEqual({
      index: 0,
      name: undefined,
      alias: undefined,
      resizeIfNeeded: undefined,
      resize: undefined,
      filesystem: "btrfs",
      mountPath: "/test",
      snapshots: true,
      size: { auto: false, min: 1024, max: 1024 },
    });
  });
});
