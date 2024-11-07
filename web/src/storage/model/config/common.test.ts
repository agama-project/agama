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

import * as model from "~/storage/model/config/common";

describe("#generateName", () => {
  it("returns the device name from the search section", () => {
    expect(
      model.generateName({
        search: "/dev/vda",
      }),
    ).toEqual("/dev/vda");

    expect(
      model.generateName({
        search: {
          condition: {
            name: "/dev/vda",
          },
        },
      }),
    ).toEqual("/dev/vda");
  });

  it("returns undefined if the search section has no name", () => {
    expect(
      model.generateName({
        search: "*",
      }),
    ).toBeUndefined;

    expect(
      model.generateName({
        search: {
          max: 5,
          ifNotFound: "skip",
        },
      }),
    ).toBeUndefined;
  });

  it("returns undefined if there is no search section", () => {
    expect(model.generateName({})).toBeUndefined;
  });
});

describe("#generateFilesystem", () => {
  it("returns the file system type from the filesystem section", () => {
    expect(
      model.generateFilesystem({
        filesystem: {
          type: "xfs",
        },
      }),
    ).toEqual("xfs");

    expect(
      model.generateFilesystem({
        filesystem: {
          type: {
            btrfs: {
              snapshots: true,
            },
          },
        },
      }),
    ).toEqual("btrfs");
  });

  it("returns undefined if the filesystem section has no type", () => {
    expect(
      model.generateFilesystem({
        filesystem: {
          path: "/",
        },
      }),
    ).toBeUndefined;
  });

  it("returns undefined if there is no filesystem section", () => {
    expect(model.generateFilesystem({})).toBeUndefined;
  });
});

describe("#generateSnapshots", () => {
  it("returns the snapshots value from the filesystem section", () => {
    expect(
      model.generateSnapshots({
        filesystem: {
          type: {
            btrfs: {
              snapshots: true,
            },
          },
        },
      }),
    ).toEqual(true);

    expect(
      model.generateSnapshots({
        filesystem: {
          type: {
            btrfs: {
              snapshots: false,
            },
          },
        },
      }),
    ).toEqual(false);
  });

  it("returns undefined if the filesystem section has no snapshots", () => {
    expect(
      model.generateSnapshots({
        filesystem: {
          type: "btrfs",
        },
      }),
    ).toBeUndefined;

    expect(
      model.generateSnapshots({
        filesystem: {
          type: {
            btrfs: {},
          },
        },
      }),
    ).toBeUndefined;
  });

  it("returns undefined if there is no filesystem section", () => {
    expect(model.generateSnapshots({})).toBeUndefined;
  });
});
