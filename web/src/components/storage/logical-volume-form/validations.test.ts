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

import { FILESYSTEM_ACTION, FILESYSTEM_TYPE, SIZE_MODE } from "./fields";
import { validate } from "./validations";
import type { LogicalVolumeFormData } from "./fields";

const createBaseFields = (): LogicalVolumeFormData => ({
  mountPoint: "/home",
  committedMountPoint: "/home",
  target: "",
  lvName: "home",
  filesystem: FILESYSTEM_TYPE.AUTO,
  filesystemAction: FILESYSTEM_ACTION.REUSE,
  filesystemLabel: "",
  mkfsExtraArguments: "",
  mountOptions: [],
  showMoreFilesystemSettings: false,
  sizeMode: SIZE_MODE.AUTO,
  fixedSize: "",
  rangeMinSize: "",
  rangeMaxSize: "",
  expandMinSize: "",
});

describe("validations", () => {
  describe("validate", () => {
    it("passes for a valid new logical volume", () => {
      expect(validate(createBaseFields())).toBeUndefined();
    });

    describe("mount point validation", () => {
      it("returns error when mount point is empty", () => {
        const result = validate({ ...createBaseFields(), mountPoint: "" });
        expect(result?.fields?.mountPoint).toBe("Mount point is required");
      });

      it("returns error for an invalid mount point format", () => {
        const result = validate({ ...createBaseFields(), mountPoint: "home" });
        expect(result?.fields?.mountPoint).toBe("Select or enter a valid mount point");
      });

      it("returns error when the mount point is already used", () => {
        const result = validate({ ...createBaseFields(), mountPoint: "/home" }, ["/home"]);
        expect(result?.fields?.mountPoint).toBe(
          "Select or enter a mount point that is not already assigned to another device",
        );
      });
    });

    describe("logical volume name validation", () => {
      it("requires a name when creating a new logical volume", () => {
        const result = validate({ ...createBaseFields(), target: "", lvName: "" });
        expect(result?.fields?.lvName).toBe("Enter a name");
      });

      it("does not require a name when reusing an existing logical volume", () => {
        const result = validate({
          ...createBaseFields(),
          target: "/dev/system/home",
          lvName: "",
        });
        expect(result?.fields?.lvName).toBeUndefined();
      });
    });

    describe("filesystem validation", () => {
      it("rejects an invalid filesystem label", () => {
        const result = validate({
          ...createBaseFields(),
          showMoreFilesystemSettings: true,
          filesystemLabel: "bad label",
        });
        expect(result?.fields?.filesystemLabel).toBe("Invalid label format");
      });

      it("accepts a valid filesystem label", () => {
        const result = validate({ ...createBaseFields(), filesystemLabel: "my-data_1" });
        expect(result?.fields?.filesystemLabel).toBeUndefined();
      });
    });

    describe("size validation", () => {
      it("requires a value in fixed mode", () => {
        const result = validate({
          ...createBaseFields(),
          sizeMode: SIZE_MODE.FIXED,
          fixedSize: "",
        });
        expect(result?.fields?.fixedSize).toBe("Value is required");
      });

      it("rejects min greater than max in range mode", () => {
        const result = validate({
          ...createBaseFields(),
          sizeMode: SIZE_MODE.RANGE,
          rangeMinSize: "20 GiB",
          rangeMaxSize: "10 GiB",
        });
        expect(result?.fields?.rangeMinSize).toBe("Must be smaller than maximum size");
        expect(result?.fields?.rangeMaxSize).toBe("Must be larger than minimum size");
      });

      it("ignores size errors when reusing a logical volume", () => {
        const result = validate({
          ...createBaseFields(),
          target: "/dev/system/home",
          lvName: "",
          sizeMode: SIZE_MODE.FIXED,
          fixedSize: "",
        });
        expect(result).toBeUndefined();
      });
    });
  });
});
