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

import AuthClient from "./auth";
import cockpit from "../lib/cockpit";

jest.mock("../lib/cockpit");

const dbusClient = {};

// at this time, it is undefined; but let's be prepared in case it changes
const unmockedFetch = window.fetch;
afterAll(() => {
  window.fetch = unmockedFetch;
});

describe("#authenticate", () => {
  it("resolves to true if the user was successfully authenticated", async () => {
    const client = new AuthClient(dbusClient);
    window.fetch = jest.fn().mockImplementation(() => Promise.resolve({ status: 200 }));
    client.authorize("linux", "password");
    expect(window.fetch).toHaveBeenCalledWith("/cockpit/login", {
      headers: {
        Authorization: "Basic bGludXg6cGFzc3dvcmQ=",
        "X-Superuser": "any"
      }
    });
  });

  it("resolves to false if the user was not authenticated", async () => {
    const client = new AuthClient(dbusClient);
    window.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        status: 401,
        statusText: "Password does not match"
      })
    );
    expect(client.authorize("linux", "password")).rejects.toBe("Password does not match");
  });
});

describe("#isLoggedIn", () => {
  beforeEach(() => {
    jest.spyOn(window, "fetch");
  });

  it("resolves to true if a user is logged in", async () => {
    const client = new AuthClient(dbusClient);
    window.fetch = jest.fn().mockImplementation(() => Promise.resolve({ status: 200 }));
    const logged = await client.isLoggedIn();
    expect(logged).toEqual(true);
    expect(window.fetch).toHaveBeenCalledWith("/cockpit/login");
  });

  it("resolves to false if a user was not logged in", async () => {
    const client = new AuthClient(dbusClient);
    window.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        status: 401,
        statusText: "Password does not match"
      })
    );
    const logged = await client.isLoggedIn();
    expect(logged).toEqual(false);
  });
});

describe("#currentUser", () => {
  beforeEach(() => {
    cockpit.user.mockResolvedValue("linux");
  });

  it("returns the user name from cockpit", async () => {
    const client = new AuthClient(dbusClient);
    const username = await client.currentUser();
    expect(username).toEqual("linux");
  });
});
