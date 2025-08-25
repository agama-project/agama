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

import {
  compact,
  localConnection,
  hex,
  mask,
  timezoneTime,
  generateEncodedPath,
  sortCollection,
} from "./utils";

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
  it("parses hexadecimal numeric dot strings as hex", () => {
    expect(hex("0.0.0160")).toBe(352); // "000160"
    expect(hex("0.0.019d")).toBe(413); // "00019d"
    expect(hex("1.2.3")).toBe(291); // "123"
    expect(hex("123")).toBe(291); // "123"
  });

  it("returns 0 for strings invalid characters", () => {
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

describe("timezoneTime", () => {
  const fixedDate = new Date("2023-01-01T12:34:56Z");

  it("returns time in 24h format for a valid timezone", () => {
    const time = timezoneTime("UTC", fixedDate);
    expect(time).toBe("12:34");
  });

  it("uses current date if no date provided", () => {
    // Fake "now"
    const now = new Date("2023-06-01T15:45:00Z");
    jest.useFakeTimers();
    jest.setSystemTime(now);

    const time = timezoneTime("UTC");
    expect(time).toBe("15:45");

    jest.useRealTimers();
  });

  it("returns undefined for invalid timezone", () => {
    expect(timezoneTime("Invalid/Timezone", fixedDate)).toBeUndefined();
  });

  it("rethrows unexpected errors", () => {
    // To simulate unexpected error, mock Intl.DateTimeFormat to throw something else
    const original = Intl.DateTimeFormat;
    // @ts-expect-error because missing properties not needed for this test
    Intl.DateTimeFormat = jest.fn(() => {
      throw new Error("Unexpected");
    });

    expect(() => timezoneTime("UTC", fixedDate)).toThrow("Unexpected");

    Intl.DateTimeFormat = original;
  });
});

describe("localConnection", () => {
  const originalEnv = process.env;
  const localhostURL = new URL("http://localhost");
  const localIpURL = new URL("http://127.0.0.90");
  const remoteURL = new URL("http://example.com");

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses window.location when no argument is provided", () => {
    const originalLocation = window.location;
    delete window.location;
    // @ts-expect-error: https://github.com/microsoft/TypeScript/issues/48949
    window.location = localhostURL;

    expect(localConnection()).toBe(true);

    // Restore
    // @ts-expect-error: https://github.com/microsoft/TypeScript/issues/48949
    window.location = originalLocation;
  });

  it("returns true for 'localhost' hostname", () => {
    expect(localConnection(localhostURL)).toBe(true);
  });

  it("returns true for 127.x.x.x IPs", () => {
    expect(localConnection(new URL(localIpURL))).toBe(true);
  });

  it("returns false for non-local hostnames", () => {
    expect(localConnection(remoteURL)).toBe(false);
  });

  describe("but LOCAL_CONNECTION environment variable is '1'", () => {
    beforeEach(() => {
      process.env.LOCAL_CONNECTION = "1";
    });

    it("returns true for 'localhost' hostname", () => {
      expect(localConnection(localhostURL)).toBe(true);
    });

    it("returns true for 127.x.x.x IPs", () => {
      expect(localConnection(localIpURL)).toBe(true);
    });

    it("returns true for non-local hostnames", () => {
      expect(localConnection(remoteURL)).toBe(true);
    });
  });
});

describe("generateEncodedPath", () => {
  it("encodes special characters in parameters", () => {
    const path = "/network/:id";
    const params = { id: "Wired #1" };

    const result = generateEncodedPath(path, params);

    expect(result).toBe("/network/Wired%20%231");
  });

  it("handles multiple parameters", () => {
    const path = "/network/:id/bridge/:bridge";
    const params = { id: "Wired #1", bridge: "br $0" };

    const result = generateEncodedPath(path, params);

    expect(result).toBe("/network/Wired%20%231/bridge/br%20%240");
  });

  it("leaves safe characters unchanged", () => {
    const path = "/product/:id";
    const params = { id: "12345" };

    const result = generateEncodedPath(path, params);

    expect(result).toBe("/product/12345");
  });

  it("works with empty params", () => {
    const path = "/static/path";

    const result = generateEncodedPath(path, {});

    expect(result).toBe("/static/path");
  });

  it("throws if a param is missing", () => {
    const path = "/network/:id";

    expect(() => generateEncodedPath(path, {})).toThrow();
  });
});

describe("simpleFastSort", () => {
  const fakeDevices = [
    { sid: 100, name: "/dev/sdz", size: 5 },
    { sid: 2, name: "/dev/sdb", size: 10 },
    { sid: 3, name: "/dev/sdc", size: 2 },
    { sid: 10, name: "/dev/sda", size: 5 },
  ];

  it("sorts by a string key in ascending order", () => {
    expect(sortCollection(fakeDevices, "asc", "size")).toEqual([
      { sid: 3, name: "/dev/sdc", size: 2 },
      { sid: 100, name: "/dev/sdz", size: 5 },
      { sid: 10, name: "/dev/sda", size: 5 },
      { sid: 2, name: "/dev/sdb", size: 10 },
    ]);
  });

  it("sorts by a string key in descending order", () => {
    expect(sortCollection(fakeDevices, "desc", "size")).toEqual([
      { sid: 2, name: "/dev/sdb", size: 10 },
      { sid: 100, name: "/dev/sdz", size: 5 },
      { sid: 10, name: "/dev/sda", size: 5 },
      { sid: 3, name: "/dev/sdc", size: 2 },
    ]);
  });

  it("sorts by ISortBy functions in ascending order", () => {
    const sortingFunctions = [(d) => d.size, (d) => d.name];

    expect(sortCollection(fakeDevices, "asc", sortingFunctions)).toEqual([
      { sid: 3, name: "/dev/sdc", size: 2 },
      { sid: 10, name: "/dev/sda", size: 5 },
      { sid: 100, name: "/dev/sdz", size: 5 },
      { sid: 2, name: "/dev/sdb", size: 10 },
    ]);
  });

  it("sorts by ISortBy functions in descending order", () => {
    const sortingFunctions = [(d) => d.size, (d) => d.name];

    expect(sortCollection(fakeDevices, "desc", sortingFunctions)).toEqual([
      { sid: 2, name: "/dev/sdb", size: 10 },
      { sid: 100, name: "/dev/sdz", size: 5 },
      { sid: 10, name: "/dev/sda", size: 5 },
      { sid: 3, name: "/dev/sdc", size: 2 },
    ]);
  });

  it("sorts by ISortBy function for a computed value in ascending order", () => {
    expect(sortCollection(fakeDevices, "asc", (d) => d.sid + d.size)).toEqual([
      { sid: 3, name: "/dev/sdc", size: 2 }, // 5
      { sid: 2, name: "/dev/sdb", size: 10 }, // 12
      { sid: 10, name: "/dev/sda", size: 5 }, // 15
      { sid: 100, name: "/dev/sdz", size: 5 }, // 105
    ]);
  });

  it("sorts by ISortBy function for a computed value in descending order", () => {
    expect(sortCollection(fakeDevices, "desc", (d) => d.sid + d.size)).toEqual([
      { sid: 100, name: "/dev/sdz", size: 5 }, // 105
      { sid: 10, name: "/dev/sda", size: 5 }, // 15
      { sid: 2, name: "/dev/sdb", size: 10 }, // 12
      { sid: 3, name: "/dev/sdc", size: 2 }, // 5
    ]);
  });

  it("does not mutate the original array", () => {
    const original = [...fakeDevices];
    sortCollection(fakeDevices, "asc", "size");
    expect(fakeDevices).toEqual(original);
  });
});
