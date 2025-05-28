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

import { classNames, compact, toValidationError, localConnection, slugify } from "./utils";

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

describe("classNames", () => {
  it("join given arguments, ignoring falsy values", () => {
    const includeClass = true;

    expect(
      classNames("bg-yellow", !includeClass && "h-24", undefined, null, includeClass && "w-24"),
    ).toEqual("bg-yellow w-24");
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

describe("slugify", () => {
  it("converts given input into a slug", () => {
    expect(slugify("Agama! / Network 1")).toEqual("agama-network-1");
  });
});
