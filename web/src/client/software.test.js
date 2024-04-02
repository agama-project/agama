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

jest.mock("./http", () => {
  return {
    HTTPClient: jest.fn().mockImplementation(() => {
      return {
        get: mockGetFn,
      };
    }),
  };
});

const mockGetFn = jest.fn();

jest.mock("./dbus");

const PRODUCT_IFACE = "org.opensuse.Agama.Software1.Product";
const REGISTRATION_IFACE = "org.opensuse.Agama1.Registration";

const productProxy = {
  wait: jest.fn(),
  AvailableProducts: [
    ["MicroOS", "openSUSE MicroOS", {}],
    ["Tumbleweed", "openSUSE Tumbleweed", {}],
  ],
  SelectedProduct: "MicroOS",
};

const registrationProxy = {};

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

beforeEach(() => {
  // @ts-ignore
  DBusClient.mockImplementation(() => {
    return {
      proxy: (iface) => {
        if (iface === PRODUCT_IFACE) return productProxy;
        if (iface === REGISTRATION_IFACE) return registrationProxy;
      },
    };
  });
});

describe("ProductClient", () => {
  describe("#getAll", () => {
    it.only("returns the list of available products", async () => {
      const http = new HTTPClient(new URL("http://localhost"));
      const client = new ProductClient(http);
      mockGetFn.mockResolvedValue([tumbleweed, microos]);
      const products = await client.getAll();
      expect(products).toEqual([
        { id: "Tumbleweed", name: "openSUSE Tumbleweed", description: "Tumbleweed is..." },
        { id: "MicroOS", name: "openSUSE MicroOS", description: "MicroOS is..." },
      ]);
    });
  });

  describe("#getSelected", () => {
    it.only("returns the selected product", async () => {
      const http = new HTTPClient(new URL("http://localhost"));
      const client = new ProductClient(http);
      mockGetFn.mockResolvedValue({ product: "microos" });
      const selected = await client.getSelected();
      expect(selected).toEqual("microos");
    });
  });

  describe("#getRegistration", () => {
    describe("if the product is not registered yet", () => {
      beforeEach(() => {
        registrationProxy.RegCode = "";
        registrationProxy.Email = "";
        registrationProxy.Requirement = 1;
      });

      it("returns the expected registration result", async () => {
        const client = new SoftwareClient();
        const registration = await client.product.getRegistration();
        expect(registration).toStrictEqual({
          code: null,
          email: null,
          requirement: "optional",
        });
      });
    });

    describe("if the product is registered", () => {
      beforeEach(() => {
        registrationProxy.RegCode = "111222";
        registrationProxy.Email = "test@test.com";
        registrationProxy.Requirement = 2;
      });

      it("returns the expected registration", async () => {
        const client = new SoftwareClient();
        const registration = await client.product.getRegistration();
        expect(registration).toStrictEqual({
          code: "111222",
          email: "test@test.com",
          requirement: "mandatory",
        });
      });
    });
  });

  describe("#register", () => {
    beforeEach(() => {
      registrationProxy.Register = jest.fn().mockResolvedValue([0, ""]);
    });

    it("performs the expected D-Bus call", async () => {
      const client = new SoftwareClient();
      await client.product.register("111222", "test@test.com");
      expect(registrationProxy.Register).toHaveBeenCalledWith(
        "111222",
        { Email: { t: "s", v: "test@test.com" } },
      );
    });

    describe("when the action is correctly done", () => {
      beforeEach(() => {
        registrationProxy.Register = jest.fn().mockResolvedValue([0, ""]);
      });

      it("returns a successful result", async () => {
        const client = new SoftwareClient();
        const result = await client.product.register("111222", "test@test.com");
        expect(result).toStrictEqual({
          success: true,
          message: "",
        });
      });
    });

    describe("when the action fails", () => {
      beforeEach(() => {
        registrationProxy.Register = jest.fn().mockResolvedValue([1, "error message"]);
      });

      it("returns an unsuccessful result", async () => {
        const client = new SoftwareClient();
        const result = await client.product.register("111222", "test@test.com");
        expect(result).toStrictEqual({
          success: false,
          message: "error message",
        });
      });
    });
  });

  describe("#deregister", () => {
    describe("when the action is correctly done", () => {
      beforeEach(() => {
        registrationProxy.Deregister = jest.fn().mockResolvedValue([0, ""]);
      });

      it("returns a successful result", async () => {
        const client = new SoftwareClient();
        const result = await client.product.deregister();
        expect(result).toStrictEqual({
          success: true,
          message: "",
        });
      });
    });

    describe("when the action fails", () => {
      beforeEach(() => {
        registrationProxy.Deregister = jest.fn().mockResolvedValue([1, "error message"]);
      });

      it("returns an unsuccessful result", async () => {
        const client = new SoftwareClient();
        const result = await client.product.deregister();
        expect(result).toStrictEqual({
          success: false,
          message: "error message",
        });
      });
    });
  });
});
