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
import DBusClient from "./dbus";
import cockpit from "../lib/cockpit";

jest.mock("../lib/cockpit");
jest.mock("./dbus");

const MANAGER_IFACE = "org.opensuse.Agama1.Manager";
const SERVICE_IFACE = "org.opensuse.Agama1.ServiceStatus";
const PROGRESS_IFACE = "org.opensuse.Agama1.Progress";

const managerProxy = {
  wait: jest.fn(),
  Commit: jest.fn(),
  Probe: jest.fn(),
  CanInstall: jest.fn(),
  CollectLogs: jest.fn(),
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
  // @ts-ignore
  DBusClient.mockImplementation(() => {
    return { proxy: (iface) => proxies[iface] };
  });
});

describe("#getStatus", () => {
  it("returns the installer status", async () => {
    const client = new ManagerClient();
    const status = await client.getStatus();
    expect(status).toEqual(0);
  });
});

describe("#getProgress", () => {
  it("returns the manager service progress", async () => {
    const client = new ManagerClient();
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
    const client = new ManagerClient();
    await client.startProbing();
    expect(managerProxy.Probe).toHaveBeenCalledWith();
  });
});

describe("#getPhase", () => {
  it("resolves to the current phase", () => {
    const client = new ManagerClient();
    const phase = client.getPhase();
    expect(phase).resolves.toEqual(0);
  });
});

describe("#startInstallation", () => {
  it("starts the installation", async () => {
    const client = new ManagerClient();
    await client.startInstallation();
    expect(managerProxy.Commit).toHaveBeenCalledWith();
  });
});

describe("#rebootSystem", () => {
  beforeEach(() => {
    cockpit.spawn = jest.fn().mockResolvedValue(true);
  });

  it("returns whether the system reboot command was called or not", async () => {
    const client = new ManagerClient();
    const reboot = await client.rebootSystem();
    expect(cockpit.spawn).toHaveBeenCalledWith(["/usr/sbin/shutdown", "-r", "now"]);
    expect(reboot).toEqual(true);
  });
});

describe("#canInstall", () => {
  describe("when the system can be installed", () => {
    beforeEach(() => {
      managerProxy.CanInstall = jest.fn().mockResolvedValue(true);
    });

    it("returns true", async () => {
      const client = new ManagerClient();
      const install = await client.canInstall();
      expect(install).toEqual(true);
    });
  });

  describe("when the system cannot be installed", () => {
    beforeEach(() => {
      managerProxy.CanInstall = jest.fn().mockResolvedValue(false);
    });

    it("returns false", async () => {
      const client = new ManagerClient();
      const install = await client.canInstall();
      expect(install).toEqual(false);
    });
  });
});

describe("#fetchLogs", () => {
  beforeEach(() => {
    managerProxy.CollectLogs = jest.fn(() => "/tmp/y2log-hWBn95.tar.xz");
    cockpit.file = jest.fn(() => ({ read: () => "fake-binary-data" }));
  });

  it("returns the logs file binary content", async () => {
    const client = new ManagerClient();
    const logsContent = await client.fetchLogs();
    expect(logsContent).toEqual("fake-binary-data");
    expect(cockpit.file).toHaveBeenCalledWith("/tmp/y2log-hWBn95.tar.xz", { binary: true });
  });
});
