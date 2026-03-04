/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import { installerRender, mockStage } from "~/test-utils";
import { useSystem } from "~/hooks/model/system";
import { Product } from "~/model/system";
import { PRODUCT as PATHS } from "~/routes/paths";
import ChangeProductOption from "./ChangeProductOption";

const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  icon: "tumbleweed.svg",
  description: "Tumbleweed description...",
  registration: false,
  modes: [],
};

const microos: Product = {
  id: "MicroOS",
  name: "openSUSE MicroOS",
  icon: "MicroOS.svg",
  description: "MicroOS description",
  registration: false,
  modes: [],
};

const tumbleweedWithModes: Product = {
  ...tumbleweed,
  modes: [
    { id: "mode1", name: "Mode 1", description: "Mode 1 desc" },
    { id: "mode2", name: "Mode 2", description: "Mode 2 desc" },
  ],
};

const mockSystemProducts: jest.Mock<Product[]> = jest.fn();
const mockSoftware: jest.Mock = jest.fn();

jest.mock("~/hooks/model/system", () => ({
  ...jest.requireActual("~/hooks/model/system"),
  useSystem: (): ReturnType<typeof useSystem> => ({
    products: mockSystemProducts(),
    software: mockSoftware(),
  }),
}));

describe("ChangeProductOption", () => {
  beforeEach(() => {
    mockSoftware.mockReturnValue(null);
    mockStage("configuring");
  });

  describe("when there is more than one product available", () => {
    beforeEach(() => {
      mockSystemProducts.mockReturnValue([tumbleweed, microos]);
    });

    it("renders a link by default for navigating to product selection page", () => {
      installerRender(<ChangeProductOption />);
      const link = screen.getByRole("link", { name: "Change product" });
      expect(link).toHaveAttribute("href", PATHS.changeProduct);
    });

    it("renders a menu item when component prop is 'dropdownitem'", () => {
      installerRender(<ChangeProductOption component="dropdownitem" />);
      screen.getByRole("menuitem", { name: "Change product" });
    });

    it("renders with an icon when showIcon is true", () => {
      const { container } = installerRender(<ChangeProductOption showIcon />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("data-icon-name", "edit_square");
    });

    it("does not render an icon by default", () => {
      installerRender(<ChangeProductOption />);
      const link = screen.getByRole("link", { name: "Change product" });
      expect(link.querySelector("svg")).toBeNull();
    });

    describe("but a product is registered", () => {
      beforeEach(() => {
        mockSoftware.mockReturnValue({ registration: true });
      });

      it("renders nothing", () => {
        const { container } = installerRender(<ChangeProductOption />);
        expect(container).toBeEmptyDOMElement();
      });
    });

    describe("but the stage is not 'configuring'", () => {
      beforeEach(() => {
        mockStage("installing");
      });

      it("renders nothing", () => {
        const { container } = installerRender(<ChangeProductOption />);
        expect(container).toBeEmptyDOMElement();
      });
    });
  });

  describe("when there is only one product available", () => {
    describe("without modes", () => {
      beforeEach(() => {
        mockSystemProducts.mockReturnValue([tumbleweed]);
      });

      it("renders nothing", () => {
        const { container } = installerRender(<ChangeProductOption />);
        expect(container).toBeEmptyDOMElement();
      });
    });

    describe("with modes", () => {
      beforeEach(() => {
        mockSystemProducts.mockReturnValue([tumbleweedWithModes]);
      });

      it("renders with 'Change mode' label", () => {
        installerRender(<ChangeProductOption />);
        screen.getByRole("link", { name: "Change mode" });
      });
    });
  });

  describe("when there are multiple products and at least one has modes", () => {
    beforeEach(() => {
      mockSystemProducts.mockReturnValue([tumbleweedWithModes, microos]);
    });

    it("renders with 'Change product or mode' label", () => {
      installerRender(<ChangeProductOption />);
      screen.getByRole("link", { name: "Change product or mode" });
    });

    it("renders with icon when showIcon is true", () => {
      installerRender(<ChangeProductOption showIcon component="dropdownitem" />);
      screen.getByRole("menuitem", { name: /Change product or mode/ });
    });
  });
});
