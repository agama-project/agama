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

import type { Decision } from "~/components/storage/device-sheet/partition-space";
import type { ContentPart } from "~/components/storage/device-sheet/current-content-summary";
import {
  buildCurrentContentSummary,
  summaryText,
} from "~/components/storage/device-sheet/current-content-summary";

const GiB = 1024 ** 3;

const part = (name: string, values: Partial<ContentPart> = {}): ContentPart => ({
  name,
  systems: [],
  ...values,
});

/** Parts the new system does not use, all given the same decision. */
const given = (decision: Decision, ...names: string[]) =>
  names.map((name) => part(name, { decision }));

const shrinkable = (name: string) =>
  part(name, { decision: "resizeIfNeeded", recoverable: 10 * GiB });

/** The summary of some partitions, as plain text. */
const summaryOf = (parts: ContentPart[]) =>
  summaryText(buildCurrentContentSummary({ kind: "partitions", parts }));

describe("buildCurrentContentSummary", () => {
  it("says nothing when the device holds nothing", () => {
    expect(buildCurrentContentSummary({ kind: "partitions", parts: [] })).toBeUndefined();
  });

  it("marks the amount between brackets, to be shown in bold", () => {
    expect(
      buildCurrentContentSummary({ kind: "partitions", parts: given("delete", "vdd1") }).sentence,
    ).toBe("[1 partition]: it will be deleted.");
  });

  describe("when one outcome covers every part", () => {
    it("says it of all of them, or of it where there is one", () => {
      expect(summaryOf(given("delete", "vdd1", "vdd2", "vdd3"))).toBe(
        "3 partitions: all will be deleted.",
      );
      expect(summaryOf(given("keep", "vdd1"))).toBe("1 partition: it will be kept.");
      expect(summaryOf([shrinkable("vdd1"), shrinkable("vdd2")])).toBe(
        "2 partitions: all may be shrunk.",
      );
    });
  });

  describe("when the outcomes are mixed", () => {
    it("counts each outcome said, leaving what is kept out", () => {
      expect(
        summaryOf([...given("delete", "vdd1"), shrinkable("vdd2"), ...given("keep", "vdd3")]),
      ).toBe("3 partitions: 1 will be deleted and 1 may be shrunk.");
    });

    it("says them in the order deleted, formatted, shrunk, mounted", () => {
      const parts = [
        part("vdd1", { reusedAs: '"/home"' }),
        shrinkable("vdd2"),
        part("vdd3", { reusedAs: '"/docs"', formats: true }),
        ...given("delete", "vdd4"),
        ...given("keep", "vdd5"),
      ];

      expect(buildCurrentContentSummary({ kind: "partitions", parts }).sentence).toBe(
        "[5 partitions]: 1 will be deleted, 1 will be formatted, 1 may be shrunk and 1 will be mounted unchanged.",
      );
    });

    it("says what is kept only when everything is", () => {
      expect(summaryOf([...given("delete", "vdd1"), ...given("keep", "vdd2", "vdd3")])).toBe(
        "3 partitions: 1 will be deleted.",
      );
    });

    it("counts a part allowed to shrink that cannot among what is kept", () => {
      expect(summaryOf([shrinkable("vdd1"), ...given("resizeIfNeeded", "vdd2")])).toBe(
        "2 partitions: 1 may be shrunk.",
      );
    });
  });

  describe("after the main sentence", () => {
    it("says which systems deleting loses, once each", () => {
      const parts = [
        part("vdd1", { decision: "delete", systems: ["Windows 11"] }),
        part("vdd2", { decision: "delete", systems: ["Windows 11", "openSUSE"] }),
      ];

      expect(summaryOf(parts)).toBe(
        "2 partitions: all will be deleted. Windows 11 and openSUSE will be lost.",
      );
    });

    it("leaves out the systems of what is not deleted", () => {
      expect(summaryOf([part("vdd1", { decision: "keep", systems: ["Windows 11"] })])).toBe(
        "1 partition: it will be kept.",
      );
    });

    it("names every mount point, the formatted ones first", () => {
      const parts = [
        part("vdd1", { reusedAs: '"/home"' }),
        part("vdd2", { reusedAs: '"/docs"', formats: true }),
        part("vdd3", { reusedAs: '"/srv"', formats: true }),
        part("vdd4", { reusedAs: '"/var"', formats: true }),
      ];

      expect(buildCurrentContentSummary({ kind: "partitions", parts }).details).toEqual([
        '"/docs", "/srv", and "/var" will be formatted.',
        '"/home" will be mounted unchanged.',
      ]);
    });
  });

  it("speaks of logical volumes on a volume group", () => {
    expect(
      summaryText(
        buildCurrentContentSummary({ kind: "logicalVolumes", parts: given("delete", "a", "b") }),
      ),
    ).toBe("2 logical volumes: all will be deleted.");
  });
});
