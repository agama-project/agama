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

import React from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import type { Storage } from "~/model/system";
import DeviceContent from "./DeviceContent";

const disk: Storage.Device = {
  sid: 1,
  class: "drive",
  name: "/dev/sda",
  description: "ACME Disk",
  drive: {
    model: "ACME",
    vendor: "",
    bus: "SATA",
    busId: "",
    transport: "",
    drivers: [],
    info: { boss: false, sdCard: false },
  },
  block: {
    start: 0,
    size: 512e9,
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

describe("DeviceContent", () => {
  it("renders the content description", () => {
    plainRender(<DeviceContent device={disk} />);
    screen.getByText("ACME Disk");
  });

  it("renders installed system names as labels", () => {
    const device: Storage.Device = {
      ...disk,
      block: { ...disk.block, systems: ["Windows 11", "openSUSE Leap 15.6"] },
    };
    plainRender(<DeviceContent device={device} />);
    screen.getByText("Windows 11");
    screen.getByText("openSUSE Leap 15.6");
  });

  it("renders filesystem labels", () => {
    const device: Storage.Device = {
      ...disk,
      filesystem: { sid: 100, type: "ext4", label: "root" },
    };
    plainRender(<DeviceContent device={device} />);
    screen.getByText("root");
  });
});
