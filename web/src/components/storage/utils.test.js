/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import { deviceSize, deviceLabel, parseSize, splitSize } from "./utils";

describe("deviceSize", () => {
  it("returns undefined is size is -1", () => {
    const result = deviceSize(-1);
    expect(result).toBeUndefined();
  });

  it("returns the size with units", () => {
    const result = deviceSize(1024);
    expect(result).toEqual("1 KiB");
  });
});

describe("deviceLabel", () => {
  it("returns the device name and size", () => {
    const result = deviceLabel({ name: "/dev/sda", size: 1024 });
    expect(result).toEqual("/dev/sda, 1 KiB");
  });

  it("returns only the device name if the device has no size", () => {
    const result = deviceLabel({ name: "/dev/sda" });
    expect(result).toEqual("/dev/sda");
  });
});

describe("parseSize", () => {
  it("returns bytes from given input", () => {
    expect(parseSize(1024)).toEqual(1024);
    expect(parseSize("1024")).toEqual(1024);
    expect(parseSize("1 KiB")).toEqual(1024);
    expect(parseSize("2 MiB")).toEqual(2097152);
  });

  it("returns 0 if given input is null, undefined, or empty string", () => {
    expect(parseSize(null)).toEqual(0);
    expect(parseSize(undefined)).toEqual(0);
    expect(parseSize("")).toEqual(0);
  });

  it("does not include decimal part of resulting conversion", () => {
    expect(parseSize("1024.32 KiB")).toEqual(1048903); // Not 1048903.68
  });
});

describe("splitSize", () => {
  it("returns a size object with size and unit from given input", () => {
    expect(splitSize("2048 KiB")).toEqual({ size: 2048, unit: "KiB" });
  });

  it("returns a size object with the result of converting the input when no string is given", () => {
    expect(splitSize(1000)).toEqual({ size: 1000, unit: "B" });
    expect(splitSize(1024)).toEqual({ size: 1, unit: "KiB" });
    expect(splitSize(1048576)).toEqual({ size: 1, unit: "MiB" });
    expect(splitSize(undefined)).toEqual({ size: 0, unit: "B" });
    expect(splitSize(null)).toEqual({ size: 0, unit: "B" });
  });

  it("returns an 'empty' size object when -1 is given", () => {
    expect(splitSize(-1)).toEqual({ size: "", unit: "" });
  });

  it("returns an 'empty' size object when empty string is given", () => {
    expect(splitSize("")).toEqual({ size: "", unit: "" });
  });
});
