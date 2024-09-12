/*
 * Copyright (c) [2024] SUSE LLC
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

import { inactiveLuns } from "./zfcp";

import { ZFCPController, ZFCPDisk } from "~/types/zfcp";

const mockZFCPDisk: ZFCPDisk[] = [
  {
    name: "/dev/sda",
    channel: "0.0.fa00",
    wwpn: "0x500507630b181216",
    lun: "0x4020404900000000",
  },
  {
    name: "/dev/sdb",
    channel: "0.0.fc00",
    wwpn: "0x500507630b101216",
    lun: "0x0001000000000000",
  },
];

const mockZFCPControllers: ZFCPController[] = [
  {
    id: "1",
    channel: "0.0.fa00",
    lunScan: false,
    active: true,
    lunsMap: {
      "0x500507630b181216": ["0x4020404900000000"],
      "0x500507680d7e284a": [],
      "0x500507680d0e284a": [],
    },
  },
  {
    id: "2",
    channel: "0.0.fc00",
    lunScan: false,
    active: true,
    lunsMap: {
      "0x500507680d7e284b": [],
      "0x500507680d0e284b": [],
      "0x500507630b101216": ["0x0000000000000000", "0x0001000000000000"],
    },
  },
];

describe("#inactiveLuns", () => {
  it("returns a list with the luns which does not have an active disk", () => {
    expect(inactiveLuns(mockZFCPControllers, mockZFCPDisk)).toEqual([
      {
        channel: "0.0.fc00",
        wwpn: "0x500507630b101216",
        lun: "0x0000000000000000",
      },
    ]);
  });

  it("return an empty list with all the luns are active", () => {
    mockZFCPDisk.push({
      name: "/dev/sdb",
      channel: "0.0.fc00",
      wwpn: "0x500507630b101216",
      lun: "0x0000000000000000",
    });
    expect(inactiveLuns(mockZFCPControllers, mockZFCPDisk)).toEqual([]);
  });
});
