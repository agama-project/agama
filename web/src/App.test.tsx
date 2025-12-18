/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { createClient } from "~/client";
import { useExtendedConfig } from "~/hooks/model/config";
import { useStatus } from "~/hooks/model/status";
import { useSystem } from "~/hooks/model/system";
import { Product } from "~/types/software";
import { PATHS } from "~/router";
import { PRODUCT } from "~/routes/paths";
import type { Config } from "~/api";
import type { Progress, Stage } from "~/model/status";
import App from "./App";
import { System } from "~/model/system/network";

jest.mock("~/client");

const tumbleweed: Product = { id: "openSUSE", name: "openSUSE Tumbleweed", registration: false };
const microos: Product = { id: "Leap Micro", name: "openSUSE Micro", registration: false };
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
const mockProgresses: jest.Mock<Progress[]> = jest.fn();
const mockState: jest.Mock<Stage> = jest.fn();
const mockSelectedProduct: jest.Mock<Config["product"]> = jest.fn();

jest.mock("~/hooks/model/system", () => ({
  ...jest.requireActual("~/hooks/model/system"),
  useSystem: (): ReturnType<typeof useSystem> => ({
    products: [tumbleweed, microos],
    network,
  }),

  useStatus: (): ReturnType<typeof useStatus> => ({
    stage: mockState(),
    progresses: mockProgresses(),
  }),

  useExtendedConfig: (): ReturnType<typeof useExtendedConfig> => ({
    product: mockSelectedProduct(),
  }),
}));

// Mock some components,
// See https://www.chakshunyu.com/blog/how-to-mock-a-react-component-in-jest/#default-export
jest.mock("~/components/layout/Loading", () => () => <div>Loading Mock</div>);
jest.mock("~/components/product/ProductSelectionProgress", () => () => <div>Product progress</div>);

describe("App", () => {
  beforeEach(() => {
    // setting the language through a cookie
    document.cookie = "agamaLang=en-US; path=/;";
    (createClient as jest.Mock).mockImplementation(() => {
      return {
        onEvent: jest.fn(),
        isConnected: () => true,
      };
    });
    mockProgresses.mockReturnValue([]);
  });

  afterEach(() => {
    // setting a cookie with already expired date removes it
    document.cookie = "agamaLang=; path=/; expires=" + new Date(0).toUTCString();
  });

  describe("on the configuration phase with a product already selected", () => {
    beforeEach(() => {
      mockState.mockReturnValue("configuring");
      mockSelectedProduct.mockReturnValue({ id: tumbleweed.id });
    });

    it("renders the application content", async () => {
      installerRender(<App />);
      await screen.findByText(/Outlet Content/);
    });
  });

  describe("on the configuration phase without a product selected yet", () => {
    beforeEach(() => {
      mockState.mockReturnValue("configuring");
      mockSelectedProduct.mockReturnValue(undefined);
    });

    describe("if there is an ongoin progress", () => {
      beforeEach(() => {
        mockProgresses.mockReturnValue([
          { index: 1, scope: "software", size: 3, steps: ["one", "two", "three"], step: "two" },
        ]);
      });

      it("renders the application content", async () => {
        installerRender(<App />);
        await screen.findByText(/Outlet Content/);
      });
    });

    describe("if there is no progress", () => {
      beforeEach(() => {
        mockProgresses.mockReturnValue([]);
      });

      describe("and in the product selection already", () => {
        beforeEach(() => {
          mockRoutes(PRODUCT.root);
        });

        it("renders the application content", async () => {
          installerRender(<App />);
          await screen.findByText(/Outlet Content/);
        });
      });

      describe("and not in the product selection yet", () => {
        beforeEach(() => {
          mockRoutes(PATHS.root);
        });

        it("navigates to product selection", async () => {
          installerRender(<App />);
          await screen.findByText("Navigating to /products");
        });
      });
    });
  });

  describe("on the installation phase", () => {
    beforeEach(() => {
      mockState.mockReturnValue("installing");
    });

    it("navigates to installation progress", async () => {
      installerRender(<App />);
      await screen.findByText("Navigating to /installation/progress");
    });
  });

  describe("on the finish phase", () => {
    beforeEach(() => {
      mockState.mockReturnValue("finished");
    });

    it("navigates to installation finished", async () => {
      installerRender(<App />);
      await screen.findByText("Navigating to /installation/finished");
    });
  });
});
