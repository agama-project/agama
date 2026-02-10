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
  maskSecrets,
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

describe("maskSecrets", () => {
  it("should filter sensitive keys from an object", () => {
    const obj = { user: "test", password: "123" };
    const sanitized = maskSecrets(obj, { stringify: false });
    expect(sanitized).toEqual({ user: "test", password: "[FILTERED]" });
  });

  it("should not modify an object without sensitive keys", () => {
    const obj = { user: "test", id: 1 };
    const sanitized = maskSecrets(obj, { stringify: false });
    expect(sanitized).toEqual({ user: "test", id: 1 });
  });

  it("should recursively filter sensitive keys in nested objects", () => {
    const obj = {
      user: "test",
      credentials: {
        password: "123",
      },
    };
    const sanitized = maskSecrets(obj, { stringify: false });
    expect(sanitized).toEqual({
      user: "test",
      credentials: {
        password: "[FILTERED]",
      },
    });
  });

  it("should handle arrays of objects", () => {
    const arr = [
      { user: "one", password: "123" },
      { user: "two", id: 2 },
    ];
    const sanitized = maskSecrets(arr, { stringify: false });
    expect(sanitized).toEqual([
      { user: "one", password: "[FILTERED]" },
      { user: "two", id: 2 },
    ]);
  });

  it("should not mutate the original object", () => {
    const originalObj = { user: "test", password: "123" };
    const originalObjCopy = JSON.parse(JSON.stringify(originalObj));
    maskSecrets(originalObj, { stringify: false });
    expect(originalObj).toEqual(originalObjCopy);
  });

  it("should handle null and undefined values correctly", () => {
    const obj = { user: "test", password: "123", data: null, extra: undefined };
    const sanitized = maskSecrets(obj, { stringify: false });
    // Note: `undefined` properties are omitted when creating a new object from an existing one.
    expect(sanitized).toEqual({ user: "test", password: "[FILTERED]", data: null });
  });

  it("should return primitive values unmodified", () => {
    expect(maskSecrets("string", { stringify: false })).toBe("string");
    expect(maskSecrets(123, { stringify: false })).toBe(123);
    expect(maskSecrets(true, { stringify: false })).toBe(true);
    expect(maskSecrets(null, { stringify: false })).toBe(null);
    expect(maskSecrets(undefined, { stringify: false })).toBe(undefined);
  });

  it("should handle an empty object", () => {
    expect(maskSecrets({}, { stringify: false })).toEqual({});
  });

  it("should handle an empty array", () => {
    expect(maskSecrets([], { stringify: false })).toEqual([]);
  });

  it("should filter all defined sensitive keys", () => {
    const obj = {
      user: "test",
      password: "123",
      hashedPassword: false,
      registrationCode: "xyz",
    };
    expect(maskSecrets(obj, { stringify: false })).toEqual({
      user: "test",
      password: "[FILTERED]",
      hashedPassword: false,
      registrationCode: "[FILTERED]",
    });
  });

  it("should handle custom sensitive keys", () => {
    const obj = { user: "test", password: "123", sensitive: "abc" };
    const sanitized = maskSecrets(obj, { sensitiveKeys: ["sensitive"], stringify: false });
    expect(sanitized).toEqual({ user: "test", password: "123", sensitive: "[FILTERED]" });
  });

  it("can optionally stringify the output", () => {
    expect(maskSecrets([], { stringify: true })).toEqual("[]");
    expect(maskSecrets({}, { stringify: true })).toEqual("{}");
    expect(maskSecrets({ user: "test", password: "123" }, { stringify: true })).toEqual(
      '{\n  "user": "test",\n  "password": "[FILTERED]"\n}',
    );
  });
});
