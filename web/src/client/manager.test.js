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

import ManagerClient from "./manager";
import cockpit from "../lib/cockpit";

jest.mock("../lib/cockpit");

const MANAGER_IFACE = "org.opensuse.DInstaller.Manager1";

const dbusClient = {};
let managerProxy = {
  wait: jest.fn(),
  Commit: jest.fn(),
  Probe: jest.fn(),
  Status: 2
};

beforeEach(() => {
  dbusClient.proxy = jest.fn().mockImplementation(iface => {
    if (iface == MANAGER_IFACE) return managerProxy;
  });
});

describe("#getStatus", () => {
  it("returns the installer status", async () => {
    const client = new ManagerClient(dbusClient);
    const status = await client.getStatus();
    expect(status).toEqual(2);
  });
});

describe("#startProbing", () => {
  it("(re)starts the probing process", async () => {
    const client = new ManagerClient(dbusClient);
    await client.startProbing();
    expect(managerProxy.Probe).toHaveBeenCalledWith();
  });
});

describe("#startInstallation", () => {
  it("starts the installation", async () => {
    const client = new ManagerClient(dbusClient);
    await client.startInstallation();
    expect(managerProxy.Commit).toHaveBeenCalledWith();
  });
});

describe("#rebootSystem", () => {
  beforeEach(() => {
    cockpit.spawn = jest.fn().mockResolvedValue(true);
  });

  it("returns whether the system reboot command was called or not", async () => {
    const client = new ManagerClient(dbusClient);
    const reboot = await client.rebootSystem();
    expect(cockpit.spawn).toHaveBeenCalledWith(["/usr/sbin/shutdown", "-r", "now"]);
    expect(reboot).toEqual(true);
  });
});
