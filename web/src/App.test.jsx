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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";

import App from "./App";
import { createClient } from "~/client";
import { STARTUP, CONFIG, INSTALL } from "~/client/phase";
import { useL10nConfigChanges } from "./queries/l10n";
import { useProductChanges } from "./queries/software";
import { useIssuesChanges } from "./queries/issues";

jest.mock("~/client");

// list of available products
let mockProducts;
let mockSelectedProduct;

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useProduct: () => {
    return {
      products: mockProducts,
      selectedProduct: mockSelectedProduct,
    };
  },
  useProductChanges: () => jest.fn(),
}));

jest.mock("~/queries/l10n", () => ({
  ...jest.requireActual("~/queries/l10n"),
  useL10nConfigChanges: () => jest.fn(),
}));

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useIssuesChanges: () => jest.fn(),
}));

const mockClientStatus = {
  phase: STARTUP,
  isBusy: true,
};

jest.mock("~/queries/status", () => ({
  ...jest.requireActual("~/queries/status"),
  useInstallerStatus: () => mockClientStatus,
  useInstallerStatusChanges: () => jest.fn(),
}));

jest.mock("~/context/installer", () => ({
  ...jest.requireActual("~/context/installer"),
  useInstallerClientStatus: () => ({ connected: true, error: false }),
}));

// Mock some components,
// See https://www.chakshunyu.com/blog/how-to-mock-a-react-component-in-jest/#default-export
jest.mock("~/components/questions/Questions", () => () => <div>Questions Mock</div>);
jest.mock("~/components/core/Installation", () => () => <div>Installation Mock</div>);
jest.mock("~/components/layout/Loading", () => () => <div>Loading Mock</div>);
jest.mock("~/components/product/ProductSelectionProgress", () => () => <div>Product progress</div>);

describe("App", () => {
  beforeEach(() => {
    // setting the language through a cookie
    document.cookie = "agamaLang=en-us; path=/;";
    createClient.mockImplementation(() => {
      return {
        l10n: {
          getUIKeymap: jest.fn().mockResolvedValue("en"),
          getUILocale: jest.fn().mockResolvedValue("en_us"),
          setUILocale: jest.fn().mockResolvedValue("en_us"),
        },
      };
    });

    mockProducts = [
      { id: "openSUSE", name: "openSUSE Tumbleweed" },
      { id: "Leap Micro", name: "openSUSE Micro" },
    ];
  });

  afterEach(() => {
    // setting a cookie with already expired date removes it
    document.cookie = "agamaLang=; path=/; expires=" + new Date(0).toUTCString();
  });

  describe("when the software context is not initialized", () => {
    beforeEach(() => {
      mockProducts = undefined;
    });

    it("renders the Loading screen", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText("Loading Mock");
    });
  });

  describe("when the service is busy during startup", () => {
    beforeEach(() => {
      mockClientStatus.phase = STARTUP;
      mockClientStatus.isBusy = true;
    });

    it("renders the Loading screen", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText("Loading Mock");
    });
  });

  describe("on the CONFIG phase", () => {
    beforeEach(() => {
      mockClientStatus.phase = CONFIG;
    });

    describe("if the service is busy", () => {
      beforeEach(() => {
        mockClientStatus.isBusy = true;
        mockSelectedProduct = { id: "Tumbleweed" };
      });

      it("redirects to product selection progress", async () => {
        installerRender(<App />, { withL10n: true });
        await screen.findByText("Navigating to /products/progress");
      });
    });

    describe("if the service is not busy", () => {
      beforeEach(() => {
        mockClientStatus.isBusy = false;
      });

      it("renders the application content", async () => {
        installerRender(<App />, { withL10n: true });
        await screen.findByText(/Outlet Content/);
      });
    });
  });

  describe("on the INSTALL phase", () => {
    beforeEach(() => {
      mockClientStatus.phase = INSTALL;
      mockSelectedProduct = { id: "Fake product" };
    });

    it("renders the application content", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText("Installation Mock");
    });
  });
});
