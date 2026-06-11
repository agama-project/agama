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

import { describe, it, expect } from "@jest/globals";
import { buildPayload, toFormValues } from "./transformations";
import { defaultOptions } from "./fields";
import type { FormFields } from "./fields";
import type { ConfigModel } from "~/model/storage/config-model";

describe("buildPayload", () => {
  it("builds payload with AUTO filesystem", () => {
    const values: FormFields = {
      ...defaultOptions.defaultValues,
      mountPoint: "/home",
      filesystem: "auto",
    };

    const result = buildPayload(values);

    expect(result).toEqual({
      mountPath: "/home",
      filesystem: {
        default: true,
        label: undefined,
        mkfsExtraArguments: undefined,
        mountOptions: undefined,
      },
    });
  });

  it("builds payload with explicit filesystem type", () => {
    const values: FormFields = {
      ...defaultOptions.defaultValues,
      mountPoint: "/var",
      filesystem: "xfs",
    };

    const result = buildPayload(values);

    expect(result).toEqual({
      mountPath: "/var",
      filesystem: {
        default: false,
        type: "xfs",
        label: undefined,
        mkfsExtraArguments: undefined,
        mountOptions: undefined,
      },
    });
  });

  it("includes filesystem extra settings when checkbox is checked", () => {
    const values: FormFields = {
      ...defaultOptions.defaultValues,
      mountPoint: "/data",
      filesystem: "ext4",
      filesystemLabel: "my-data",
      mkfsExtraArguments: "-O dir_index",
      mountOptions: ["noatime"],
      showMoreFilesystemSettings: true,
    };

    const result = buildPayload(values);

    expect(result.filesystem).toEqual({
      default: false,
      type: "ext4",
      label: "my-data",
      mkfsExtraArguments: "-O dir_index",
      mountOptions: ["noatime"],
    });
  });

  it("omits extra settings when checkbox is not checked", () => {
    const values: FormFields = {
      ...defaultOptions.defaultValues,
      mountPoint: "/data",
      filesystem: "ext4",
      filesystemLabel: "my-data",
      mkfsExtraArguments: "-O dir_index",
      mountOptions: ["noatime"],
      showMoreFilesystemSettings: false,
    };

    const result = buildPayload(values);

    expect(result.filesystem).toEqual({
      default: false,
      type: "ext4",
      label: undefined,
      mkfsExtraArguments: undefined,
      mountOptions: undefined,
    });
  });

  it("builds payload for keeping the current filesystem", () => {
    const values: FormFields = {
      ...defaultOptions.defaultValues,
      mountPoint: "/home",
      filesystem: "reuse",
      filesystemAction: "reuse",
    };

    const result = buildPayload(values);

    expect(result).toEqual({
      mountPath: "/home",
      filesystem: {
        reuse: true,
        default: true,
        mountOptions: undefined,
      },
    });
  });

  it("includes mount options for the kept filesystem", () => {
    const values: FormFields = {
      ...defaultOptions.defaultValues,
      mountPoint: "/home",
      filesystem: "reuse",
      mountOptions: ["noatime", "rw"],
      showMoreFilesystemSettings: true,
    };

    const result = buildPayload(values);

    expect(result.filesystem).toEqual({
      reuse: true,
      default: true,
      mountOptions: ["noatime", "rw"],
    });
  });
});

describe("toFormValues", () => {
  it("returns the form defaults for a device without filesystem config", () => {
    const config = {
      name: "/dev/sda",
      spacePolicy: "keep",
      partitions: [],
    };

    const result = toFormValues(config as ConfigModel.Drive);

    expect(result).toEqual({
      mountPoint: "",
      committedMountPoint: "",
      filesystem: "auto",
      // No stored config means formatting is not a deliberate choice yet.
      filesystemAction: "reuse",
      filesystemLabel: "",
      mkfsExtraArguments: "",
      mountOptions: [],
      showMoreFilesystemSettings: false,
    });
  });

  it("maps a configured device to form values", () => {
    const config = {
      name: "/dev/sda",
      mountPath: "/home",
      filesystem: {
        default: false,
        type: "xfs",
        label: "",
      },
      partitions: [],
    };

    const result = toFormValues(config as ConfigModel.Drive);

    expect(result).toMatchObject({
      mountPoint: "/home",
      committedMountPoint: "/home",
      filesystem: "xfs",
      filesystemAction: "format",
    });
  });

  it("maps a device with filesystem label to form values", () => {
    const config = {
      name: "/dev/sda",
      mountPath: "/data",
      filesystem: {
        default: false,
        type: "ext4",
        label: "my-data",
      },
      partitions: [],
    };

    const result = toFormValues(config as ConfigModel.Drive);

    expect(result).toMatchObject({
      filesystemLabel: "my-data",
      showMoreFilesystemSettings: true, // Checked because label is present
    });
  });

  it("maps a device with mount and mkfs options to form values", () => {
    const config = {
      name: "/dev/sda",
      mountPath: "/var",
      filesystem: {
        default: false,
        type: "xfs",
        mountOptions: ["noatime", "nodiratime"],
        mkfsExtraArguments: "-O dir_index",
      },
      partitions: [],
    };

    const result = toFormValues(config as ConfigModel.Drive);

    expect(result).toMatchObject({
      mountOptions: ["noatime", "nodiratime"],
      mkfsExtraArguments: "-O dir_index",
      showMoreFilesystemSettings: true,
    });
  });

  it("maps a default filesystem config to the AUTO value", () => {
    const config = {
      name: "/dev/sda",
      mountPath: "/home",
      filesystem: {
        default: true,
      },
      partitions: [],
    };

    const result = toFormValues(config as ConfigModel.Drive);

    expect(result).toMatchObject({
      filesystem: "auto",
      filesystemAction: "format",
    });
  });

  it("uses the reuse action when the config keeps the filesystem", () => {
    const config = {
      name: "/dev/sda",
      mountPath: "/home",
      filesystem: {
        default: false,
        reuse: true,
      },
      partitions: [],
    };

    const result = toFormValues(config as ConfigModel.Drive);

    expect(result).toMatchObject({
      filesystem: "reuse",
      filesystemAction: "reuse",
    });
  });

  it("uses the format action when reuse is explicitly false", () => {
    const config = {
      name: "/dev/sda",
      mountPath: "/home",
      filesystem: {
        default: false,
        type: "xfs",
        reuse: false,
      },
      partitions: [],
    };

    const result = toFormValues(config as ConfigModel.Drive);

    expect(result).toMatchObject({
      filesystem: "xfs", // Not REUSE since reuse: false
      filesystemAction: "format",
    });
  });
});
