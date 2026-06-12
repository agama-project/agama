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
  describe("new partition", () => {
    it("builds payload for new partition with AUTO filesystem", () => {
      const values: FormFields = {
        ...defaultOptions.defaultValues,
        mountPoint: "/home",
        name: "",
        filesystem: "auto",
        sizeMode: "fixed",
        fixedSize: "20 GiB",
      };

      const result = buildPayload(values as FormFields);

      expect(result).toEqual({
        mountPath: "/home",
        name: undefined,
        filesystem: {
          default: true,
          label: undefined,
          mkfsExtraArguments: undefined,
          mountOptions: undefined,
        },
        size: {
          default: false,
          min: 21474836480,
          max: 21474836480,
        },
      });
    });

    it("builds payload with explicit filesystem type", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/var",
        name: "",
        filesystem: "xfs",
        sizeMode: "range",
        rangeMinSize: "5 GiB",
        rangeMaxSize: "10 GiB",
      };

      const result = buildPayload(values as FormFields);

      expect(result).toEqual({
        mountPath: "/var",
        name: undefined,
        filesystem: {
          default: false,
          type: "xfs",
          label: undefined,
          mkfsExtraArguments: undefined,
          mountOptions: undefined,
        },
        size: {
          default: false,
          min: 5368709120,
          max: 10737418240,
        },
      });
    });

    it("includes filesystem extra settings when checkbox is checked", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/data",
        name: "",
        filesystem: "ext4",
        filesystemLabel: "my-data",
        mkfsExtraArguments: "-O dir_index",
        mountOptions: ["noatime"],
        showMoreFilesystemSettings: true,
        sizeMode: "auto",
      };

      const result = buildPayload(values as FormFields);

      expect(result.filesystem).toEqual({
        default: false,
        type: "ext4",
        label: "my-data",
        mkfsExtraArguments: "-O dir_index",
        mountOptions: ["noatime"],
      });
    });

    it("omits extra settings when checkbox is not checked", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/data",
        name: "",
        filesystem: "ext4",
        filesystemLabel: "my-data",
        mkfsExtraArguments: "-O dir_index",
        mountOptions: ["noatime"],
        showMoreFilesystemSettings: false,
      };

      const result = buildPayload(values as FormFields);

      expect(result.filesystem).toEqual({
        default: false,
        type: "ext4",
        label: undefined,
        mkfsExtraArguments: undefined,
        mountOptions: undefined,
      });
    });

    it("builds payload with AUTO size mode", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/",
        name: "",
        filesystem: "btrfs",
        sizeMode: "auto",
      };

      const result = buildPayload(values as FormFields);

      expect(result.size).toBeUndefined();
    });

    it("builds payload with EXPAND size mode", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/",
        name: "",
        filesystem: "btrfs",
        sizeMode: "expand",
        expandMinSize: "15 GiB",
      };

      const result = buildPayload(values as FormFields);

      expect(result.size).toEqual({
        default: false,
        min: 16106127360,
      });
    });
  });

  describe("reused partition", () => {
    it("builds payload for reused partition with REUSE filesystem", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/home",
        name: "/dev/sda3",
        filesystem: "reuse",
        filesystemAction: "reuse",
      };

      const result = buildPayload(values as FormFields);

      expect(result).toEqual({
        mountPath: "/home",
        name: "/dev/sda3",
        filesystem: {
          reuse: true,
          default: true,
          mountOptions: undefined,
        },
        size: undefined,
      });
    });

    it("includes mount options for reused filesystem", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/home",
        name: "/dev/sda3",
        filesystem: "reuse",
        mountOptions: ["noatime", "rw"],
        showMoreFilesystemSettings: true,
      };

      const result = buildPayload(values as FormFields);

      expect(result.filesystem).toEqual({
        reuse: true,
        default: true,
        mountOptions: ["noatime", "rw"],
      });
    });
  });
});

