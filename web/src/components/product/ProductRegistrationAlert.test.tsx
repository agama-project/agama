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
import { installerRender, mockRoutes } from "~/test-utils";
import ProductRegistrationAlert from "./ProductRegistrationAlert";
import { Product } from "~/types/software";
import { useProduct } from "~/queries/software";
import { useScopeIssues } from "~/hooks/issues";
import { PRODUCT, REGISTRATION, ROOT } from "~/routes/paths";
import { Issue, IssueSeverity, IssueSource } from "~/api/issue";

const tw: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  registration: false,
};

const sle: Product = {
  id: "sle",
  name: "SLE",
  registration: true,
};

let selectedProduct: Product;

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useProduct: (): ReturnType<typeof useProduct> => {
    return {
      products: [tw, sle],
      selectedProduct,
    };
  },
}));

let issues: Issue[] = [];
const registrationIssue: Issue = {
  description: "Product must be registered",
  details: "",
  kind: "missing_registration",
  source: IssueSource.Unknown,
  severity: IssueSeverity.Warn,
  scope: "storage",
};

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useIssues: (): ReturnType<typeof useScopeIssues> => issues,
}));

const rendersNothingInSomePaths = () => {
  describe.each([
    ["login", ROOT.login],
    ["product selection", PRODUCT.changeProduct],
    ["product selection progress", PRODUCT.progress],
    ["installation progress", ROOT.installationProgress],
    ["installation finished", ROOT.installationFinished],
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
  describe("when the registration is missing", () => {
    beforeEach(() => {
      issues = [registrationIssue];
      selectedProduct = sle;
    });

    rendersNothingInSomePaths();

    it("renders an alert warning about registration required", () => {
      installerRender(<ProductRegistrationAlert />);
      screen.getByRole("heading", {
        name: /Warning alert:.*must be registered/,
      });
      const link = screen.getByRole("link");
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

  describe("when the registration is not needed", () => {
    beforeEach(() => {
      issues = [];
      selectedProduct = sle;
    });

    it("renders nothing", () => {
      const { container } = installerRender(<ProductRegistrationAlert />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
