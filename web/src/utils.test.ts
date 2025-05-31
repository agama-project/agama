/*
 * Copyright (c) [2022-2024] SUSE LLC
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

import { compact, toValidationError, localConnection, hex, mask } from "./utils";

describe("compact", () => {
  it("removes null and undefined values", () => {
    expect(compact([])).toEqual([]);
    expect(compact([undefined, null, "", 0, 1, NaN, false, true])).toEqual([
      "",
      0,
      1,
      NaN,
      false,
      true,
    ]);
  });
});

describe("hex", () => {
  it("parses numeric dot strings as hex", () => {
    expect(hex("0.0.0160")).toBe(352); // "000160"
    expect(hex("1.2.3")).toBe(291); // "123"
    expect(hex("123")).toBe(291); // "123"
  });

  it("returns 0 for strings with letters or invalid characters", () => {
    expect(hex("1A")).toBe(0);
    expect(hex("1A.3F")).toBe(0);
    expect(hex("xyz")).toBe(0);
    expect(hex("123Z")).toBe(0);
  });

  it("returns 0 for values resulting in empty string", () => {
    expect(hex("..")).toBe(0);
    expect(hex("")).toBe(0);
  });

  it("allows leading or trailing dots", () => {
    expect(hex(".123")).toBe(291);
    expect(hex("123.")).toBe(291);
    expect(hex(".1.2.3.")).toBe(291);
  });
});

describe("mask", () => {
  it("masks all but the last 4 characters by default", () => {
    expect(mask("123456789")).toBe("*****6789");
    expect(mask("abcd")).toBe("abcd");
    expect(mask("abcde")).toBe("*bcde");
  });

  it("respects custom visible count", () => {
    expect(mask("secret", 2)).toBe("****et");
    expect(mask("secret", 0)).toBe("******");
    expect(mask("secret", 6)).toBe("secret");
    expect(mask("secret", 10)).toBe("secret");
  });

  it("uses custom mask character", () => {
    expect(mask("secret", 3, "#")).toBe("###ret");
    expect(mask("secret", 1, "X")).toBe("XXXXXt");
    expect(mask("secret", 2, "!")).toBe("!!!!et");
  });

  it("handles empty and short input values", () => {
    expect(mask("")).toBe("");
    expect(mask("a")).toBe("a");
    expect(mask("ab", 5)).toBe("ab");
  });

  it("handles negative or NaN visible values safely", () => {
    expect(mask("secret", -2)).toBe("******");
    expect(mask("secret", NaN)).toBe("******");
  });

  it("masks with empty character (no masking)", () => {
    expect(mask("secret", 2, "")).toBe("et");
  });
});

describe("toValidationError", () => {
  it("converts an issue to a validation error", () => {
    const issue = {
      description: "Issue 1",
      details: "Details issue 1",
      source: "config",
      severity: "warn",
    };
    expect(toValidationError(issue)).toEqual({ message: "Issue 1" });
  });
});

const localURL = new URL("http://127.0.0.90/");
const localURL2 = new URL("http://localhost:9090/");
const remoteURL = new URL("http://example.com");

describe("localConnection", () => {
  describe("when the page URL is " + localURL, () => {
    it("returns true", () => {
      expect(localConnection(localURL)).toEqual(true);
    });
  });

  describe("when the page URL is " + localURL2, () => {
    it("returns true", () => {
      expect(localConnection(localURL2)).toEqual(true);
    });
  });

  describe("when the page URL is " + remoteURL, () => {
    it("returns false", () => {
      expect(localConnection(remoteURL)).toEqual(false);
    });
  });
});
