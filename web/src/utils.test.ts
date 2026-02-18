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
  sortCollection,
  mergeSources,
  extendCollection,
} from "./utils";
import type { Target as ConfigTarget } from "~/openapi/config/iscsi";
import type { Target as SystemTarget } from "~/openapi/system/iscsi";
import type { Device as ConfigDevice } from "./openapi/config/dasd";
import type { Device as SystemDevice } from "./openapi/system/dasd";

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

describe("mergeSources", () => {
  it("merges collections honoring precedence when primary key is based on single attribute", () => {
    const result = mergeSources({
      collections: {
        system: [
          {
            name: "iqn.2023-01.com.example:12ac588",
            address: "192.168.100.102",
            port: 3262,
            interface: "default",
            ibft: false,
            startup: "onboot",
            connected: true,
            locked: false,
          },
        ],
        config: [
          {
            name: "iqn.2023-01.com.example:12ac588",
            address: "192.168.100.102",
            port: 3262,
            interface: "default",
            startup: "onboot",
          },
          {
            name: "iqn.2023-01.com.example:12ac788",
            address: "192.168.100.106",
            port: 3264,
            interface: "default",
            startup: "onboot",
          },
        ],
      },
      precedence: ["system", "config"],
      primaryKey: "name",
    });

    expect(result).toHaveLength(2);

    expect(result[0]).toMatchObject({
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: 3262,
      interface: "default",
      ibft: false,
      startup: "onboot",
      connected: true,
      locked: false,
      sources: ["system", "config"],
    });

    expect(result[1]).toMatchObject({
      name: "iqn.2023-01.com.example:12ac788",
      address: "192.168.100.106",
      port: 3264,
      sources: ["config"],
    });
  });

  it("merges collections honoring precedence when primary key is based on mulitple attribute", () => {
    type MergedTarget = Partial<SystemTarget> & Partial<ConfigTarget>;
    const result = mergeSources<MergedTarget, keyof MergedTarget>({
      collections: {
        system: [
          {
            name: "iqn.2023-01.com.example:storage",
            address: "192.168.100.102",
            port: 3260,
            interface: "default",
            ibft: false,
            startup: "onboot",
            connected: true,
            locked: false,
          },
          {
            name: "iqn.2023-01.com.example:storage",
            address: "192.168.100.102",
            port: 3261,
            interface: "default",
            ibft: false,
            startup: "manual",
            connected: false,
            locked: false,
          },
        ],
        config: [
          {
            name: "iqn.2023-01.com.example:storage",
            address: "192.168.100.102",
            port: 3260,
            interface: "default",
            startup: "onboot",
          },
          {
            name: "iqn.2023-01.com.example:storage",
            address: "192.168.100.102",
            port: 3261,
            interface: "default",
            startup: "manual",
          },
          {
            name: "iqn.2023-01.com.example:storage",
            address: "192.168.100.103",
            port: 3260,
            interface: "default",
            startup: "onboot",
          },
        ],
      },
      precedence: ["system", "config"],
      primaryKey: ["name", "address", "port"],
    });

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      name: "iqn.2023-01.com.example:storage",
      address: "192.168.100.102",
      port: 3260,
      connected: true,
      sources: ["system", "config"],
    });
    expect(result[1]).toMatchObject({
      name: "iqn.2023-01.com.example:storage",
      address: "192.168.100.102",
      port: 3261,
      connected: false,
      sources: ["system", "config"],
    });
    expect(result[2]).toMatchObject({
      name: "iqn.2023-01.com.example:storage",
      address: "192.168.100.103",
      port: 3260,
      sources: ["config"],
    });
    expect(result[2]).not.toHaveProperty("connected");
  });

  it('uses "id" as default primary key when not specified', () => {
    const result = mergeSources({
      collections: {
        source1: [
          { id: 1, value: "first" },
          { id: 2, value: "second" },
        ],
        source2: [
          { id: 1, value: "duplicate" },
          { id: 3, value: "third" },
        ],
      },
      precedence: ["source1", "source2"],
    });

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: 1, value: "first", sources: ["source1", "source2"] });
    expect(result[1]).toEqual({ id: 2, value: "second", sources: ["source1"] });
    expect(result[2]).toEqual({ id: 3, value: "third", sources: ["source2"] });
  });

  it("returns empty array when all collections are empty", () => {
    const result = mergeSources({
      collections: {
        system: [],
        config: [],
      },
      precedence: ["system", "config"],
      primaryKey: "name",
    });

    expect(result).toEqual([]);
  });

  it("handles single collection with multiple items", () => {
    const result = mergeSources({
      collections: {
        config: [
          {
            name: "iqn.2023-01.com.example:target1",
            address: "192.168.100.1",
            port: 3260,
            interface: "default",
            startup: "onboot",
          },
          {
            name: "iqn.2023-01.com.example:target2",
            address: "192.168.100.2",
            port: 3260,
            interface: "default",
            startup: "manual",
          },
        ],
      },
      precedence: ["config"],
      primaryKey: "name",
    });

    expect(result).toHaveLength(2);
    expect(result[0].sources).toEqual(["config"]);
    expect(result[1].sources).toEqual(["config"]);
  });

  it("supports more than two collections", () => {
    const result = mergeSources({
      collections: {
        system: [
          {
            name: "iqn.2023-01.com.example:shared",
            address: "192.168.100.1",
            port: 3260,
            interface: "default",
            ibft: false,
            startup: "onboot",
            connected: true,
            locked: false,
          },
        ],
        config: [
          {
            name: "iqn.2023-01.com.example:shared",
            address: "192.168.100.1",
            port: 3260,
            interface: "default",
            startup: "onboot",
          },
        ],
        extended: [
          {
            name: "iqn.2023-01.com.example:shared",
            address: "192.168.100.1",
            port: 3260,
            interface: "default",
            startup: "onboot",
          },
        ],
      },
      precedence: ["system", "config", "extended"],
      primaryKey: "name",
    });

    expect(result).toHaveLength(1);
    expect(result[0].sources).toEqual(["system", "config", "extended"]);
    expect(result[0].connected).toBe(true);
  });
});

