/*
 * Copyright (c) [2023] SUSE LLC
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
import { ProductSection } from "~/components/overview";

let mockRegistration;
let mockSelectedProduct;

const mockIssue = { severity: "error", description: "Fake issue" };

jest.mock("~/client");

jest.mock("~/components/core/SectionSkeleton", () => () => <div>Loading</div>);

jest.mock("~/context/product", () => ({
  ...jest.requireActual("~/context/product"),
  useProduct: () => ({
    registration: mockRegistration,
    selectedProduct: mockSelectedProduct
  })
}));

beforeEach(() => {
  const issues = [mockIssue];
  mockRegistration = {};
  mockSelectedProduct = { name: "Test Product" };

  createClient.mockImplementation(() => {
    return {
      onConnect: jest.fn(),
      onDisconnect: jest.fn(),
      product: {
        getIssues: jest.fn().mockResolvedValue(issues),
        onIssuesChange: jest.fn()
      }
    };
  });
});

it("shows the product name", async () => {
  installerRender(<ProductSection />);

  await screen.findByText(/Test Product/);
  await waitFor(() => expect(screen.queryByText("registered")).not.toBeInTheDocument());
});

it("indicates whether the product is registered", async () => {
  mockRegistration = { code: "111222" };
  installerRender(<ProductSection />);

  await screen.findByText(/Test Product \(registered\)/);
});

it("shows the error", async () => {
  installerRender(<ProductSection />);

  await screen.findByText("Fake issue");
});

it("does not show warnings", async () => {
  mockIssue.severity = "warning";

  installerRender(<ProductSection />);

  await waitFor(() => expect(screen.queryByText("Fake issue")).not.toBeInTheDocument());
});

describe("when no product is selected", () => {
  beforeEach(() => {
    mockSelectedProduct = undefined;
  });

  it("shows the skeleton", async () => {
    installerRender(<ProductSection />);

    await screen.findByText("Loading");
  });

  it("does not show errors", async () => {
    installerRender(<ProductSection />);

    await waitFor(() => expect(screen.queryByText("Fake issue")).not.toBeInTheDocument());
  });
});
