/*
 * Copyright (c) [2022] SUSE LLC
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

// @ts-check

import { SecurityProtocols } from "~/types/network";
import {
  isValidIp,
  isValidIpPrefix,
  intToIPString,
  stringToIPInt,
  formatIp,
  ipPrefixFor,
  securityFromFlags,
} from "./network";

describe("#isValidIp", () => {
  it("returns true when the IP is valid", () => {
    expect(isValidIp("192.168.122.1")).toEqual(true);
    expect(isValidIp("10.0.0.1")).toEqual(true);
  });

  it("returns false when the IP is not valid", () => {
    expect(isValidIp("192.168.122.1/24")).toEqual(false);
    expect(isValidIp("not-an-ip")).toEqual(false);
  });
});

describe("#isValidIpPrefix", () => {
  it("returns true when it is a valid netmask or prefix", () => {
    expect(isValidIpPrefix("255.255.255.0")).toEqual(true);
    expect(isValidIpPrefix("24")).toEqual(true);
    // FIXME: this one is not a valid netmask
    expect(isValidIpPrefix("10.0.0.1")).toEqual(true);
  });

  it("returns false when it is not neither a valid netmask nor a network prefix", () => {
    expect(isValidIpPrefix("88")).toEqual(false);
    expect(isValidIpPrefix("not-an-netmask")).toEqual(false);
  });
});

describe("#ipPrefixFor", () => {
  it("returns the prefix as an integer for the given netmask or prefix", () => {
    expect(ipPrefixFor("255.255.0.0")).toEqual(16);
    expect(ipPrefixFor("24")).toEqual(24);
  });
});

describe("#intToIPString", () => {
  it("returns the IP as string", () => {
    expect(intToIPString(67305985)).toEqual("1.2.3.4");
  });
});

describe("#ip4_from_text", () => {
  it("returns the IP as network byte-order", () => {
    expect(stringToIPInt("1.2.3.4")).toEqual(67305985);
  });
});

describe("formatIp", () => {
  it("returns the given IPv4 address in the X.X.X.X/YY format", () => {
    expect(formatIp({ address: "1.2.3.4", prefix: 24 })).toEqual("1.2.3.4/24");
  });
});

describe("securityFromFlags", () => {
  it("returns an array with the supported security protocols", () => {
    expect(securityFromFlags(0, 0, 0)).toEqual([]);
    expect(securityFromFlags(3, 392, 0)).toEqual([SecurityProtocols.WPA]);
  })
});
