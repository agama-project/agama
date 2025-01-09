/*
 * Copyright (c) [2024] SUSE LLC
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
import { installerRender, mockRoutes } from "~/test-utils";
import ProductRegistrationAlert from "./ProductRegistrationAlert";
import { Product, RegistrationInfo } from "~/types/software";
import { useProduct, useRegistration } from "~/queries/software";
import { PRODUCT, REGISTRATION, ROOT, USER } from "~/routes/paths";

jest.mock("~/components/core/ChangeProductLink", () => () => <div>ChangeProductLink Mock</div>);

const tw: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  registration: "no",
};

const sle: Product = {
  id: "sle",
  name: "SLE",
  registration: "mandatory",
};

let selectedProduct: Product;
let registrationInfoMock: RegistrationInfo;

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useRegistration: (): ReturnType<typeof useRegistration> => registrationInfoMock,
  useProduct: (): ReturnType<typeof useProduct> => {
    return {
      products: [tw, sle],
      selectedProduct,
    };
  },
}));

const rendersNothingInSomePaths = () => {
  describe.each([
    ["login", ROOT.login],
    ["product selection", PRODUCT.changeProduct],
    ["product selection progress", PRODUCT.progress],
    ["installation progress", ROOT.installationProgress],
    ["installation finished", ROOT.installationFinished],
    ["root authentication", USER.rootUser.edit],
  ])(`but at %s path`, (_, path) => {
    beforeEach(() => {
      mockRoutes(path);
    });

    it("renders nothing", () => {
      const { container } = installerRender(<ProductRegistrationAlert />);
      expect(container).toBeEmptyDOMElement();
    });
  });
};

describe("ProductRegistrationAlert", () => {
  describe("when product is registrable and registration code is not set", () => {
    beforeEach(() => {
      selectedProduct = sle;
      registrationInfoMock = { key: "", email: "" };
    });

    rendersNothingInSomePaths();

    it("renders an alert warning about registration required", () => {
      installerRender(<ProductRegistrationAlert />);
      screen.getByRole("heading", {
        name: /Warning alert:.*must be registered/,
      });
      const link = screen.getByRole("link", { name: "Register it now" });
      expect(link).toHaveAttribute("href", REGISTRATION.root);
    });

    describe("but at registration path already", () => {
      beforeEach(() => {
        mockRoutes(REGISTRATION.root);
      });

      it("does not render the link to registration", () => {
        installerRender(<ProductRegistrationAlert />);
        screen.getByRole("heading", {
          name: /Warning alert:.*must be registered/,
        });
        expect(screen.queryAllByRole("link")).toEqual([]);
      });
    });
  });

  describe("when product is registrable and registration code is already set", () => {
    beforeEach(() => {
      selectedProduct = sle;
      registrationInfoMock = { key: "INTERNAL-USE-ONLY-1234-5678", email: "" };
    });

    it("renders nothing", () => {
      const { container } = installerRender(<ProductRegistrationAlert />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when product is not registrable", () => {
    beforeEach(() => {
      selectedProduct = tw;
    });

    it("renders nothing", () => {
      const { container } = installerRender(<ProductRegistrationAlert />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
