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

import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { createClient } from "~/client";
import { ChangeProductLink } from "~/components/software";

let mockProducts;

jest.mock("~/client");
jest.mock("~/context/software", () => ({
  ...jest.requireActual("~/context/software"),
  useSoftware: () => {
    return {
      products: mockProducts,
    };
  }
}));

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      software: {
        onProductChange: jest.fn()
      },
    };
  });
});

describe("ChangeProductLink", () => {
  describe("when there is only a single product", () => {
    beforeEach(() => {
      mockProducts = [
        { id: "openSUSE", name: "openSUSE Tumbleweed" }
      ];
    });

    it("renders nothing", async () => {
      installerRender(<ChangeProductLink />);

      const main = await screen.findByRole("main");
      await waitFor(() => expect(main).toBeEmptyDOMElement());
    });
  });

  describe("when there is more than one product", () => {
    beforeEach(() => {
      mockProducts = [
        { id: "openSUSE", name: "openSUSE Tumbleweed" },
        { id: "Leap Micro", name: "openSUSE Micro" }
      ];
    });

    it("renders a link for navigating to the selection product page", async () => {
      installerRender(<ChangeProductLink />);
      const link = await screen.findByRole("link", { name: "Change product" });

      expect(link).toHaveAttribute("href", "/products");
    });
  });
});
