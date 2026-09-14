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

import { parsePasteEntries, pasteAnnouncement } from "~/components/form/entry-helpers";

// parsePasteEntries is tested directly because the fields using it hold their
// draft in an <input type="text"> (despite managing multiple values in state). Text inputs strip
// newlines per HTML spec when setting the value property, making it impossible to
// integration-test paste splitting with newline patterns like splitPasteOn="\n".
// Reference: https://html.spec.whatwg.org/multipage/input.html#text-(type=text)-state-and-search-state-(type=search)
describe("parsePasteEntries", () => {
  describe("default splitting (whitespace and commas)", () => {
    it("splits on spaces", () => {
      expect(parsePasteEntries("alpha beta gamma")).toEqual(["alpha", "beta", "gamma"]);
    });

    it("splits on commas", () => {
      expect(parsePasteEntries("alpha,beta,gamma")).toEqual(["alpha", "beta", "gamma"]);
    });

    it("splits on mixed whitespace and commas", () => {
      expect(parsePasteEntries("alpha, beta gamma,delta")).toEqual([
        "alpha",
        "beta",
        "gamma",
        "delta",
      ]);
    });

    it("filters out blank entries", () => {
      expect(parsePasteEntries("alpha  beta   gamma")).toEqual(["alpha", "beta", "gamma"]);
    });

    it("trims whitespace from entries", () => {
      expect(parsePasteEntries("  alpha  ,  beta  ")).toEqual(["alpha", "beta"]);
    });

    it("returns empty array for blank input", () => {
      expect(parsePasteEntries("")).toEqual([]);
      expect(parsePasteEntries("   ")).toEqual([]);
    });
  });

  describe("custom splitPasteOn pattern", () => {
    it("splits on newlines when given \\n", () => {
      expect(parsePasteEntries("alpha\nbeta\ngamma", "\n")).toEqual(["alpha", "beta", "gamma"]);
    });

    it("splits on custom regex pattern", () => {
      expect(parsePasteEntries("alpha|beta|gamma", /\|/)).toEqual(["alpha", "beta", "gamma"]);
    });

    it("preserves spaces within entries when splitting on newlines", () => {
      const input = "ssh-ed25519 AAAAC3Nz user@laptop\nssh-rsa AAAAB3Nz user@desktop";
      expect(parsePasteEntries(input, "\n")).toEqual([
        "ssh-ed25519 AAAAC3Nz user@laptop",
        "ssh-rsa AAAAB3Nz user@desktop",
      ]);
    });

    it("filters blank entries when splitting with custom pattern", () => {
      expect(parsePasteEntries("alpha\n\nbeta\n", "\n")).toEqual(["alpha", "beta"]);
    });

    it("trims whitespace from entries even with custom pattern", () => {
      expect(parsePasteEntries("  alpha  \n  beta  ", "\n")).toEqual(["alpha", "beta"]);
    });
  });
});

// Tested directly because the two fields sharing it reach different branches:
// each turns entries down for its own reason, and neither exercises the other's
// wording. The outcomes they do share must read the same in both.
describe("pasteAnnouncement", () => {
  const invalid = (count: number) => ({ count, kind: "invalid" }) as const;
  const unavailable = (count: number) => ({ count, kind: "unavailable" }) as const;

  describe("outcomes both fields share", () => {
    it("says only what was added when nothing was turned down", () => {
      expect(pasteAnnouncement(3, 0, invalid(0))).toBe("3 entries added.");
      expect(pasteAnnouncement(3, 0, unavailable(0))).toBe("3 entries added.");
    });

    it("adds the duplicates that were skipped", () => {
      expect(pasteAnnouncement(2, 1, invalid(0))).toBe("2 entries added, 1 duplicates skipped.");
      expect(pasteAnnouncement(2, 1, unavailable(0))).toBe(
        "2 entries added, 1 duplicates skipped.",
      );
    });

    it("speaks of the duplicates alone when they are the whole story", () => {
      expect(pasteAnnouncement(0, 2, invalid(0))).toBe("2 duplicates skipped.");
      expect(pasteAnnouncement(0, 2, unavailable(0))).toBe("2 duplicates skipped.");
    });
  });

  describe("the reason each field turns an entry down", () => {
    it("calls an entry that went in with an error invalid", () => {
      expect(pasteAnnouncement(3, 0, invalid(1))).toBe("3 entries added, 1 invalid.");
      expect(pasteAnnouncement(3, 2, invalid(1))).toBe(
        "3 entries added, 1 invalid, 2 duplicates skipped.",
      );
    });

    it("calls an entry the field does not offer unavailable", () => {
      expect(pasteAnnouncement(3, 0, unavailable(1))).toBe("3 entries added, 1 not available.");
      expect(pasteAnnouncement(3, 2, unavailable(1))).toBe(
        "3 entries added, 1 not available, 2 duplicates skipped.",
      );
    });
  });

  // Nothing added can mean nothing was on offer, so the shortcut for a paste
  // that only met duplicates has to stand aside and let the count be told.
  it("still tells what was turned down when nothing was added", () => {
    expect(pasteAnnouncement(0, 0, unavailable(2))).toBe("0 entries added, 2 not available.");
    expect(pasteAnnouncement(0, 1, unavailable(2))).toBe(
      "0 entries added, 2 not available, 1 duplicates skipped.",
    );
  });
});
