/*
 * Copyright (c) [2024-2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

import React from "react";
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useSystem } from "~/hooks/model/system";
import { PRODUCT as PATHS } from "~/routes/paths";
import { Product } from "~/types/software";
import ChangeProductOption from "./ChangeProductOption";
import { System } from "~/model/system/network";

const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  icon: "tumbleweed.svg",
  description: "Tumbleweed description...",
  registration: false,
};
const microos: Product = {
  id: "MicroOS",
  name: "openSUSE MicroOS",
  icon: "MicroOS.svg",
  description: "MicroOS description",
  registration: false,
};

const network: System = {
  connections: [],
  devices: [],
  state: {
    connectivity: true,
    copyNetwork: true,
    networkingEnabled: true,
    wirelessEnabled: true,
  },
  accessPoints: [],
};

// let registrationInfoMock: RegistrationInfo;
const mockSystemProducts: jest.Mock<Product[]> = jest.fn();

jest.mock("~/hooks/api", () => ({
  ...jest.requireActual("~/hooks/api"),
  useSystem: (): ReturnType<typeof useSystem> => ({
    products: mockSystemProducts(),
    network,
  }),
}));

describe("ChangeProductOption", () => {
  describe("when there is more than one product available", () => {
    beforeEach(() => {
      mockSystemProducts.mockReturnValue([tumbleweed, microos]);
    });

    it("renders a menu item for navigating to product selection page", () => {
      installerRender(<ChangeProductOption />);
      const link = screen.getByRole("menuitem", { name: "Change product" });
      expect(link).toHaveAttribute("href", PATHS.changeProduct);
    });

    // FIXME: activate it again when registration is ready in api v2
    describe.skip("but a product is registered", () => {
      // beforeEach(() => {
      //   registrationInfoMock = {
      //     registered: true,
      //     key: "INTERNAL-USE-ONLY-1234-5678",
      //     email: "",
      //     url: "",
      //   };
      // });

      it("renders nothing", () => {
        const { container } = installerRender(<ChangeProductOption />);
        expect(container).toBeEmptyDOMElement();
      });
    });
  });

  describe("when there is only one product available", () => {
    beforeEach(() => {
      mockSystemProducts.mockReturnValue([tumbleweed]);
    });

    it("renders nothing", () => {
      const { container } = installerRender(<ChangeProductOption />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
