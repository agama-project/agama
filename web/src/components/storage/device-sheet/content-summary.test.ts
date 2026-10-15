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

import contentSummary from "~/components/storage/device-sheet/content-summary";
import type { ContentPart } from "~/components/storage/device-sheet/content-summary";

const GiB = 1024 ** 3;

const part = (name: string, values: Partial<ContentPart> = {}): ContentPart => ({
  name,
  systems: [],
  ...values,
});

describe("contentSummary", () => {
  it("says nothing when the device holds nothing", () => {
    expect(contentSummary("partitions", "delete", [], 0)).toBeUndefined();
  });

  describe("when deleting", () => {
    it("says how many go, with their data", () => {
      expect(contentSummary("partitions", "delete", [part("vdd1"), part("vdd2")], 0)).toBe(
        "Deletes 2 partitions and their data",
      );
    });

    it("names the systems found on what goes", () => {
      const parts = [part("vdd1", { systems: ["Windows 11"] }), part("vdd2")];

      expect(contentSummary("partitions", "delete", parts, 0)).toBe(
        "Deletes 2 partitions and their data, including Windows 11",
      );
    });

    it("names what the new system uses instead, as the exception", () => {
      const parts = [
        part("vdd1", { systems: ["Windows 11"] }),
        part("vdd4", { reusedAs: "/home" }),
      ];

      expect(contentSummary("partitions", "delete", parts, 0)).toBe(
        "Deletes 1 partition and its data, except vdd4 (for /home)",
      );
    });

    it("counts what the new system uses past two", () => {
      const parts = [
        part("vdd1"),
        part("vdd2", { reusedAs: "/home" }),
        part("vdd3", { reusedAs: "/srv" }),
        part("vdd4", { reusedAs: "/opt" }),
      ];

      expect(contentSummary("partitions", "delete", parts, 0)).toBe(
        "Deletes 1 partition and its data, except 3 reused",
      );
    });
  });

  it("says so when the new system uses everything", () => {
    const parts = [part("vdd1", { reusedAs: "/" }), part("vdd2", { reusedAs: "/home" })];

    expect(contentSummary("partitions", "delete", parts, 0)).toBe(
      "Uses all 2 partitions for the new system",
    );
  });

  describe("when shrinking", () => {
    it("says how many may shrink and how much that frees", () => {
      const parts = [part("vdd1", { recoverable: 30 * GiB }), part("vdd2")];

      expect(contentSummary("partitions", "resize", parts, 0)).toBe(
        "May shrink 1 partition, freeing up to 30 GiB",
      );
    });

    it("says so when none can shrink", () => {
      expect(contentSummary("partitions", "resize", [part("vdd1"), part("vdd2")], 0)).toBe(
        "No partition can be shrunk",
      );
    });
  });

  describe("when keeping", () => {
    it("says how much free space is used", () => {
      expect(contentSummary("partitions", "keep", [part("vdd1")], 2 * GiB)).toBe(
        "Keeps 1 partition, using 2 GiB of free space",
      );
    });

    it("says when there is no free space to use", () => {
      expect(contentSummary("partitions", "keep", [part("vdd1")], 0)).toBe(
        "Keeps 1 partition, with no free space to use",
      );
    });
  });

  it("says nothing under the custom option, where the table is the answer", () => {
    expect(contentSummary("partitions", "custom", [part("vdd1")], 0)).toBeUndefined();
  });

  it("speaks of logical volumes in a volume group", () => {
    expect(contentSummary("logicalVolumes", "delete", [part("home")], 0)).toBe(
      "Deletes 1 logical volume and its data",
    );
  });
});
