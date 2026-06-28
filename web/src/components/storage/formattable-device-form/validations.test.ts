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

import { FILESYSTEM_ACTION, FILESYSTEM_TYPE } from "./fields";
import { validate } from "./validations";
import type { FormattableDeviceFormData } from "./fields";

const createBaseFields = (): FormattableDeviceFormData => ({
  mountPoint: "/home",
  committedMountPoint: "/home",
  filesystem: FILESYSTEM_TYPE.AUTO,
  filesystemAction: FILESYSTEM_ACTION.REUSE,
  filesystemLabel: "",
  mkfsExtraArguments: "",
  mountOptions: [],
  showMoreFilesystemSettings: false,
});

describe("validations", () => {
  describe("validate", () => {
    it("passes for valid values", () => {
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

    describe("filesystem validation", () => {
      it("accepts keeping the current filesystem", () => {
        const result = validate({ ...createBaseFields(), filesystem: FILESYSTEM_ACTION.REUSE });
        expect(result).toBeUndefined();
      });

      it("accepts a concrete filesystem type", () => {
        const result = validate({ ...createBaseFields(), filesystem: "xfs" });
        expect(result).toBeUndefined();
      });

      it("rejects an empty filesystem selection", () => {
        const result = validate({ ...createBaseFields(), filesystem: "" });
        expect(result?.fields?.filesystem).toBe("Select a filesystem type");
      });

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
  });
});
