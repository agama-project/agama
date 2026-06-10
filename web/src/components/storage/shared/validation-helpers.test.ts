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

import { parseToBytes } from "~/components/storage/utils";
import {
  SIZE_FORMAT_REGEXP,
  isValidSize,
  requiredSize,
  optionalSize,
  sizeRange,
  sizeAtLeast,
  sizeAtMost,
} from "./validation-helpers";

describe("validation-helpers", () => {
  describe("SIZE_FORMAT_REGEXP", () => {
    it("matches valid size strings with binary units", () => {
      const validSizes = ["20 GiB", "100 MiB", "1 TiB", "500 KiB", "1.5 GiB"];

      validSizes.forEach((size) => {
        expect(SIZE_FORMAT_REGEXP.test(size)).toBe(true);
      });
    });

    it("matches valid size strings with decimal units", () => {
      const validSizes = ["20 GB", "100 MB", "1 TB", "500 KB", "1.5 GB"];

      validSizes.forEach((size) => {
        expect(SIZE_FORMAT_REGEXP.test(size)).toBe(true);
      });
    });

    it("matches size strings without space", () => {
      const validSizes = ["20GiB", "100MB", "1TiB"];

      validSizes.forEach((size) => {
        expect(SIZE_FORMAT_REGEXP.test(size)).toBe(true);
      });
    });

    it("does not match invalid size strings", () => {
      const invalidSizes = [
        "",
        "invalid",
        "20",
        "GiB",
        "20 G",
        "20 GiByte",
        "-20 GiB",
        "20 GiB extra",
      ];

      invalidSizes.forEach((size) => {
        expect(SIZE_FORMAT_REGEXP.test(size)).toBe(false);
      });
    });
  });

  describe("isValidSize", () => {
    it("returns true for valid size strings", () => {
      const validSizes = ["20 GiB", "100 MB", "1.5 TiB", "500KiB"];

      validSizes.forEach((size) => {
        expect(isValidSize(size)).toBe(true);
      });
    });

    it("returns false for invalid size strings", () => {
      const invalidSizes = ["", "invalid", "20", "-20 GiB"];

      invalidSizes.forEach((size) => {
        expect(isValidSize(size)).toBe(false);
      });
    });
  });

  describe("requiredSize", () => {
    const emptyMessage = "Size is required";
    const invalidMessage = "Invalid size format";

    it("returns empty message when value is empty", () => {
      expect(requiredSize("", emptyMessage, invalidMessage)).toBe(emptyMessage);
    });

    it("returns invalid message for invalid size format", () => {
      const invalidSizes = ["invalid", "20", "-20 GiB", "abc"];

      invalidSizes.forEach((size) => {
        expect(requiredSize(size, emptyMessage, invalidMessage)).toBe(invalidMessage);
      });
    });

    it("returns undefined for valid size strings", () => {
      const validSizes = ["20 GiB", "100 MB", "1.5 TiB"];

      validSizes.forEach((size) => {
        expect(requiredSize(size, emptyMessage, invalidMessage)).toBeUndefined();
      });
    });
  });

  describe("optionalSize", () => {
    const invalidMessage = "Invalid size format";

    it("returns undefined when value is empty", () => {
      expect(optionalSize("", invalidMessage)).toBeUndefined();
    });

    it("returns invalid message for invalid size format", () => {
      const invalidSizes = ["invalid", "20", "-20 GiB"];

      invalidSizes.forEach((size) => {
        expect(optionalSize(size, invalidMessage)).toBe(invalidMessage);
      });
    });

    it("returns undefined for valid size strings", () => {
      const validSizes = ["20 GiB", "100 MB", "1.5 TiB"];

      validSizes.forEach((size) => {
        expect(optionalSize(size, invalidMessage)).toBeUndefined();
      });
    });
  });

  describe("sizeRange", () => {
    const message = "Min must be smaller than max";

    it("returns undefined when min is less than max", () => {
      expect(sizeRange("10 GiB", "20 GiB", message)).toBeUndefined();
      expect(sizeRange("100 MB", "1 GiB", message)).toBeUndefined();
    });

    it("returns undefined when min equals max", () => {
      expect(sizeRange("10 GiB", "10 GiB", message)).toBeUndefined();
    });

    it("returns error message when min is greater than max", () => {
      expect(sizeRange("20 GiB", "10 GiB", message)).toBe(message);
      expect(sizeRange("1 GiB", "100 MB", message)).toBe(message);
    });

    it("returns undefined when minValue is empty", () => {
      expect(sizeRange("", "20 GiB", message)).toBeUndefined();
    });

    it("returns undefined when maxValue is empty", () => {
      expect(sizeRange("10 GiB", "", message)).toBeUndefined();
    });

    it("returns undefined when both values are empty", () => {
      expect(sizeRange("", "", message)).toBeUndefined();
    });

    it("returns undefined when minValue is invalid", () => {
      expect(sizeRange("invalid", "20 GiB", message)).toBeUndefined();
    });

    it("returns undefined when maxValue is invalid", () => {
      expect(sizeRange("10 GiB", "invalid", message)).toBeUndefined();
    });

    it("returns undefined when both values are invalid", () => {
      expect(sizeRange("invalid1", "invalid2", message)).toBeUndefined();
    });
  });

  describe("sizeAtLeast", () => {
    const message = "Size is too small";
    const minBytes = parseToBytes("10 GiB");

    it("returns undefined when size meets minimum threshold", () => {
      expect(sizeAtLeast("20 GiB", minBytes, message)).toBeUndefined();
      expect(sizeAtLeast("10 GiB", minBytes, message)).toBeUndefined();
    });

    it("returns error message when size is below minimum threshold", () => {
      expect(sizeAtLeast("5 GiB", minBytes, message)).toBe(message);
      expect(sizeAtLeast("100 MB", minBytes, message)).toBe(message);
    });

    it("returns undefined when value is empty", () => {
      expect(sizeAtLeast("", minBytes, message)).toBeUndefined();
    });

    it("returns undefined when value is invalid", () => {
      expect(sizeAtLeast("invalid", minBytes, message)).toBeUndefined();
    });
  });

  describe("sizeAtMost", () => {
    const message = "Size is too large";
    const maxBytes = parseToBytes("20 GiB");

    it("returns undefined when size is within maximum threshold", () => {
      expect(sizeAtMost("10 GiB", maxBytes, message)).toBeUndefined();
      expect(sizeAtMost("20 GiB", maxBytes, message)).toBeUndefined();
      expect(sizeAtMost("100 MB", maxBytes, message)).toBeUndefined();
    });

    it("returns error message when size exceeds maximum threshold", () => {
      expect(sizeAtMost("30 GiB", maxBytes, message)).toBe(message);
      expect(sizeAtMost("100 TiB", maxBytes, message)).toBe(message);
    });

    it("returns undefined when value is empty", () => {
      expect(sizeAtMost("", maxBytes, message)).toBeUndefined();
    });

    it("returns undefined when value is invalid", () => {
      expect(sizeAtMost("invalid", maxBytes, message)).toBeUndefined();
    });
  });
});
