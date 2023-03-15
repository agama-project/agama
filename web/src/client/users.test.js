/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import DBusClient from "./dbus";
import { UsersClient } from "./users";

jest.mock("./dbus");

const USERS_IFACE = "org.opensuse.DInstaller.Users1";

let setFirstUserResult = [true, []];

const usersProxy = {
  wait: jest.fn(),
  FirstUser: ["Jane Doe", "jane", "12345", false, {}],
  SetFirstUser: jest.fn().mockResolvedValue(setFirstUserResult),
  RemoveFirstUser: jest.fn().mockResolvedValue(0),
  SetRootPassword: jest.fn().mockResolvedValue(0),
  RemoveRootPassword: jest.fn().mockResolvedValue(0),
  RootPasswordSet: false,
  SetRootSSHKey: jest.fn().mockResolvedValue(0),
  RootSSHKey: "ssh-key"
};

beforeEach(() => {
  // @ts-ignore
  DBusClient.mockImplementation(() => {
    return {
      proxy: (iface) => {
        if (iface === USERS_IFACE) return usersProxy;
      }
    };
  });
});

describe("#getUser", () => {
  it("returns the defined first user", async () => {
    const client = new UsersClient();
    const user = await client.getUser();
    expect(user).toEqual({
      fullName: "Jane Doe",
      userName: "jane",
      password: "12345",
      autologin: false
    });
  });
});

describe("#isRootPasswordSet", () => {
  describe("when the root password is set", () => {
    beforeEach(() => {
      usersProxy.RootPasswordSet = true;
    });

    it("returns true", async () => {
      const client = new UsersClient();
      const result = await client.isRootPasswordSet();
      expect(result).toEqual(true);
    });
  });

  describe("when the root password is not set", () => {
    beforeEach(() => {
      usersProxy.RootPasswordSet = false;
    });

    it("returns false", async () => {
      const client = new UsersClient();
      const result = await client.isRootPasswordSet();
      expect(result).toEqual(false);
    });
  });
});

describe("#getRootSSHKey", () => {
  it("returns the SSH key for the root user", async () => {
    const client = new UsersClient();
    const result = await client.getRootSSHKey();
    expect(result).toEqual("ssh-key");
  });
});

describe("#setUser", () => {
  it("sets the values of the first user and returns whether succeeded or not an errors found", async () => {
    const client = new UsersClient();
    const result = await client.setUser({
      fullName: "Jane Doe",
      userName: "jane",
      password: "12345",
      autologin: false
    });

    expect(usersProxy.SetFirstUser).toHaveBeenCalledWith("Jane Doe", "jane", "12345", false, {});
    expect(result).toEqual({ result: true, issues: [] });
  });

  describe("when setting the user fails because some issue", () => {
    beforeEach(() => {
      setFirstUserResult = [false, ["There is an error"]];
      usersProxy.SetFirstUser = jest.fn().mockResolvedValue(setFirstUserResult);
    });

    it("returns an object with the result as false and the issues found", async () => {
      const client = new UsersClient();
      const result = await client.setUser({
        fullName: "Jane Doe",
        userName: "jane",
        password: "12345",
        autologin: false
      });

      expect(result).toEqual({ result: false, issues: ["There is an error"] });
    });
  });
});

describe("#removeUser", () => {
  it("removes the first user and returns true", async () => {
    const client = new UsersClient();
    const result = await client.removeUser();
    expect(usersProxy.RemoveFirstUser).toHaveBeenCalled();
    expect(result).toEqual(true);
  });

  describe("when removing the user fails", () => {
    beforeEach(() => (usersProxy.RemoveFirstUser = jest.fn().mockResolvedValue(1)));

    it("returns false", async () => {
      const client = new UsersClient();
      const result = await client.removeUser();
      expect(result).toEqual(false);
    });
  });
});

describe("#setRootPassword", () => {
  it("sets the root password and returns true", async () => {
    const client = new UsersClient();
    const result = await client.setRootPassword("12345");
    expect(usersProxy.SetRootPassword).toHaveBeenCalledWith("12345", false);
    expect(result).toEqual(true);
  });

  describe("when setting the password fails", () => {
    beforeEach(() => (usersProxy.SetRootPassword = jest.fn().mockResolvedValue(1)));

    it("returns false", async () => {
      const client = new UsersClient();
      const result = await client.setRootPassword("12345");
      expect(result).toEqual(false);
    });
  });
});

describe("#removeRootPassword", () => {
  it("removes the root password", async () => {
    const client = new UsersClient();
    const result = await client.removeRootPassword();
    expect(usersProxy.RemoveRootPassword).toHaveBeenCalled();
    expect(result).toEqual(true);
  });

  describe("when setting the user fails", () => {
    beforeEach(() => (usersProxy.RemoveRootPassword = jest.fn().mockResolvedValue(1)));

    it("returns false", async () => {
      const client = new UsersClient();
      const result = await client.removeRootPassword();
      expect(result).toEqual(false);
    });
  });
});

describe("#setRootSSHKey", () => {
  it("sets the root password and returns true", async () => {
    const client = new UsersClient();
    const result = await client.setRootSSHKey("ssh-key");
    expect(usersProxy.SetRootSSHKey).toHaveBeenCalledWith("ssh-key");
    expect(result).toEqual(true);
  });

  describe("when setting the user fails", () => {
    beforeEach(() => (usersProxy.SetRootSSHKey = jest.fn().mockResolvedValue(1)));

    it("returns false", async () => {
      const client = new UsersClient();
      const result = await client.setRootSSHKey("ssh-key");
      expect(result).toEqual(false);
    });
  });
});
