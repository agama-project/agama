/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import App from "./App";
import { InstallationPhase } from "./types/status";
import { createClient } from "~/client";
import { Product } from "./types/software";
import { Issue, IssueSeverity, IssueSource, IssuesScope } from "./types/issues";
import { useIssues } from "./queries/issues";

jest.mock("~/client");

jest.mock("~/api/l10n", () => ({
  ...jest.requireActual("~/api/l10n"),
  fetchConfig: jest.fn().mockResolvedValue({
    uiKeymap: "en",
    uiLocale: "en_US",
  }),
  updateConfig: jest.fn(),
}));

const tumbleweed: Product = { id: "openSUSE", name: "openSUSE Tumbleweed" };
const microos: Product = { id: "Leap Micro", name: "openSUSE Micro" };

// list of available products
let mockProducts: Product[];
let mockSelectedProduct: Product;
let mockUserIssues: Issue[];

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
  useAllIssues: () => ({ isEmtpy: true }),
  useIssues: (component: IssuesScope) => mockUserIssues,
}));

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useDeprecatedChanges: () => jest.fn(),
}));

const mockClientStatus = {
  phase: InstallationPhase.Startup,
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
jest.mock("~/components/layout/Loading", () => () => <div>Loading Mock</div>);
jest.mock("~/components/product/ProductSelectionProgress", () => () => <div>Product progress</div>);

describe("App", () => {
  beforeEach(() => {
    // setting the language through a cookie
    document.cookie = "agamaLang=en-US; path=/;";
    (createClient as jest.Mock).mockImplementation(() => {
      return {};
    });

    mockProducts = [tumbleweed, microos];
    mockUserIssues = [];
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
      mockClientStatus.phase = InstallationPhase.Startup;
      mockClientStatus.isBusy = true;
    });

    it("renders the Loading screen", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText("Loading Mock");
    });
  });

  describe("on the configuration phase", () => {
    beforeEach(() => {
      mockClientStatus.phase = InstallationPhase.Config;
    });

    describe("if the service is busy", () => {
      beforeEach(() => {
        mockClientStatus.isBusy = true;
        mockSelectedProduct = tumbleweed;
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

      describe("if there is issues with users", () => {
        beforeEach(() => {
          mockUserIssues = [
            {
              description: "test",
              details: undefined,
              source: IssueSource.Config,
              severity: IssueSeverity.Error,
            },
          ];
        });

        it("redirects to user config page", async () => {
          installerRender(<App />, { withL10n: true });
          await screen.findByText("Navigating to /users");
        });
      });

      describe("if there are no issues with users", () => {
        it("renders the application content", async () => {
          installerRender(<App />, { withL10n: true });
          await screen.findByText(/Outlet Content/);
        });
      });
    });
  });

  describe("on the busy installaiton phase", () => {
    beforeEach(() => {
      mockClientStatus.phase = InstallationPhase.Install;
      mockClientStatus.isBusy = true;
      mockSelectedProduct = tumbleweed;
    });

    it("navigates to installation progress", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText("Navigating to /installation/progress");
    });
  });

  describe("on the idle installaiton phase", () => {
    beforeEach(() => {
      mockClientStatus.phase = InstallationPhase.Install;
      mockClientStatus.isBusy = false;
      mockSelectedProduct = tumbleweed;
    });

    it("navigates to installation finished", async () => {
      installerRender(<App />, { withL10n: true });
      await screen.findByText("Navigating to /installation/finished");
    });
  });
});
