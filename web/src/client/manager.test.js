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

import { HTTPClient } from "./http";
import { ManagerClient } from "./manager";
import cockpit from "../lib/cockpit";

const mockJsonFn = jest.fn();
const mockGetFn = jest.fn().mockImplementation(() => {
  return { ok: true, json: mockJsonFn };
});
const mockPostFn = jest.fn().mockImplementation(() => {
  return { ok: true };
});

jest.mock("./http", () => {
  return {
    HTTPClient: jest.fn().mockImplementation(() => {
      return {
        get: mockGetFn,
        post: mockPostFn,
      };
    }),
  };
});

let client;

beforeEach(() => {
  client = new ManagerClient(new HTTPClient(new URL("http://localhost")));
});

describe("#startProbing", () => {
  it("(re)starts the probing process", async () => {
    await client.startProbing();
    expect(mockPostFn).toHaveBeenCalledWith("/manager/probe", {});
  });
});

describe("#startInstallation", () => {
  it("starts the installation", async () => {
    await client.startInstallation();
    expect(mockPostFn).toHaveBeenCalledWith("/manager/install", {});
  });
});

describe("#rebootSystem", () => {
  beforeEach(() => {
    cockpit.spawn = jest.fn().mockResolvedValue(true);
  });

  it("returns whether the system reboot command was called or not", async () => {
    const reboot = await client.finishInstallation();
    expect(mockPostFn).toHaveBeenCalledWith("/manager/finish", {});
  });
});

describe.skip("#fetchLogs", () => {
  // beforeEach(() => {
  //   managerProxy.CollectLogs = jest.fn(() => "/tmp/y2log-hWBn95.tar.xz");
  //   cockpit.file = jest.fn(() => ({ read: () => "fake-binary-data" }));
  // });

  it("returns the logs file binary content", async () => {
    const logsContent = await client.fetchLogs();
    expect(logsContent).toEqual("fake-binary-data");
    expect(cockpit.file).toHaveBeenCalledWith("/tmp/y2log-hWBn95.tar.xz", { binary: true });
  });
});
