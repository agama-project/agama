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

import { ManagerClient } from "./manager";
import { DBusClient } from "./dbus";
import cockpit from "../lib/cockpit";

jest.mock("../lib/cockpit");

const MANAGER_IFACE = "org.opensuse.DInstaller.Manager1";
const SERVICE_IFACE = "org.opensuse.DInstaller.ServiceStatus1";
const PROGRESS_IFACE = "org.opensuse.DInstaller.Progress1";

const dbusClient = new DBusClient("");
const managerProxy = {
  wait: jest.fn(),
  Commit: jest.fn(),
  Probe: jest.fn(),
  CurrentInstallationPhase: 0
};

const statusProxy = {
  wait: jest.fn(),
  Current: 0
};

const progressProxy = {
  wait: jest.fn(),
  CurrentStep: [2, "Installing software"],
  TotalSteps: 3,
  Finished: false
};

const proxies = {
  [MANAGER_IFACE]: managerProxy,
  [SERVICE_IFACE]: statusProxy,
  [PROGRESS_IFACE]: progressProxy
};

beforeEach(() => {
  dbusClient.proxy = jest.fn().mockImplementation(iface => {
    return proxies[iface];
  });
});

describe("#getStatus", () => {
  it("returns the installer status", async () => {
    const client = new ManagerClient(dbusClient);
    const status = await client.getStatus();
    expect(status).toEqual(0);
  });
});

describe("#getProgress", () => {
  it("returns the manager service progress", async () => {
    const client = new ManagerClient(dbusClient);
    const status = await client.getProgress();
    expect(status).toEqual({
      message: "Installing software",
      current: 2,
      total: 3,
      finished: false
    });
  });
});

describe("#startProbing", () => {
  it("(re)starts the probing process", async () => {
    const client = new ManagerClient(dbusClient);
    await client.startProbing();
    expect(managerProxy.Probe).toHaveBeenCalledWith();
  });
});

describe("#getPhase", () => {
  it("resolves to the current phase", () => {
    const client = new ManagerClient(dbusClient);
    const phase = client.getPhase();
    expect(phase).resolves.toEqual(0);
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
