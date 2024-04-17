/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { HTTPClient } from "./http";
import { ProductClient, SoftwareClient } from "./software";

const mockJsonFn = jest.fn();

const mockGetFn = jest.fn().mockImplementation(() => {
  return {
    ok: true,
    json: mockJsonFn,
  };
});

const mockPostFn = jest.fn().mockImplementation(() => {
  return {
    ok: true,
  };
});

const mockDeleteFn = jest.fn().mockImplementation(() => {
  return {
    ok: true,
  };
});

jest.mock("./http", () => {
  return {
    HTTPClient: jest.fn().mockImplementation(() => {
      return {
        get: mockGetFn,
        post: mockPostFn,
        delete: mockDeleteFn,
      };
    }),
  };
});

const PRODUCT_IFACE = "org.opensuse.Agama.Software1.Product";
const REGISTRATION_IFACE = "org.opensuse.Agama1.Registration";

const tumbleweed = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  description: "Tumbleweed is...",
};

const microos = {
  id: "MicroOS",
  name: "openSUSE MicroOS",
  description: "MicroOS is...",
};

describe("ProductClient", () => {
  describe("#getAll", () => {
    it("returns the list of available products", async () => {
      const http = new HTTPClient(new URL("http://localhost"));
      const client = new ProductClient(http);
      mockJsonFn.mockResolvedValue([tumbleweed, microos]);
      const products = await client.getAll();
      expect(products).toEqual([
        { id: "Tumbleweed", name: "openSUSE Tumbleweed", description: "Tumbleweed is..." },
        { id: "MicroOS", name: "openSUSE MicroOS", description: "MicroOS is..." },
      ]);
    });
  });

  describe("#getSelected", () => {
    it("returns the selected product", async () => {
      const http = new HTTPClient(new URL("http://localhost"));
      const client = new ProductClient(http);
      mockJsonFn.mockResolvedValue({ product: "microos" });
      const selected = await client.getSelected();
      expect(selected).toEqual("microos");
    });
  });

  describe("#getRegistration", () => {
    describe("if the product is not registered yet", () => {
      it("returns the expected registration result", async () => {
        mockJsonFn.mockResolvedValue({
          key: "",
          email: "",
          requirement: "Optional"
        });
        const http = new HTTPClient(new URL("http://localhost"));
        const client = new ProductClient(http);
        const registration = await client.getRegistration();
        expect(registration).toStrictEqual({
          code: null,
          email: null,
          requirement: "Optional",
        });
      });
    });

    describe("if the product is registered", () => {
      it("returns the expected registration", async () => {
        mockJsonFn.mockResolvedValue({
          key: "111222",
          email: "test@test.com",
          requirement: "Mandatory"
        });
        const http = new HTTPClient(new URL("http://localhost"));
        const client = new ProductClient(http);
        const registration = await client.getRegistration();
        expect(registration).toStrictEqual({
          code: "111222",
          email: "test@test.com",
          requirement: "Mandatory",
        });
      });
    });
  });

  describe("#register", () => {
    it("performs the backend call", async () => {
      const http = new HTTPClient(new URL("http://localhost"));
      const client = new ProductClient(http);
      await client.register("111222", "test@test.com");
      expect(mockPostFn).toHaveBeenCalledWith("/software/registration", {
        key: "111222",
        email: "test@test.com",
      });
    });

    describe("when the action is correctly done", () => {
      it("returns a successful result", async () => {
        const http = new HTTPClient(new URL("http://localhost"));
        const client = new ProductClient(http);
        const result = await client.register("111222", "test@test.com");
        expect(result).toStrictEqual({
          success: true,
          message: "",
        });
      });
    });

    describe("when the action fails", () => {
      it("returns an unsuccessful result", async () => {
        mockPostFn.mockImplementationOnce(() => {
          return { ok: false };
        });
        const http = new HTTPClient(new URL("http://localhost"));
        const client = new ProductClient(http);
        const result = await client.register("111222", "test@test.com");
        expect(result).toStrictEqual({
          success: false,
          message: "",
        });
      });
    });
  });

  describe("#deregister", () => {
    describe("when the action is correctly done", () => {
      it("returns a successful result", async () => {
        const http = new HTTPClient(new URL("http://localhost"));
        const client = new ProductClient(http);
        const result = await client.deregister();
        expect(result).toStrictEqual({
          success: true,
          message: "",
        });
      });
    });

    describe("when the action fails", () => {
      it("returns an unsuccessful result", async () => {
        mockDeleteFn.mockImplementationOnce(() => {
          return { ok: false };
        });
        const http = new HTTPClient(new URL("http://localhost"));
        const client = new ProductClient(http);
        const result = await client.deregister();
        expect(result).toStrictEqual({
          success: false,
          message: "",
        });
      });
    });
  });
});
