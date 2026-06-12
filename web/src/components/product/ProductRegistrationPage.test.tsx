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
import { screen, within } from "@testing-library/react";
import { installerRender, mockProduct, mockProductConfig } from "~/test-utils";
import ProductRegistrationPage from "./ProductRegistrationPage";
import { Product } from "~/model/system";
import { RegistrationInfo, AddonInfo } from "~/model/system/software";
import { Config } from "~/model/config";
import { patchConfig } from "~/api";
import { Issue } from "~/model/issue";
import { cloneDeep } from "radashi";

const tw: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  registration: false,
  modes: [],
};

const sle: Product = {
  id: "sle",
  name: "SLE",
  registration: true,
  modes: [],
};

const addon: AddonInfo = {
  id: "sle-ha",
  version: "16.0",
  label: "SUSE Linux Enterprise High Availability Extension 16.0 x86_64 (BETA)",
  available: true,
  free: false,
  recommended: false,
  description: "SUSE Linux High Availability Extension provides...",
  release: "beta",
  registration: {
    status: "notRegistered",
  },
};

let mockSelectedProduct: Product | undefined;
let mockStaticHostname: string;
let mockRegistrationInfo: RegistrationInfo | undefined;
let mockConfig: Config;
let mockIssues: Issue[] = [];

jest.mock("~/hooks/model/system/software", () => ({
  useSystem: () => ({ registration: mockRegistrationInfo }),
}));

jest.mock("~/hooks/model/config", () => ({
  useConfig: () => mockConfig,
}));

jest.mock("~/hooks/model/issue", () => ({
  useIssues: () => mockIssues,
}));

jest.mock("~/api", () => ({
  patchConfig: jest.fn(),
}));

jest.mock("~/hooks/model/proposal", () => ({
  useProposal: () => ({
    hostname: { hostname: "testing-node", static: mockStaticHostname },
  }),
}));