describe("toFormValues", () => {
  it("returns empty object for null config (new partition)", () => {
    const result = toFormValues(null);
    expect(result).toEqual({});
  });

  describe("editing existing partition", () => {
    it("maps basic partition config to form values", () => {
      const config = {
        mountPath: "/home",
        name: "/dev/sda3",
        filesystem: {
          type: "xfs",
          label: "",
        },
        size: {
          default: false,
          min: 10737418240,
          max: 10737418240,
        },
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result).toMatchObject({
        mountPoint: "/home",
        committedMountPoint: "/home",
        name: "/dev/sda3",
        filesystem: "reuse", // Defaults to REUSE for existing partition
        filesystemAction: "reuse",
        sizeMode: "auto", // Reused partitions show AUTO
      });
    });

    it("maps partition with filesystem label to form values", () => {
      const config = {
        mountPath: "/data",
        name: "/dev/sda4",
        filesystem: {
          type: "ext4",
          label: "my-data",
        },
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result).toMatchObject({
        filesystemLabel: "my-data",
        showMoreFilesystemSettings: true, // Checked because label is present
      });
    });

    it("maps partition with mount options to form values", () => {
      const config = {
        mountPath: "/var",
        name: "/dev/sda5",
        filesystem: {
          type: "xfs",
          mountOptions: ["noatime", "nodiratime"],
        },
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result).toMatchObject({
        mountOptions: ["noatime", "nodiratime"],
        showMoreFilesystemSettings: true,
      });
    });

    it("maps partition with mkfs options to form values", () => {
      const config = {
        mountPath: "/",
        filesystem: {
          type: "ext4",
          mkfsExtraArguments: "-O dir_index",
        },
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result).toMatchObject({
        mkfsExtraArguments: "-O dir_index",
        showMoreFilesystemSettings: true,
      });
    });

    it("uses format action when reuse is explicitly false", () => {
      const config = {
        mountPath: "/home",
        name: "/dev/sda3",
        filesystem: {
          type: "xfs",
          reuse: false,
        },
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result).toMatchObject({
        filesystem: "xfs", // Not REUSE since reuse: false
        filesystemAction: "format",
      });
    });

    it("keeps the filesystem when the config reuses it without a type", () => {
      // The stored form of choosing "Current": reuse the filesystem as it is,
      // so the config carries no type.
      const config = {
        mountPath: "/home",
        name: "/dev/sda3",
        filesystem: {
          reuse: true,
          default: true,
        },
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result).toMatchObject({
        filesystem: "reuse",
        filesystemAction: "reuse",
      });
    });
  });

  describe("size field inference", () => {
    it("infers FIXED size mode", () => {
      const config = {
        mountPath: "/home",
        size: {
          default: false,
          min: 10737418240,
          max: 10737418240,
        },
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result).toMatchObject({
        sizeMode: "fixed",
        fixedSize: "10 GiB",
      });
    });

    it("infers RANGE size mode", () => {
      const config = {
        mountPath: "/var",
        size: {
          default: false,
          min: 5368709120,
          max: 21474836480,
        },
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result).toMatchObject({
        sizeMode: "range",
        rangeMinSize: "5 GiB",
        rangeMaxSize: "20 GiB",
      });
    });

    it("infers EXPAND size mode", () => {
      const config = {
        mountPath: "/",
        size: {
          default: false,
          min: 16106127360,
        },
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result).toMatchObject({
        sizeMode: "expand",
        expandMinSize: "15 GiB",
      });
    });

    it("infers AUTO size mode when size is default", () => {
      const config = {
        mountPath: "/home",
        size: {
          default: true,
        },
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result).toMatchObject({
        sizeMode: "auto",
        fixedSize: "",
        rangeMinSize: "",
        rangeMaxSize: "",
        expandMinSize: "",
      });
    });
  });

  describe("filesystem field mapping", () => {
    it("maps default filesystem to AUTO", () => {
      const config = {
        mountPath: "/home",
        filesystem: {
          default: true,
          type: "btrfs",
        },
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result.filesystem).toBe("auto");
    });

    it("maps explicit filesystem type", () => {
      const config = {
        mountPath: "/home",
        filesystem: {
          default: false,
          type: "xfs",
          reuse: false,
        },
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result.filesystem).toBe("xfs");
    });

    it("defaults to AUTO when filesystem is undefined", () => {
      const config = {
        mountPath: "/home",
      };

      const result = toFormValues(config as ConfigModel.Partition);

      expect(result.filesystem).toBe("auto");
    });
  });
});
