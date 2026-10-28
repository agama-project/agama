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
import { SIZE_MODE } from "./fields";
import {
  buildFilesystemConfig,
  buildSizeConfig,
  inferSizeFields,
  fsConfigValue,
} from "./transformations";

describe("buildFilesystemConfig", () => {
  describe("REUSE action", () => {
    it("returns reuse config with default true", () => {
      const result = buildFilesystemConfig({
        filesystem: "reuse",
        filesystemLabel: "",
        mkfsExtraArguments: "",
        mountOptions: [],
        showMoreFilesystemSettings: false,
      });

      expect(result).toEqual({
        reuse: true,
        default: true,
        mountOptions: undefined,
      });
    });

    it("includes mount options when checkbox is checked", () => {
      const result = buildFilesystemConfig({
        filesystem: "reuse",
        filesystemLabel: "",
        mkfsExtraArguments: "",
        mountOptions: ["noatime", "rw"],
        showMoreFilesystemSettings: true,
      });

      expect(result).toEqual({
        reuse: true,
        default: true,
        mountOptions: ["noatime", "rw"],
      });
    });

    it("omits empty mount options even when checkbox is checked", () => {
      const result = buildFilesystemConfig({
        filesystem: "reuse",
        filesystemLabel: "",
        mkfsExtraArguments: "",
        mountOptions: [],
        showMoreFilesystemSettings: true,
      });

      expect(result).toEqual({
        reuse: true,
        default: true,
        mountOptions: undefined,
      });
    });
  });

  describe("AUTO filesystem type", () => {
    it("returns default true with no extra settings", () => {
      const result = buildFilesystemConfig({
        filesystem: "auto",
        filesystemLabel: "",
        mkfsExtraArguments: "",
        mountOptions: [],
        showMoreFilesystemSettings: false,
      });

      expect(result).toEqual({
        default: true,
        label: undefined,
        mkfsExtraArguments: undefined,
        mountOptions: undefined,
      });
    });

    it("includes all extra settings when checkbox is checked", () => {
      const result = buildFilesystemConfig({
        filesystem: "auto",
        filesystemLabel: "my-data",
        mkfsExtraArguments: "-O dir_index",
        mountOptions: ["noatime"],
        showMoreFilesystemSettings: true,
      });

      expect(result).toEqual({
        default: true,
        label: "my-data",
        mkfsExtraArguments: "-O dir_index",
        mountOptions: ["noatime"],
      });
    });

    it("omits extra settings when checkbox is not checked", () => {
      const result = buildFilesystemConfig({
        filesystem: "auto",
        filesystemLabel: "my-data",
        mkfsExtraArguments: "-O dir_index",
        mountOptions: ["noatime"],
        showMoreFilesystemSettings: false,
      });

      expect(result).toEqual({
        default: true,
        label: undefined,
        mkfsExtraArguments: undefined,
        mountOptions: undefined,
      });
    });
  });

  describe("explicit filesystem type", () => {
    it("returns config with type and no extra settings", () => {
      const result = buildFilesystemConfig({
        filesystem: "xfs",
        filesystemLabel: "",
        mkfsExtraArguments: "",
        mountOptions: [],
        showMoreFilesystemSettings: false,
      });

      expect(result).toEqual({
        default: false,
        type: "xfs",
        label: undefined,
        mkfsExtraArguments: undefined,
        mountOptions: undefined,
      });
    });

    it("includes all extra settings for btrfs", () => {
      const result = buildFilesystemConfig({
        filesystem: "btrfs",
        filesystemLabel: "root-fs",
        mkfsExtraArguments: "-m dup",
        mountOptions: ["compress=zstd"],
        showMoreFilesystemSettings: true,
      });

      expect(result).toEqual({
        default: false,
        type: "btrfs",
        label: "root-fs",
        mkfsExtraArguments: "-m dup",
        mountOptions: ["compress=zstd"],
      });
    });
  });
});