describe("ProductRegistrationPage", () => {
  beforeEach(() => {
    mockConfig = { product: { id: "sle", mode: "standard", registrationCode: "" } };
    mockIssues = [];
    mockProductConfig(mockConfig.product);
    mockProduct(mockSelectedProduct);
  });

  describe("when the selected product is not registrable", () => {
    beforeEach(() => {
      mockSelectedProduct = tw;
      mockProduct(mockSelectedProduct);
      mockRegistrationInfo = undefined;
    });

    it("renders the registration page", () => {
      installerRender(<ProductRegistrationPage />);
      screen.getByText("Registration");
    });
  });

  describe("when the selected product is registrable and not yet registered", () => {
    beforeEach(() => {
      mockSelectedProduct = sle;
      mockProduct(mockSelectedProduct);
      mockRegistrationInfo = undefined;
    });

    describe("and the static hostname is not set", () => {
      it("renders a custom alert using the transient hostname", () => {
        installerRender(<ProductRegistrationPage />);

        screen.getByText("Hostname cannot be changed after registration");
        screen.getByText("Configured as", { exact: false });
        screen.getByText("testing-node");
        screen.getByRole("link", { name: "system" });
      });
    });

    describe("and the static hostname is set", () => {
      beforeEach(() => {
        mockStaticHostname = "testing-server";
      });

      it("renders a custom alert using the static hostname", () => {
        installerRender(<ProductRegistrationPage />);

        screen.getByText("Hostname cannot be changed after registration");
        screen.getByText("Configured as", { exact: false });
        screen.getByText("testing-server");
        screen.getByRole("link", { name: "system" });
      });
    });

    it("renders the registration form", () => {
      installerRender(<ProductRegistrationPage />);

      screen.getByRole("button", { name: "Register" });
    });
  });

  describe("when selected product is registrable and already registered", () => {
    beforeEach(() => {
      mockSelectedProduct = sle;
      mockProduct(mockSelectedProduct);
      mockRegistrationInfo = {
        code: "INTERNAL-USE-ONLY-1234-5678",
        email: "example@company.test",
        addons: [],
      };
    });

    it("does not render a custom alert about the hostname", () => {
      installerRender(<ProductRegistrationPage />);

      expect(screen.queryByText("Custom alert:")).toBeNull();
      expect(screen.queryByText(/hostname/)).toBeNull();
      expect(screen.queryByRole("link", { name: "system" })).toBeNull();
    });

    describe("if registered with the default server", () => {
      it("does not render the registration server information", () => {
        installerRender(<ProductRegistrationPage />);
        expect(screen.queryByText("Registration server")).toBeNull();
        expect(screen.queryByText("https://custom-server.test")).toBeNull();
      });
    });

    describe("if registered with a custom server", () => {
      beforeEach(() => {
        mockRegistrationInfo = {
          code: "INTERNAL-USE-ONLY-1234-5678",
          email: "example@company.test",
          url: "https://custom-server.test",
          addons: [],
        };
      });

      it("renders the registration server", () => {
        installerRender(<ProductRegistrationPage />);
        screen.getByText("Registration server");
        screen.getByText("https://custom-server.test");
      });
    });

    describe("if using a resgistration code", () => {
      it("renders the code partially hidden", async () => {
        const { user } = installerRender(<ProductRegistrationPage />);
        screen.getByText("Registration code");
        const visibilityCodeToggler = screen.getByRole("button", { name: "Show" });
        screen.getByText(/\*?5678/);
        expect(screen.queryByText("INTERNAL-USE-ONLY-1234-5678")).toBeNull();
        screen.getByText("example@company.test");
        await user.click(visibilityCodeToggler);
        screen.getByText("INTERNAL-USE-ONLY-1234-5678");
        await user.click(visibilityCodeToggler);
        expect(screen.queryByText("INTERNAL-USE-ONLY-1234-5678")).toBeNull();
        screen.getByText(/\*?5678/);
      });
    });

    describe("if not using a registration code", () => {
      beforeEach(() => {
        mockRegistrationInfo = {
          code: "",
          email: "",
          addons: [],
        };
      });

      it("does not render the code", async () => {
        installerRender(<ProductRegistrationPage />);
        expect(screen.queryByText("Registration code")).toBeNull();
      });
    });

    describe("if using an email", () => {
      it("renders the email", () => {
        installerRender(<ProductRegistrationPage />);
        screen.getByText("Email");
        screen.getByText("example@company.test");
      });
    });

    describe("if no email address is provided", () => {
      beforeEach(() => {
        mockRegistrationInfo = {
          code: "",
          email: "",
          addons: [],
        };
      });

      it("does not render the email", () => {
        installerRender(<ProductRegistrationPage />);
        expect(screen.queryByText("Email")).toBeNull();
        expect(screen.queryByText("example@company.test")).toBeNull();
      });
    });

    describe("when extensions are available", () => {
      beforeEach(() => {
        mockRegistrationInfo = {
          code: "INTERNAL-USE-ONLY-1234-5678",
          email: "example@company.test",
          addons: [addon],
        };
      });

      it("renders them", async () => {
        installerRender(<ProductRegistrationPage />);

        // heading without "BETA"
        const title = screen.getByRole("heading", {
          name: /SUSE Linux Enterprise High Availability Extension 16.0 x86_64/,
          level: 4,
        });
        const extensionNode = title.parentElement!;

        // description is displayed
        within(extensionNode).getByText(mockRegistrationInfo!.addons[0].description);

        // registration input field is displayed
        within(extensionNode).getByLabelText("Registration code");

        // submit button is displayed
        within(extensionNode).getByRole("button", { name: "Register" });
      });

      describe("and they are registered", () => {
        beforeEach(() => {
          const addons = cloneDeep(mockRegistrationInfo!.addons);
          addons[0].registration = { status: "registered", code: "INTERNAL-USE-ONLY-1234-ad42" };
          mockRegistrationInfo!.addons = addons;
        });

        it("renders them with its registration code partially hidden", async () => {
          const { user } = installerRender(<ProductRegistrationPage />);

          // the second "Show" button, the first one belongs to the base product registration code
          const visibilityCodeToggler = screen.getAllByRole("button", { name: "Show" })[1];
          expect(visibilityCodeToggler).not.toBeNull();

          // only the end of the code is displayed
          screen.getByText(/\*+ad42/);
          // not the full code
          expect(screen.queryByText("INTERNAL-USE-ONLY-1234-ad42")).toBeNull();

          // after pressing the "Show" button
          await user.click(visibilityCodeToggler);
          // the full code is visible
          screen.getByText("INTERNAL-USE-ONLY-1234-ad42");
        });
      });

      describe("and one of them is registered with an error", () => {
        beforeEach(() => {
          mockConfig = {
            product: {
              id: "sle",
              mode: "standard",
              registrationCode: "INTERNAL-USE-ONLY-1234-5678",
              addons: [
                {
                  id: "sle-ha",
                },
              ],
            },
          };

          mockIssues = [
            {
              scope: "product",
              class: "addon_registration_failed[sle-ha]",
              description: "Failed to register the add-on sle-ha",
              details: "No subscription with registration code 'jkljkljkl' found",
            },
          ];
        });

        it("allows forgetting the registration information", async () => {
          const { user } = installerRender(<ProductRegistrationPage />);

          const button = screen.getByRole("button", { name: "Do not register" });
          await user.click(button);
          expect(patchConfig).toHaveBeenCalledWith({
            ...mockConfig,
            product: {
              id: "sle",
              mode: "standard",
              registrationCode: "INTERNAL-USE-ONLY-1234-5678",
              registrationEmail: undefined,
              registrationUrl: undefined,
              addons: [],
            },
          });
        });
      });
    });
  });

  it("renders general issues alert", () => {
    mockSelectedProduct = sle;
    mockProduct(sle);
    mockRegistrationInfo = undefined;
    mockIssues = [
      {
        scope: "product",
        class: "system_registration_failed",
        description: "Failed to register",
      },
      {
        scope: "product",
        class: "some_other_issue",
        description: "Some other problem",
      },
    ];

    installerRender(<ProductRegistrationPage />);

    // General issues alert should show other issues
    screen.getByText("Some other problem");
  });

  it("hides hostname alert after failed registration attempt", () => {
    mockSelectedProduct = sle;
    mockProduct(sle);
    mockRegistrationInfo = undefined;
    mockIssues = [
      {
        scope: "product",
        class: "system_registration_failed",
        description: "Failed to register",
      },
    ];

    installerRender(<ProductRegistrationPage />);

    // Hostname alert should not be shown after registration attempt
    expect(screen.queryByText("Hostname cannot be changed after registration")).toBeNull();
  });
});
