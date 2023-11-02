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
import { SoftwareClient } from "./software";

jest.mock("./dbus");

const PRODUCT_IFACE = "org.opensuse.Agama.Software1.Product";
const REGISTRATION_IFACE = "org.opensuse.Agama1.Registration";

const productProxy = {
  wait: jest.fn(),
  AvailableProducts: [
    ["MicroOS", "openSUSE MicroOS", {}],
    ["Tumbleweed", "openSUSE Tumbleweed", {}]
  ],
  SelectedProduct: "MicroOS"
};

const registrationProxy = {};

beforeEach(() => {
  // @ts-ignore
  DBusClient.mockImplementation(() => {
    return {
      proxy: (iface) => {
        if (iface === PRODUCT_IFACE) return productProxy;
        if (iface === REGISTRATION_IFACE) return registrationProxy;
      }
    };
  });
});

describe("#product", () => {
  describe("#getAll", () => {
    it("returns the list of available products", async () => {
      const client = new SoftwareClient();
      const availableProducts = await client.product.getAll();
      expect(availableProducts).toEqual([
        { id: "MicroOS", name: "openSUSE MicroOS" },
        { id: "Tumbleweed", name: "openSUSE Tumbleweed" }
      ]);
    });
  });

  describe("#getSelected", () => {
    it("returns the selected product", async () => {
      const client = new SoftwareClient();
      const selectedProduct = await client.product.getSelected();
      expect(selectedProduct).toEqual(
        { id: "MicroOS", name: "openSUSE MicroOS" }
      );
    });
  });

  describe("#getRegistration", () => {
    describe("if there the product is not registered yet", () => {
      beforeEach(() => {
        registrationProxy.RegCode = "";
        registrationProxy.Email = "";
        registrationProxy.Requirement = 1;
      });

      it("returns the expected registration", async () => {
        const client = new SoftwareClient();
        const registration = await client.product.getRegistration();
        expect(registration).toStrictEqual({
          code: null,
          email: null,
          requirement: "optional"
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
          requirement: "mandatory"
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
        { Email: { t: "s", v: "test@test.com" } }
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
          message: ""
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
          message: "error message"
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
          message: ""
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
          message: "error message"
        });
      });
    });
  });
});
