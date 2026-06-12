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
import type { PartitionFormData } from "./fields";

describe("validations", () => {
  describe("validate", () => {
    const createBaseFields = (): PartitionFormData => ({
      mountPoint: "/home",
      committedMountPoint: "/home",
      name: "",
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

    describe("mount point validation", () => {
      it("returns error when mount point is empty", () => {
        const fields = { ...createBaseFields(), mountPoint: "" };
        const result = validate(fields);

        expect(result).toBeDefined();
        expect(result?.fields?.mountPoint).toBe("Mount point is required");
      });

      it("returns error for invalid mount point format", () => {
        const invalidMountPoints = [
          "home", // missing leading slash
          "/home/", // trailing slash
          "//home", // double slash
          "/home /user", // space in path
          "/home\tuser", // tab in path
        ];

        invalidMountPoints.forEach((mountPoint) => {
          const fields = { ...createBaseFields(), mountPoint };
          const result = validate(fields);

          expect(result).toBeDefined();
          expect(result?.fields?.mountPoint).toBe("Select or enter a valid mount point");
        });
      });

      it("accepts valid mount points", () => {
        const validMountPoints = ["/", "/home", "/var/lib", "/usr/local/bin", "swap"];

        validMountPoints.forEach((mountPoint) => {
          const fields = { ...createBaseFields(), mountPoint };
          const result = validate(fields);

          expect(result?.fields?.mountPoint).toBeUndefined();
        });
      });

      it("returns error when mount point is already used", () => {
        const fields = { ...createBaseFields(), mountPoint: "/home" };
        const usedMountPoints = ["/", "/home", "/var"];
        const result = validate(fields, usedMountPoints);

        expect(result).toBeDefined();
        expect(result?.fields?.mountPoint).toBe(
          "Select or enter a mount point that is not already assigned to another device",
        );
      });

      it("does not return error when mount point is not in used list", () => {
        const fields = { ...createBaseFields(), mountPoint: "/home" };
        const usedMountPoints = ["/", "/var"];
        const result = validate(fields, usedMountPoints);

        expect(result?.fields?.mountPoint).toBeUndefined();
      });
    });

    describe("filesystem validation", () => {
      it("accepts AUTO filesystem type", () => {
        const fields = {
          ...createBaseFields(),
          filesystem: FILESYSTEM_TYPE.AUTO,
        };
        const result = validate(fields);

        expect(result?.fields?.filesystem).toBeUndefined();
      });

      it("accepts REUSE filesystem action", () => {
        const fields = {
          ...createBaseFields(),
          filesystem: FILESYSTEM_ACTION.REUSE,
        };
        const result = validate(fields);

        expect(result?.fields?.filesystem).toBeUndefined();
      });

      it("returns error when filesystem is empty (not AUTO or REUSE)", () => {
        const fields = {
          ...createBaseFields(),
          filesystem: "",
        };
        const result = validate(fields);

        expect(result).toBeDefined();
        expect(result?.fields?.filesystem).toBe("Select a filesystem type");
      });

      it("accepts concrete filesystem types", () => {
        const filesystemTypes = ["xfs", "btrfs", "ext4", "vfat"];

        filesystemTypes.forEach((filesystem) => {
          const fields = { ...createBaseFields(), filesystem };
          const result = validate(fields);

          expect(result?.fields?.filesystem).toBeUndefined();
        });
      });

      describe("filesystem label validation", () => {
        it("accepts valid labels", () => {
          const validLabels = ["", "my-label", "label_123", "Label.name", "abc123", "___", "---"];

          validLabels.forEach((filesystemLabel) => {
            const fields = { ...createBaseFields(), filesystemLabel };
            const result = validate(fields);

            expect(result?.fields?.filesystemLabel).toBeUndefined();
          });
        });

        it("returns error for invalid label format", () => {
          const invalidLabels = [
            "label with spaces",
            "label/slash",
            "label:colon",
            "label@at",
            "label#hash",
          ];

          invalidLabels.forEach((filesystemLabel) => {
            const fields = { ...createBaseFields(), filesystemLabel };
            const result = validate(fields);

            expect(result).toBeDefined();
            expect(result?.fields?.filesystemLabel).toBe("Invalid label format");
          });
        });

        it("validates label for REUSE filesystem action", () => {
          const fields = {
            ...createBaseFields(),
            filesystem: FILESYSTEM_ACTION.REUSE,
            filesystemLabel: "invalid label!",
          };
          const result = validate(fields);

          expect(result).toBeDefined();
          expect(result?.fields?.filesystemLabel).toBe("Invalid label format");
        });
      });
    });

    describe("size validation", () => {
      describe("AUTO mode", () => {
        it("does not require size fields", () => {
          const fields = {
            ...createBaseFields(),
            sizeMode: SIZE_MODE.AUTO,
          };
          const result = validate(fields);

          expect(result?.fields?.fixedSize).toBeUndefined();
          expect(result?.fields?.rangeMinSize).toBeUndefined();
          expect(result?.fields?.rangeMaxSize).toBeUndefined();
          expect(result?.fields?.expandMinSize).toBeUndefined();
        });
      });

      describe("FIXED mode", () => {
        it("returns error when fixed size is empty", () => {
          const fields = {
            ...createBaseFields(),
            sizeMode: SIZE_MODE.FIXED,
            fixedSize: "",
          };
          const result = validate(fields);

          expect(result).toBeDefined();
          expect(result?.fields?.fixedSize).toBe("Value is required");
        });

        it("returns error for invalid size format", () => {
          const fields = {
            ...createBaseFields(),
            sizeMode: SIZE_MODE.FIXED,
            fixedSize: "not-a-size",
          };
          const result = validate(fields);

          expect(result).toBeDefined();
          expect(result?.fields?.fixedSize).toBe("Invalid format (e.g. 20 GiB)");
        });

        it("accepts valid size format", () => {
          const validSizes = ["20 GiB", "100 MB", "1 TiB", "500 KiB"];

          validSizes.forEach((fixedSize) => {
            const fields = {
              ...createBaseFields(),
              sizeMode: SIZE_MODE.FIXED,
              fixedSize,
            };
            const result = validate(fields);

            expect(result?.fields?.fixedSize).toBeUndefined();
          });
        });
      });

      describe("RANGE mode", () => {
        it("returns error when min size is empty", () => {
          const fields = {
            ...createBaseFields(),
            sizeMode: SIZE_MODE.RANGE,
            rangeMinSize: "",
            rangeMaxSize: "100 GiB",
          };
          const result = validate(fields);

          expect(result).toBeDefined();
          expect(result?.fields?.rangeMinSize).toBe("Minimum is required");
        });

        it("returns error when max size is empty", () => {
          const fields = {
            ...createBaseFields(),
            sizeMode: SIZE_MODE.RANGE,
            rangeMinSize: "10 GiB",
            rangeMaxSize: "",
          };
          const result = validate(fields);

          expect(result).toBeDefined();
          expect(result?.fields?.rangeMaxSize).toBe("Maximum is required");
        });

        it("returns error when both sizes are empty", () => {
          const fields = {
            ...createBaseFields(),
            sizeMode: SIZE_MODE.RANGE,
            rangeMinSize: "",
            rangeMaxSize: "",
          };
          const result = validate(fields);

          expect(result).toBeDefined();
          expect(result?.fields?.rangeMinSize).toBe("Minimum is required");
          expect(result?.fields?.rangeMaxSize).toBe("Maximum is required");
        });

        it("returns error when min size is invalid format", () => {
          const fields = {
            ...createBaseFields(),
            sizeMode: SIZE_MODE.RANGE,
            rangeMinSize: "invalid",
            rangeMaxSize: "100 GiB",
          };
          const result = validate(fields);

          expect(result).toBeDefined();
          expect(result?.fields?.rangeMinSize).toBe("Invalid format (e.g. 20 GiB)");
        });

        it("returns error when max size is invalid format", () => {
          const fields = {
            ...createBaseFields(),
            sizeMode: SIZE_MODE.RANGE,
            rangeMinSize: "10 GiB",
            rangeMaxSize: "invalid",
          };
          const result = validate(fields);

          expect(result).toBeDefined();
          expect(result?.fields?.rangeMaxSize).toBe("Invalid format (e.g. 20 GiB)");
        });

        it("returns error when min size is larger than max size", () => {
          const fields = {
            ...createBaseFields(),
            sizeMode: SIZE_MODE.RANGE,
            rangeMinSize: "100 GiB",
            rangeMaxSize: "50 GiB",
          };
          const result = validate(fields);

          expect(result).toBeDefined();
          expect(result?.fields?.rangeMinSize).toBe("Must be smaller than maximum size");
          expect(result?.fields?.rangeMaxSize).toBe("Must be larger than minimum size");
        });

        it("accepts valid range", () => {
          const fields = {
            ...createBaseFields(),
            sizeMode: SIZE_MODE.RANGE,
            rangeMinSize: "10 GiB",
            rangeMaxSize: "100 GiB",
          };
          const result = validate(fields);

          expect(result?.fields?.rangeMinSize).toBeUndefined();
          expect(result?.fields?.rangeMaxSize).toBeUndefined();
        });
      });

      describe("EXPAND mode", () => {
        it("returns error when expand min size is empty", () => {
          const fields = {
            ...createBaseFields(),
            sizeMode: SIZE_MODE.EXPAND,
            expandMinSize: "",
          };
          const result = validate(fields);

          expect(result).toBeDefined();
          expect(result?.fields?.expandMinSize).toBe("Minimum is required");
        });

        it("returns error for invalid size format", () => {
          const fields = {
            ...createBaseFields(),
            sizeMode: SIZE_MODE.EXPAND,
            expandMinSize: "not-a-size",
          };
          const result = validate(fields);

          expect(result).toBeDefined();
          expect(result?.fields?.expandMinSize).toBe("Invalid format (e.g. 20 GiB)");
        });

        it("accepts valid expand min size", () => {
          const validSizes = ["20 GiB", "100 MB", "1 TiB"];

          validSizes.forEach((expandMinSize) => {
            const fields = {
              ...createBaseFields(),
              sizeMode: SIZE_MODE.EXPAND,
              expandMinSize,
            };
            const result = validate(fields);

            expect(result?.fields?.expandMinSize).toBeUndefined();
          });
        });
      });
    });

    describe("combined validation", () => {
      it("returns undefined when all fields are valid", () => {
        const fields = createBaseFields();
        const result = validate(fields);

        expect(result).toBeUndefined();
      });

      it("returns multiple errors when multiple fields are invalid", () => {
        const fields = {
          ...createBaseFields(),
          mountPoint: "",
          filesystem: "",
          filesystemLabel: "invalid label!",
          sizeMode: SIZE_MODE.FIXED,
          fixedSize: "",
        };
        const result = validate(fields);

        expect(result).toBeDefined();
        expect(result?.fields?.mountPoint).toBeDefined();
        expect(result?.fields?.filesystem).toBeDefined();
        expect(result?.fields?.filesystemLabel).toBeDefined();
        expect(result?.fields?.fixedSize).toBeDefined();
      });

      it("only validates relevant size fields based on mode", () => {
        const fields = {
          ...createBaseFields(),
          sizeMode: SIZE_MODE.FIXED,
          fixedSize: "20 GiB",
          rangeMinSize: "", // not validated in FIXED mode
          expandMinSize: "", // not validated in FIXED mode
        };
        const result = validate(fields);

        expect(result?.fields?.rangeMinSize).toBeUndefined();
        expect(result?.fields?.expandMinSize).toBeUndefined();
      });
    });
  });
});
