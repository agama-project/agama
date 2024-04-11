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

import { HTTPClient } from "./http";
import { UsersClient } from "./users";

const mockJsonFn = jest.fn();

const mockGetFn = jest.fn().mockImplementation(() => {
  return {
    ok: true,
    json: mockJsonFn,
  };
});

const mockPutFn = jest.fn().mockImplementation(() => {
  return {
    ok: true,
  };
});

const mockDeleteFn = jest.fn().mockImplementation(() => {
  return {
    ok: true,
  };
});

const mockPatchFn = jest.fn().mockImplementation(() => {
  return {
    ok: true,
  };
});

jest.mock("./http", () => {
  return {
    HTTPClient: jest.fn().mockImplementation(() => {
      return {
        get: mockGetFn,
        put: mockPutFn,
        delete: mockDeleteFn,
        patch: mockPatchFn,
      };
    }),
  };
});

const firstUser = {
  fullName: "Jane Doe",
  userName: "jane",
  password: "12345",
  autologin: false,
  data: {}
};
const rootSSHKey = "ssh-key";

describe("#getUser", () => {
  it("returns the defined first user", async () => {
    const http = new HTTPClient(new URL("http://localhost"));
    const client = new UsersClient(http);
    mockJsonFn.mockResolvedValue(firstUser);
    const user = await client.getUser();
    expect(user).toEqual({
      fullName: "Jane Doe",
      userName: "jane",
      password: "12345",
      autologin: false,
      data: {},
    });
  });
});

describe("#isRootPasswordSet", () => {
  describe("when the root password is set", () => {
    it("returns true", async () => {
      const http = new HTTPClient(new URL("http://localhost"));
      const client = new UsersClient(http);
      mockJsonFn.mockResolvedValue({ password: true });
      const result = await client.isRootPasswordSet();
      expect(result).toEqual(true);
    });
  });

  describe("when the root password is not set", () => {
    it("returns false", async () => {
      const http = new HTTPClient(new URL("http://localhost"));
      const client = new UsersClient(http);
      mockJsonFn.mockResolvedValue({ password: false });
      const result = await client.isRootPasswordSet();
      expect(result).toEqual(false);
    });
  });
});

describe("#getRootSSHKey", () => {
  it("returns the SSH key for the root user", async () => {
    const http = new HTTPClient(new URL("http://localhost"));
    const client = new UsersClient(http);
    mockJsonFn.mockResolvedValue({ sshkey: rootSSHKey });
    const result = await client.getRootSSHKey();
    expect(result).toEqual("ssh-key");
  });
});

describe("#setUser", () => {
  it("sets the values of the first user and returns whether succeeded or not an errors found", async () => {
    const http = new HTTPClient(new URL("http://localhost"));
    const client = new UsersClient(http);
    const result = await client.setUser({
      fullName: "Jane Doe",
      userName: "jane",
      password: "12345",
      autologin: false,
      data: []
    });

    expect(mockPutFn.mock.calls[0][1]).toEqual(
      {
        fullName: "Jane Doe",
        userName: "jane",
        password: "12345",
        autologin: false,
        data: []
      });
    expect(result).toEqual({ result: true, issues: [] });
  });

  describe("when setting the user fails because some issue", () => {
    it("returns an object with the result as false and the issues found", async () => {
      mockPutFn.mockImplementationOnce(() => { return { ok: false, } });
      const http = new HTTPClient(new URL("http://localhost"));
      const client = new UsersClient(http);
      const result = await client.setUser({
        fullName: "Jane Doe",
        userName: "jane",
        password: "12345",
        autologin: false,
        data: []
      });

      expect(result).toEqual({ result: false, issues: [] }); // TODO: test when we start detecting issues
    });
  });
});

describe("#removeUser", () => {
  it("removes the first user and returns true", async () => {
    const http = new HTTPClient(new URL("http://localhost"));
    const client = new UsersClient(http);
    client.removeUser();
    expect(mockDeleteFn).toHaveBeenCalled();
  });

  describe("when removing the user fails", () => {
    it("returns false", async () => {
      mockDeleteFn.mockImplementationOnce(() => { return { ok: false, } });
      const http = new HTTPClient(new URL("http://localhost"));
      const client = new UsersClient(http);
      const result = await client.removeUser();
      expect(result).toEqual(false);
    });
  });
});

describe("#setRootPassword", () => {
  it("sets the root password and returns true", async () => {
    const http = new HTTPClient(new URL("http://localhost"));
    const client = new UsersClient(http);
    const result = await client.setRootPassword("12345");
    expect(mockPatchFn.mock.calls[0][1]).toEqual({ password: "12345", password_encrypted: false });
    expect(result).toEqual(true);
  });

  describe("when setting the password fails", () => {
    it("returns false", async () => {
      mockPatchFn.mockImplementationOnce(() => { return { ok: false, } });
      const http = new HTTPClient(new URL("http://localhost"));
      const client = new UsersClient(http);
      const result = await client.setRootPassword("12345");
      expect(result).toEqual(false);
    });
  });
});

describe("#removeRootPassword", () => {
  it("removes the root password", async () => {
    const http = new HTTPClient(new URL("http://localhost"));
    const client = new UsersClient(http);
    const result = await client.removeRootPassword();
    expect(mockPatchFn.mock.calls[0][1]).toEqual({ password: "", password_encrypted: false });
    expect(result).toEqual(true);
  });

  describe("when setting the root password fails", () => {
    it("returns false", async () => {
      mockPatchFn.mockImplementationOnce(() => { return { ok: false, } });
      const http = new HTTPClient(new URL("http://localhost"));
      const client = new UsersClient(http);
      const result = await client.removeRootPassword();
      expect(result).toEqual(false);
    });
  });
});

describe("#setRootSSHKey", () => {
  it("sets the root SSH key and returns true", async () => {
    const http = new HTTPClient(new URL("http://localhost"));
    const client = new UsersClient(http);
    const result = await client.setRootSSHKey("ssh-key");
    expect(mockPatchFn.mock.calls[0][1]).toEqual({ sshkey: "ssh-key" });
    expect(result).toEqual(true);
  });

  describe("when setting the root SSH key fails", () => {
    it("returns false", async () => {
      mockPatchFn.mockImplementationOnce(() => { return { ok: false, } });
      const http = new HTTPClient(new URL("http://localhost"));
      const client = new UsersClient(http);
      const result = await client.setRootSSHKey("12345");
      expect(result).toEqual(false);
    });
  });
});
