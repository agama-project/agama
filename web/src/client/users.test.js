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
  return { ok: true, json: mockJsonFn };
});
const mockPatchFn = jest.fn().mockImplementation(() => {
  return { ok: true };
});
const mockPutFn = jest.fn().mockImplementation(() => {
  return { ok: true };
});
const mockDeleteFn = jest.fn().mockImplementation(() => {
  return { ok: true };
});

jest.mock("./http", () => {
  return {
    HTTPClient: jest.fn().mockImplementation(() => {
      return {
        get: mockGetFn,
        patch: mockPatchFn,
        put: mockPutFn,
        delete: mockDeleteFn,
      };
    }),
  };
});

let client;

const firstUser = {
  fullName: "Jane Doe",
  userName: "jane",
  password: "12345",
  autologin: false,
};

beforeEach(() => {
  client = new UsersClient(new HTTPClient(new URL("http://localhost")));
});

describe("#getUser", () => {
  beforeEach(() => {
    mockJsonFn.mockResolvedValue(firstUser);
  });

  it("returns the defined first user", async () => {
    const user = await client.getUser();
    expect(user).toEqual(firstUser);
    expect(mockGetFn).toHaveBeenCalledWith("/users/first");
  });
});

describe("#isRootPasswordSet", () => {
  describe("when the root password is set", () => {
    beforeEach(() => {
      mockJsonFn.mockResolvedValue({ password: true, sshkey: "" });
    });

    it("returns true", async () => {
      expect(await client.isRootPasswordSet()).toEqual(true);
      expect(mockGetFn).toHaveBeenCalledWith("/users/root");
    });
  });

  describe("when the root password is not set", () => {
    beforeEach(() => {
      mockJsonFn.mockResolvedValue({ password: false, sshkey: "" });
    });

    it("returns false", async () => {
      expect(await client.isRootPasswordSet()).toEqual(false);
      expect(mockGetFn).toHaveBeenCalledWith("/users/root");
    });
  });
});

describe("#getRootSSHKey", () => {
  beforeEach(() => {
    mockJsonFn.mockResolvedValue({ password: "", sshkey: "ssh-key" });
  });

  it("returns the SSH key for the root user", async () => {
    const result = expect(await client.getRootSSHKey()).toEqual("ssh-key");
    expect(mockGetFn).toHaveBeenCalledWith("/users/root");
  });
});

describe("#setUser", () => {
  it("sets the values of the first user and returns whether succeeded or not an errors found", async () => {
    const user = {
      fullName: "Jane Doe",
      userName: "jane",
      password: "12345",
      autologin: false,
    };
    const result = await client.setUser(user);
    expect(mockPutFn).toHaveBeenCalledWith("/users/first", user);
    expect(result);
  });

  describe("when setting the user fails because some issue", () => {
    beforeEach(() => {
      mockPutFn.mockResolvedValue({ ok: false });
    });

    // issues are not included in the response
    it.skip("returns an object with the result as false and the issues found", async () => {
      const result = await client.setUser({
        fullName: "Jane Doe",
        userName: "jane",
        password: "12345",
        autologin: false,
      });

      expect(mockPutFn).toHaveBeenCalledWith("/users/first");
      expect(result).toEqual({ result: false, issues: ["There is an error"] });
    });
  });
});

describe("#removeUser", () => {
  it("removes the first user and returns true", async () => {
    const result = await client.removeUser();
    expect(result).toEqual(true);
    expect(mockDeleteFn).toHaveBeenCalledWith("/users/first");
  });

  describe("when removing the user fails", () => {
    beforeEach(() => {
      mockDeleteFn.mockResolvedValue({ ok: false });
    });

    it("returns false", async () => {
      const result = await client.removeUser();
      expect(result).toEqual(false);
      expect(mockDeleteFn).toHaveBeenCalledWith("/users/first");
    });
  });
});

describe("#setRootPassword", () => {
  it("sets the root password and returns true", async () => {
    const result = await client.setRootPassword("12345");
    expect(mockPatchFn).toHaveBeenCalledWith("/users/root", {
      password: "12345",
      passwordEncrypted: false,
    });
    expect(result).toEqual(true);
  });

  describe("when setting the password fails", () => {
    beforeEach(() => {
      mockPatchFn.mockResolvedValue({ ok: false });
    });

    it("returns false", async () => {
      const result = await client.setRootPassword("12345");
      expect(mockPatchFn).toHaveBeenCalledWith("/users/root", {
        password: "12345",
        passwordEncrypted: false,
      });
      expect(result).toEqual(false);
    });
  });
});

describe("#removeRootPassword", () => {
  beforeEach(() => {
    mockPatchFn.mockResolvedValue({ ok: true });
  });

  it("removes the root password", async () => {
    const result = await client.removeRootPassword();
    expect(mockPatchFn).toHaveBeenCalledWith("/users/root", {
      password: "",
      passwordEncrypted: false,
    });
    expect(result).toEqual(true);
  });

  describe("when setting the user fails", () => {
    beforeEach(() => {
      mockPatchFn.mockResolvedValue({ ok: false });
    });

    it("returns false", async () => {
      const result = await client.removeRootPassword();
      expect(mockPatchFn).toHaveBeenCalledWith("/users/root", {
        password: "",
        passwordEncrypted: false,
      });
      expect(result).toEqual(false);
    });
  });
});

describe("#setRootSSHKey", () => {
  beforeEach(() => {
    mockPatchFn.mockResolvedValue({ ok: true });
  });

  it("sets the root password and returns true", async () => {
    const result = await client.setRootSSHKey("ssh-key");
    expect(mockPatchFn).toHaveBeenCalledWith("/users/root", { sshkey: "ssh-key" });
    expect(result).toEqual(true);
  });

  describe("when setting the user fails", () => {
    beforeEach(() => {
      mockPatchFn.mockResolvedValue({ ok: false });
    });

    it("returns false", async () => {
      const result = await client.setRootSSHKey("ssh-key");
      expect(mockPatchFn).toHaveBeenCalledWith("/users/root", { sshkey: "ssh-key" });
      expect(result).toEqual(false);
    });
  });
});
