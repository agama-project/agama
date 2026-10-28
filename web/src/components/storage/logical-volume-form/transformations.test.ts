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
import { buildPayload, toFormValues, lvNameFromMountPoint } from "./transformations";
import { defaultOptions } from "./fields";
import type { FormFields } from "./fields";
import type { ConfigModel } from "~/model/storage/config-model";

describe("lvNameFromMountPoint", () => {
  it("returns empty string for empty mount point", () => {
    expect(lvNameFromMountPoint("")).toBe("");
  });

  it("returns root for the root mount point", () => {
    expect(lvNameFromMountPoint("/")).toBe("root");
  });

  it("returns swap for swap mount point", () => {
    expect(lvNameFromMountPoint("swap")).toBe("swap");
  });

  it("strips leading slash from simple path", () => {
    expect(lvNameFromMountPoint("/home")).toBe("home");
  });

  it("replaces slashes with underscores in nested path", () => {
    expect(lvNameFromMountPoint("/var/lib")).toBe("var_lib");
  });

  it("handles deeply nested paths", () => {
    expect(lvNameFromMountPoint("/var/lib/mysql")).toBe("var_lib_mysql");
  });

  it("returns empty string for non-absolute mount points", () => {
    expect(lvNameFromMountPoint("foo")).toBe("");
  });
});

describe("buildPayload", () => {
  describe("new logical volume", () => {
    it("builds payload for new LV with AUTO filesystem", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/home",
        target: "",
        lvName: "home",
        filesystem: "auto",
        sizeMode: "fixed",
        fixedSize: "50 GiB",
      };

      const result = buildPayload(values as FormFields);

      expect(result).toEqual({
        mountPath: "/home",
        lvName: "home",
        name: undefined,
        filesystem: {
          default: true,
          label: undefined,
          mkfsExtraArguments: undefined,
          mountOptions: undefined,
        },
        size: {
          default: false,
          min: 53687091200,
          max: 53687091200,
        },
      });
    });

    it("builds payload with explicit filesystem type", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/var",
        target: "",
        lvName: "var",
        filesystem: "xfs",
        sizeMode: "range",
        rangeMinSize: "10 GiB",
        rangeMaxSize: "30 GiB",
      };

      const result = buildPayload(values as FormFields);

      expect(result).toEqual({
        mountPath: "/var",
        lvName: "var",
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
          min: 10737418240,
          max: 32212254720,
        },
      });
    });

    it("includes filesystem extra settings when checkbox is checked", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/data",
        target: "",
        lvName: "data",
        filesystem: "btrfs",
        filesystemLabel: "data-vol",
        mkfsExtraArguments: "-m dup",
        mountOptions: ["compress=zstd"],
        showMoreFilesystemSettings: true,
        sizeMode: "auto",
      };

      const result = buildPayload(values as FormFields);

      expect(result.filesystem).toEqual({
        default: false,
        type: "btrfs",
        label: "data-vol",
        mkfsExtraArguments: "-m dup",
        mountOptions: ["compress=zstd"],
      });
    });

    it("builds payload with AUTO size mode", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/",
        target: "",
        lvName: "root",
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
        target: "",
        lvName: "root",
        filesystem: "btrfs",
        sizeMode: "expand",
        expandMinSize: "20 GiB",
      };

      const result = buildPayload(values as FormFields);

      expect(result.size).toEqual({
        default: false,
        min: 21474836480,
      });
    });

    it("includes lvName in payload for new LV", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/home",
        target: "",
        lvName: "my_home",
        filesystem: "auto",
      };

      const result = buildPayload(values as FormFields);

      expect(result.lvName).toBe("my_home");
      expect(result.name).toBeUndefined();
    });
  });

  describe("reused logical volume", () => {
    it("builds payload for reused LV with REUSE filesystem", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/home",
        target: "lv_home",
        lvName: "",
        filesystem: "reuse",
        filesystemAction: "reuse",
      };

      const result = buildPayload(values as FormFields);

      expect(result).toEqual({
        mountPath: "/home",
        lvName: undefined,
        name: "lv_home",
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
        mountPoint: "/var",
        target: "lv_var",
        lvName: "",
        filesystem: "reuse",
        mountOptions: ["noatime", "nodiratime"],
        showMoreFilesystemSettings: true,
      };

      const result = buildPayload(values as FormFields);

      expect(result.filesystem).toEqual({
        reuse: true,
        default: true,
        mountOptions: ["noatime", "nodiratime"],
      });
    });

    it("sets name field when reusing, omits lvName", () => {
      const values = {
        ...defaultOptions.defaultValues,
        mountPoint: "/data",
        target: "lv_data",
        lvName: "should_be_ignored",
        filesystem: "reuse",
      };

      const result = buildPayload(values as FormFields);

      expect(result.name).toBe("lv_data");
      expect(result.lvName).toBeUndefined();
    });
  });
});