describe("buildSizeConfig", () => {
  describe("AUTO mode", () => {
    it("returns undefined", () => {
      const result = buildSizeConfig({
        sizeMode: "auto",
        fixedSize: "",
        rangeMinSize: "",
        rangeMaxSize: "",
        expandMinSize: "",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("FIXED mode", () => {
    it("returns min and max equal to fixed size", () => {
      const result = buildSizeConfig({
        sizeMode: "fixed",
        fixedSize: "10 GiB",
        rangeMinSize: "",
        rangeMaxSize: "",
        expandMinSize: "",
      });

      expect(result).toEqual({
        default: false,
        min: 10737418240, // 10 GiB in bytes
        max: 10737418240,
      });
    });

    it("returns undefined when fixed size is empty", () => {
      const result = buildSizeConfig({
        sizeMode: "fixed",
        fixedSize: "",
        rangeMinSize: "",
        rangeMaxSize: "",
        expandMinSize: "",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("RANGE mode", () => {
    it("returns min and max from range values", () => {
      const result = buildSizeConfig({
        sizeMode: "range",
        fixedSize: "",
        rangeMinSize: "5 GiB",
        rangeMaxSize: "20 GiB",
        expandMinSize: "",
      });

      expect(result).toEqual({
        default: false,
        min: 5368709120, // 5 GiB
        max: 21474836480, // 20 GiB
      });
    });

    it("returns min with undefined max when max is empty", () => {
      const result = buildSizeConfig({
        sizeMode: "range",
        fixedSize: "",
        rangeMinSize: "10 GiB",
        rangeMaxSize: "",
        expandMinSize: "",
      });

      expect(result).toEqual({
        default: false,
        min: 10737418240,
        max: undefined,
      });
    });

    it("returns undefined when min is empty", () => {
      const result = buildSizeConfig({
        sizeMode: "range",
        fixedSize: "",
        rangeMinSize: "",
        rangeMaxSize: "20 GiB",
        expandMinSize: "",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("EXPAND mode", () => {
    it("returns min only, max is undefined", () => {
      const result = buildSizeConfig({
        sizeMode: "expand",
        fixedSize: "",
        rangeMinSize: "",
        rangeMaxSize: "",
        expandMinSize: "8 GiB",
      });

      expect(result).toEqual({
        default: false,
        min: 8589934592, // 8 GiB
      });
    });

    it("returns undefined when expand min is empty", () => {
      const result = buildSizeConfig({
        sizeMode: "expand",
        fixedSize: "",
        rangeMinSize: "",
        rangeMaxSize: "",
        expandMinSize: "",
      });

      expect(result).toBeUndefined();
    });
  });
});

describe("inferSizeFields", () => {
  it("returns AUTO mode for reused devices (name is set)", () => {
    const result = inferSizeFields({
      name: "/dev/sda1",
      size: {
        default: false,
        min: 10737418240,
        max: 10737418240,
      },
    });

    expect(result).toEqual({
      sizeMode: SIZE_MODE.AUTO,
      fixedSize: "",
      rangeMinSize: "",
      rangeMaxSize: "",
      expandMinSize: "",
    });
  });

  it("returns AUTO mode when size config is missing", () => {
    const result = inferSizeFields({});

    expect(result).toEqual({
      sizeMode: SIZE_MODE.AUTO,
      fixedSize: "",
      rangeMinSize: "",
      rangeMaxSize: "",
      expandMinSize: "",
    });
  });

  it("returns AUTO mode when size is default", () => {
    const result = inferSizeFields({
      size: { default: true, min: 0 },
    });

    expect(result).toEqual({
      sizeMode: SIZE_MODE.AUTO,
      fixedSize: "",
      rangeMinSize: "",
      rangeMaxSize: "",
      expandMinSize: "",
    });
  });

  it("returns AUTO mode when min is undefined", () => {
    const result = inferSizeFields({
      size: { default: false, min: undefined },
    });

    expect(result).toEqual({
      sizeMode: SIZE_MODE.AUTO,
      fixedSize: "",
      rangeMinSize: "",
      rangeMaxSize: "",
      expandMinSize: "",
    });
  });

  it("returns EXPAND mode when max is undefined", () => {
    const result = inferSizeFields({
      size: {
        default: false,
        min: 8589934592, // 8 GiB
      },
    });

    expect(result).toEqual({
      sizeMode: SIZE_MODE.EXPAND,
      fixedSize: "",
      rangeMinSize: "",
      rangeMaxSize: "",
      expandMinSize: "8 GiB",
    });
  });

  it("returns FIXED mode when min equals max", () => {
    const result = inferSizeFields({
      size: {
        default: false,
        min: 10737418240, // 10 GiB
        max: 10737418240,
      },
    });

    expect(result).toEqual({
      sizeMode: SIZE_MODE.FIXED,
      fixedSize: "10 GiB",
      rangeMinSize: "",
      rangeMaxSize: "",
      expandMinSize: "",
    });
  });

  it("returns RANGE mode when min < max", () => {
    const result = inferSizeFields({
      size: {
        default: false,
        min: 5368709120, // 5 GiB
        max: 21474836480, // 20 GiB
      },
    });

    expect(result).toEqual({
      sizeMode: SIZE_MODE.RANGE,
      fixedSize: "",
      rangeMinSize: "5 GiB",
      rangeMaxSize: "20 GiB",
      expandMinSize: "",
    });
  });
});

describe("fsConfigValue", () => {
  it("returns AUTO when config is undefined", () => {
    expect(fsConfigValue(undefined)).toBe("auto");
  });

  it("returns AUTO when default is true", () => {
    expect(
      fsConfigValue({
        default: true,
        type: "btrfs",
      }),
    ).toBe("auto");
  });

  it("returns the type when default is false", () => {
    expect(
      fsConfigValue({
        default: false,
        type: "xfs",
      }),
    ).toBe("xfs");
  });

  it("returns AUTO when type is missing and default is false", () => {
    expect(
      fsConfigValue({
        default: false,
      }),
    ).toBe("auto");
  });
});
