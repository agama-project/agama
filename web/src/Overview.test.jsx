/*
 * Copyright (c) [2022] SUSE LLC
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
import { screen, waitFor, within } from "@testing-library/react";
import { installerRender } from "./test-utils";
import Overview from "./Overview";
import { createClient } from "./client";

let mockProduct;
let mockProducts = [
  { id: "openSUSE", name: "openSUSE Tumbleweed" },
  { id: "Leap Micro", name: "openSUSE Micro" }
];
const startInstallationFn = jest.fn();

jest.mock("./client");

jest.mock("./context/software", () => ({
  ...jest.requireActual("./context/software"),
  useSoftware: () => {
    return {
      products: mockProducts,
      selectedProduct: mockProduct
    };
  }
}));

jest.mock('react-router-dom', () => ({
  Outlet: () => <div>Content</div>,
  Navigate: () => <div>Navigate</div>,
  useNavigate: () => jest.fn()
}));

jest.mock("./LanguageSelector", () => () => "Language Selector");
jest.mock("./Storage", () => () => "Storage Configuration");
jest.mock("./Users", () => () => "Users Configuration");

beforeEach(() => {
  mockProduct = { id: "openSUSE", name: "openSUSE Tumbleweed" };
  createClient.mockImplementation(() => {
    return {
      software: {
        onProductChange: jest.fn()
      },
      manager: {
        startInstallation: startInstallationFn,
      }
    };
  });
});

test("includes an action for changing the selected product", async () => {
  installerRender(<Overview />);

  await screen.findByLabelText("Change selected product");
});

describe("when no product is selected", () => {
  beforeEach(() => {
    mockProduct = null;
  });

  it("redirects to the product selection page", async () => {
    installerRender(<Overview />);

    await screen.findByText("Navigate");
  });
});

describe("if there is only one product", () => {
  beforeEach(() => {
    mockProducts = [mockProduct];
  });

  it("does not show the action for changing the selected product", async () => {
    installerRender(<Overview />);

    await screen.findByText("openSUSE Tumbleweed");
    expect(screen.queryByLabelText("Change selected product")).not.toBeInTheDocument();
  });
});

test("renders the Overview", async () => {
  installerRender(<Overview />);
  const title = screen.getByText(/openSUSE Tumbleweed/i);
  expect(title).toBeInTheDocument();

  await screen.findByText("Language Selector");
  await screen.findByText("Storage Configuration");
  await screen.findByText("Users Configuration");
});

describe("when the user clicks 'Install'", () => {
  const prepareScenario = async () => {
    const { user } = installerRender(<Overview />);

    // TODO: we should have some UI element to tell the user we have finished
    // with loading data.
    await screen.findByText("Language Selector");

    await user.click(screen.getByRole("button", { name: /Install/ }));

    const dialog = await screen.findByRole("dialog");

    return {
      user,
      dialog
    };
  };

  it("asks for confirmation", async () => {
    const { dialog } = await prepareScenario();
    const title = within(dialog).getByText(/Confirm Installation/i);

    expect(title).toBeDefined();
  });

  it("starts the installation if the user confirms", async () => {
    const { dialog, user } = await prepareScenario();
    const button = within(dialog).getByRole("button", { name: /Install/i });
    await user.click(button);

    expect(startInstallationFn).toBeCalled();
  });

  it("does not start the installation if the user cancels", async () => {
    const { dialog, user } = await prepareScenario();
    const button = within(dialog).getByRole("button", { name: /Cancel/i });
    await user.click(button);

    expect(startInstallationFn).not.toBeCalled();

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
