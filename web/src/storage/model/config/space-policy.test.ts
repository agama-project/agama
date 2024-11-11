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

import * as model from "~/storage/model/config/space-policy";

describe("#generate", () => {
  it("returns 'delete' if there is a file system", () => {
    expect(
      model.generate({
        filesystem: { type: "xfs" },
      }),
    ).toEqual("delete");
  });

  it("returns 'delete' if there is a 'delete all' partition", () => {
    expect(
      model.generate({
        partitions: [{ search: "*", delete: true }],
      }),
    ).toEqual("delete");

    expect(
      model.generate({
        partitions: [{ search: { ifNotFound: "skip" }, delete: true }],
      }),
    ).toEqual("delete");

    expect(
      model.generate({
        partitions: [{ search: "*", delete: true }, { filesystem: { path: "/" } }],
      }),
    ).toEqual("delete");
  });

  it("returns 'resize' if there is a 'shrink all' partition", () => {
    expect(
      model.generate({
        partitions: [{ search: "*", size: { min: 0, max: "current" } }],
      }),
    ).toEqual("resize");

    expect(
      model.generate({
        partitions: [{ search: "*", size: [0, "current"] }],
      }),
    ).toEqual("resize");

    expect(
      model.generate({
        partitions: [{ search: { ifNotFound: "skip" }, size: { min: 0, max: "current" } }],
      }),
    ).toEqual("resize");

    expect(
      model.generate({
        partitions: [{ search: "*", size: { min: 0, max: "current" } }, { generate: "default" }],
      }),
    ).toEqual("resize");
  });

  it("returns 'custom' if there is a 'delete' or 'resize' partition", () => {
    expect(
      model.generate({
        partitions: [{ search: "/dev/vda", delete: true }],
      }),
    ).toEqual("custom");

    expect(
      model.generate({
        partitions: [{ search: { max: 2, ifNotFound: "skip" }, delete: true }],
      }),
    ).toEqual("custom");

    expect(
      model.generate({
        partitions: [{ search: "*", deleteIfNeeded: true }],
      }),
    ).toEqual("custom");

    expect(
      model.generate({
        partitions: [{ search: "*", deleteIfNeeded: true, size: [0, "current"] }],
      }),
    ).toEqual("custom");

    expect(
      model.generate({
        partitions: [{ search: "*", size: { min: 0 } }],
      }),
    ).toEqual("custom");

    expect(
      model.generate({
        partitions: [{ search: "*", size: { min: 0, max: 1024 } }],
      }),
    ).toEqual("custom");

    expect(
      model.generate({
        partitions: [{ search: "/dev/vda", delete: true }],
      }),
    ).toEqual("custom");

    expect(
      model.generate({
        partitions: [{ search: "/dev/vda", size: { min: 0, max: "current" } }],
      }),
    ).toEqual("custom");

    expect(
      model.generate({
        partitions: [{ search: "/dev/vda", delete: true }, { filesystem: { path: "/" } }],
      }),
    ).toEqual("custom");
  });

  it("returns 'keep' if there is neither 'delete' nor 'resize' partition", () => {
    expect(
      model.generate({
        partitions: [{ search: "*", filesystem: { type: "xfs" } }],
      }),
    ).toEqual("keep");

    expect(
      model.generate({
        partitions: [{ generate: "default" }, { filesystem: { path: "/home" } }],
      }),
    ).toEqual("keep");
  });

  it("returns 'keep' if there are not partitions", () => {
    expect(
      model.generate({
        search: "/dev/vda",
      }),
    ).toEqual("keep");
  });
});