describe("extendCollection", () => {
  describe("single key matching", () => {
    it("extends items matching keys", () => {
      const configDevices: ConfigDevice[] = [
        { channel: "0.0.0160", diag: false, format: true, state: "offline" },
      ];

      const systemDevices: SystemDevice[] = [
        {
          channel: "0.0.0160",
          active: false,
          deviceName: "dasda",
          type: "eckd",
          formatted: false,
          diag: true,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
        },
      ];

      const result = extendCollection(configDevices, {
        with: systemDevices,
        matching: "channel",
      });

      expect(result).toEqual([
        {
          channel: "0.0.0160",
          diag: false, // from config (baseWins / default precedence)
          format: true,
          state: "offline",
          active: false, // from system
          deviceName: "dasda",
          type: "eckd",
          formatted: false,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
        },
      ]);
    });

    it("respects 'extensionWins' precedence", () => {
      const configDevices: ConfigDevice[] = [{ channel: "0.0.0160", diag: false, format: true }];

      const systemDevices: SystemDevice[] = [
        {
          channel: "0.0.0160",
          active: true,
          deviceName: "dasda",
          type: "eckd",
          formatted: true,
          diag: true,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
        },
      ];

      const result = extendCollection(configDevices, {
        with: systemDevices,
        matching: "channel",
        precedence: "extensionWins",
      });

      expect(result).toEqual([
        {
          channel: "0.0.0160",
          diag: true, // from system (extensionWins precedence)
          format: true,
          active: true,
          deviceName: "dasda",
          type: "eckd",
          formatted: true,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
        },
      ]);
    });

    it("keeps items without matches unchanged", () => {
      const configDevices: ConfigDevice[] = [
        { channel: "0.0.0160", diag: false },
        { channel: "0.0.0200", format: true },
      ];

      const systemDevices: SystemDevice[] = [
        {
          channel: "0.0.0160",
          active: true,
          deviceName: "dasda",
          type: "eckd",
          formatted: false,
          diag: true,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
        },
      ];

      const result = extendCollection(configDevices, {
        with: systemDevices,
        matching: "channel",
      });

      expect(result).toHaveLength(2);
      expect(result[0].channel).toBe("0.0.0160");
      expect(result[0].deviceName).toBe("dasda");
      expect(result[1]).toEqual({ channel: "0.0.0200", format: true }); // unchanged
    });

    it("does not include items present only in extension collection", () => {
      const configDevices: ConfigDevice[] = [{ channel: "0.0.0160", diag: false }];

      const systemDevices: SystemDevice[] = [
        {
          channel: "0.0.0160",
          active: true,
          deviceName: "dasda",
          type: "eckd",
          formatted: false,
          diag: true,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
        },
        {
          channel: "0.0.0200",
          active: true,
          deviceName: "dasdb",
          type: "fba",
          formatted: false,
          diag: false,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
        },
      ];

      const result = extendCollection(configDevices, {
        with: systemDevices,
        matching: "channel",
      });

      expect(result).toHaveLength(1);
      expect(result[0].channel).toBe("0.0.0160");
    });
  });

  describe("multiple key matching", () => {
    it("extends devices with matching keys", () => {
      const configDevices: ConfigDevice[] = [
        { channel: "0.0.0150", state: "offline", diag: false },
        { channel: "0.0.0160", state: "active", diag: false },
      ];

      const systemDevices: SystemDevice[] = [
        {
          channel: "0.0.0150",
          status: "offline",
          active: false,
          deviceName: "dasdc",
          type: "eckd",
          formatted: false,
          diag: true,
          accessType: "rw",
          partitionInfo: "1",
        },
        {
          channel: "0.0.0160",
          status: "offline",
          active: false,
          deviceName: "dasda",
          type: "eckd",
          formatted: false,
          diag: false,
          accessType: "rw",
          partitionInfo: "1",
        },
      ];

      const result = extendCollection(configDevices, {
        with: systemDevices,
        matching: ["channel", "diag"],
      });

      expect(result).toEqual([
        { channel: "0.0.0150", state: "offline", diag: false },
        {
          channel: "0.0.0160",
          state: "active",
          diag: false,
          status: "offline",
          active: false,
          deviceName: "dasda",
          type: "eckd",
          formatted: false,
          accessType: "rw",
          partitionInfo: "1",
        },
      ]);
    });
  });

  describe("edge cases", () => {
    it("handles empty base collection", () => {
      const result = extendCollection([], {
        with: [{ id: 1, name: "test" }],
        matching: "id",
      });

      expect(result).toEqual([]);
    });

    it("handles empty extension collection", () => {
      const items = [{ channel: "0.0.0160", diag: false }];

      const result = extendCollection(items, {
        with: [],
        matching: "channel",
      });

      expect(result).toEqual(items);
    });

    it("handles both collections empty", () => {
      const result = extendCollection([], {
        with: [],
        matching: "id",
      });

      expect(result).toEqual([]);
    });

    it("does not mutate original collections", () => {
      const original = [{ channel: "0.0.0160", diag: false }];
      const extension: SystemDevice[] = [
        {
          channel: "0.0.0160",
          active: true,
          deviceName: "dasda",
          type: "eckd",
          formatted: false,
          diag: true,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
        },
      ];

      extendCollection(original, {
        with: extension,
        matching: "channel",
      });

      expect(original).toEqual([{ channel: "0.0.0160", diag: false }]);
      expect(extension[0].deviceName).toBe("dasda");
    });

    it("handles numeric and string keys", () => {
      const items = [{ id: 1, value: "a" }];
      const extension = [{ id: 1, extra: "b" }];

      const result = extendCollection(items, {
        with: extension,
        matching: "id",
      });

      expect(result[0]).toEqual({ id: 1, value: "a", extra: "b" });
    });
  });
});