describe("toFormValues", () => {
  it("returns empty object for null config (new LV)", () => {
    const result = toFormValues(null);
    expect(result).toEqual({});
  });

  describe("editing existing logical volume", () => {
    it("maps basic LV config to form values", () => {
      const config = {
        mountPath: "/home",
        name: "lv_home",
        lvName: "home",
        filesystem: {
          type: "xfs",
          label: "",
        },
        size: {
          default: false,
          min: 53687091200,
          max: 53687091200,
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result).toMatchObject({
        mountPoint: "/home",
        committedMountPoint: "/home",
        target: "lv_home",
        lvName: "home",
        filesystem: "reuse", // Defaults to REUSE for existing LV
        filesystemAction: "reuse",
        sizeMode: "auto", // Reused LVs show AUTO
      });
    });

    it("maps LV with filesystem label to form values", () => {
      const config = {
        mountPath: "/data",
        name: "lv_data",
        lvName: "data",
        filesystem: {
          type: "ext4",
          label: "my-data",
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result).toMatchObject({
        filesystemLabel: "my-data",
        showMoreFilesystemSettings: true,
      });
    });

    it("maps LV with mount options to form values", () => {
      const config = {
        mountPath: "/var",
        name: "lv_var",
        lvName: "var",
        filesystem: {
          type: "xfs",
          mountOptions: ["noatime"],
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result).toMatchObject({
        mountOptions: ["noatime"],
        showMoreFilesystemSettings: true,
      });
    });

    it("maps LV with mkfs options to form values", () => {
      const config = {
        mountPath: "/",
        name: undefined,
        lvName: "root",
        filesystem: {
          type: "ext4",
          mkfsExtraArguments: "-O dir_index",
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result).toMatchObject({
        mkfsExtraArguments: "-O dir_index",
        showMoreFilesystemSettings: true,
      });
    });

    it("uses format action when reuse is explicitly false", () => {
      const config = {
        mountPath: "/home",
        name: "lv_home",
        lvName: "home",
        filesystem: {
          type: "xfs",
          reuse: false,
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result).toMatchObject({
        filesystem: "xfs",
        filesystemAction: "format",
      });
    });

    it("keeps the filesystem when the config reuses it without a type", () => {
      // The stored form of choosing "Current": reuse the filesystem as it is,
      // so the config carries no type.
      const config = {
        mountPath: "/home",
        name: "lv_home",
        filesystem: {
          reuse: true,
          default: true,
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result).toMatchObject({
        filesystem: "reuse",
        filesystemAction: "reuse",
      });
    });

    it("handles LV without name (new LV config)", () => {
      const config = {
        mountPath: "/home",
        lvName: "home",
        filesystem: {
          type: "xfs",
        },
        size: {
          default: false,
          min: 53687091200,
          max: 53687091200,
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result).toMatchObject({
        target: "",
        lvName: "home",
        filesystem: "xfs",
        filesystemAction: "format",
        sizeMode: "fixed",
        fixedSize: "50 GiB",
      });
    });
  });

  describe("size field inference", () => {
    it("infers FIXED size mode", () => {
      const config = {
        mountPath: "/home",
        lvName: "home",
        size: {
          default: false,
          min: 53687091200,
          max: 53687091200,
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result).toMatchObject({
        sizeMode: "fixed",
        fixedSize: "50 GiB",
      });
    });

    it("infers RANGE size mode", () => {
      const config = {
        mountPath: "/var",
        lvName: "var",
        size: {
          default: false,
          min: 10737418240,
          max: 32212254720,
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result).toMatchObject({
        sizeMode: "range",
        rangeMinSize: "10 GiB",
        rangeMaxSize: "30 GiB",
      });
    });

    it("infers EXPAND size mode", () => {
      const config = {
        mountPath: "/",
        lvName: "root",
        size: {
          default: false,
          min: 21474836480,
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result).toMatchObject({
        sizeMode: "expand",
        expandMinSize: "20 GiB",
      });
    });

    it("infers AUTO size mode when size is default", () => {
      const config = {
        mountPath: "/home",
        lvName: "home",
        size: {
          default: true,
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

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
        lvName: "home",
        filesystem: {
          default: true,
          type: "btrfs",
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result.filesystem).toBe("auto");
    });

    it("maps explicit filesystem type", () => {
      const config = {
        mountPath: "/home",
        lvName: "home",
        filesystem: {
          default: false,
          type: "xfs",
          reuse: false,
        },
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result.filesystem).toBe("xfs");
    });

    it("defaults to AUTO when filesystem is undefined", () => {
      const config = {
        mountPath: "/home",
        lvName: "home",
      };

      const result = toFormValues(config as ConfigModel.LogicalVolume);

      expect(result.filesystem).toBe("auto");
    });
  });
});
