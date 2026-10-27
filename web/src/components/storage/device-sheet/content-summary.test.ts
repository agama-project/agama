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
import type { Decision } from "~/components/storage/device-sheet/partition-space";

const GiB = 1024 ** 3;

const part = (name: string, values: Partial<ContentPart> = {}): ContentPart => ({
  name,
  systems: [],
  ...values,
});

/** Parts the new system does not use, all given the same decision. */
const given = (decision: Decision, ...names: string[]) =>
  names.map((name) => part(name, { decision }));

describe("contentSummary", () => {
  it("says nothing when the device holds nothing", () => {
    expect(contentSummary("partitions", [])).toBeUndefined();
  });

  it("counts the parts, then how many meet each fate", () => {
    const parts = [
      ...given("delete", "vdd1", "vdd2", "vdd3"),
      part("vdd4", { decision: "resizeIfNeeded", recoverable: 30 * GiB }),
      part("vdd5", { reusedAs: "/home" }),
    ];

    expect(contentSummary("partitions", parts)).toBe(
      "5 partitions: 3 will be deleted, 1 may be shrunk, and 1 will be mounted at /home",
    );
  });

  describe("when one fate covers every part", () => {
    it("says all of them meet it", () => {
      expect(contentSummary("partitions", given("delete", "vdd1", "vdd2", "vdd3"))).toBe(
        "3 partitions: all will be deleted",
      );
    });

    it("says both when there are two", () => {
      expect(contentSummary("partitions", given("keep", "vdd1", "vdd2"))).toBe(
        "2 partitions: both will be kept",
      );
    });

    it("says it when there is one", () => {
      expect(contentSummary("partitions", given("delete", "vdd1"))).toBe(
        "1 partition: it will be deleted",
      );
    });
  });

  it("names the systems found on what is deleted", () => {
    const parts = [part("vdd1", { decision: "delete", systems: ["Windows 11"] }), part("vdd2")];

    expect(contentSummary("partitions", parts)).toBe(
      "2 partitions: 1 will be deleted (including Windows 11)",
    );
  });

  it("leaves out what is kept next to anything that happens", () => {
    const parts = [
      ...given("delete", "vdd1"),
      part("vdd2", { decision: "resizeIfNeeded", recoverable: 10 * GiB }),
      ...given("keep", "vdd3"),
    ];

    expect(contentSummary("partitions", parts)).toBe(
      "3 partitions: 1 will be deleted and 1 may be shrunk",
    );
  });

  it("does not count what is allowed to shrink but cannot among what is shrunk", () => {
    const parts = [
      part("vdd1", { decision: "resizeIfNeeded", recoverable: 10 * GiB }),
      part("vdd2", { decision: "resizeIfNeeded", recoverable: 20 * GiB }),
      part("vdd3", { decision: "resizeIfNeeded" }),
    ];

    expect(contentSummary("partitions", parts)).toBe("3 partitions: 2 may be shrunk");
  });

  it("says all are kept when nothing allowed to shrink can", () => {
    expect(contentSummary("partitions", given("resizeIfNeeded", "vdd1", "vdd2", "vdd3"))).toBe(
      "3 partitions: all will be kept",
    );
  });

  it("reads parts with no decision as kept", () => {
    expect(contentSummary("partitions", [part("vdd1")])).toBe("1 partition: it will be kept");
  });

  describe("when the new system uses some parts", () => {
    const mounted = (name: string, path: string) => part(name, { reusedAs: path });
    const formatted = (name: string, path: string) => part(name, { reusedAs: path, formats: true });

    it("names where it mounts them as they are while there are few", () => {
      const parts = [...given("delete", "vdd1"), mounted("vdd2", "/"), mounted("vdd3", "/home")];

      expect(contentSummary("partitions", parts)).toBe(
        "3 partitions: 1 will be deleted and 2 will be mounted, at / and /home",
      );
    });

    it("says which of them are formatted, right after what is deleted", () => {
      const parts = [
        ...given("keep", "vdd1"),
        mounted("vdd2", "/home"),
        formatted("vdd3", "/"),
        ...given("delete", "vdd4"),
      ];

      expect(contentSummary("partitions", parts)).toBe(
        "4 partitions: 1 will be deleted, 1 will be formatted for /, and 1 will be mounted at /home",
      );
    });

    it("counts them past two", () => {
      const parts = [
        ...given("delete", "vdd1"),
        formatted("vdd2", "/"),
        formatted("vdd3", "/home"),
        formatted("vdd4", "/srv"),
      ];

      expect(contentSummary("partitions", parts)).toBe(
        "4 partitions: 1 will be deleted and 3 will be formatted for the new system",
      );
    });

    it("says all when it formats every part, past naming them", () => {
      const parts = [formatted("vdd1", "/"), formatted("vdd2", "/home"), formatted("vdd3", "/srv")];

      expect(contentSummary("partitions", parts)).toBe(
        "3 partitions: all will be formatted for the new system",
      );
    });

    it("says both when it mounts the only two", () => {
      expect(contentSummary("partitions", [mounted("vdd1", "/"), mounted("vdd2", "/home")])).toBe(
        "2 partitions: both will be mounted, at / and /home",
      );
    });

    it("says it when it formats the only one", () => {
      expect(contentSummary("partitions", [formatted("vdd1", "/")])).toBe(
        "1 partition: it will be formatted for /",
      );
    });
  });

  it("speaks of logical volumes in a volume group", () => {
    expect(contentSummary("logicalVolumes", given("delete", "home", "swap"))).toBe(
      "2 logical volumes: both will be deleted",
    );
  });
});
