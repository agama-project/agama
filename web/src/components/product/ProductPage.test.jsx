/*
 * Copyright (c) [2023-2024] SUSE LLC
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
import { screen, within } from "@testing-library/react";

import { BUSY } from "~/client/status";
import { installerRender } from "~/test-utils";
import { ProductPage } from "~/components/product";
import { createClient } from "~/client";

let mockManager;
let mockSoftware;
let mockProducts;
let mockProduct;
let mockRegistration;

const products = [
  {
    id: "Test-Product1",
    name: "Test Product1",
    description: "Test Product1 description"
  },
  {
    id: "Test-Product2",
    name: "Test Product2",
    description: "Test Product2 description"
  }
];

const selectedProduct = {
  id: "Test-Product1",
  name: "Test Product1",
  description: "Test Product1 description"
};

jest.mock("~/client");
jest.mock("~/context/product", () => ({
  ...jest.requireActual("~/context/product"),
  useProduct: () => ({ products: mockProducts, selectedProduct, registration: mockRegistration })
}));
jest.mock("~/components/core/Sidebar", () => () => <div>Agama sidebar</div>);

beforeEach(() => {
  mockManager = {
    startProbing: jest.fn(),
    getStatus: jest.fn().mockResolvedValue(),
    onStatusChange: jest.fn()
  };

  mockSoftware = {
    probe: jest.fn(),
    getStatus: jest.fn().mockResolvedValue(),
    onStatusChange: jest.fn(),
  };

  mockProduct = {
    getSelected: selectedProduct.id,
    select: jest.fn().mockResolvedValue(),
    onChange: jest.fn()
  };

  mockProducts = products;

  mockRegistration = {
    requirement: "not-required",
    code: null,
    email: null
  };

  createClient.mockImplementation(() => (
    {
      manager: mockManager,
      software: mockSoftware,
      product: mockProduct,
    }
  ));
});

it("renders the product name and description", async () => {
  installerRender(<ProductPage />);
  await screen.findByText("Test Product1");
  await screen.findByText("Test Product1 description");
});

it("shows a button to change the product", async () => {
  installerRender(<ProductPage />);
  await screen.findByRole("button", { name: "Change product" });
});

describe("if there is only a product", () => {
  beforeEach(() => {
    mockProducts = [products[0]];
  });

  it("does not show a button to change the product", async () => {
    installerRender(<ProductPage />);
    expect(screen.queryByRole("button", { name: "Change product" })).not.toBeInTheDocument();
  });
});

describe("if the product is already registered", () => {
  beforeEach(() => {
    mockRegistration = {
      requirement: "mandatory",
      code: "111222",
      email: "test@test.com"
    };
  });

  it("shows the information about the registration", async () => {
    installerRender(<ProductPage />);
    await screen.findByText("**1222");
    await screen.findByText("test@test.com");
  });
});

describe("if the product does not require registration", () => {
  beforeEach(() => {
    mockRegistration.requirement = "NotRequired";
  });

  it("does not show a button to register the product", async () => {
    installerRender(<ProductPage />);
    expect(screen.queryByRole("button", { name: "Register" })).not.toBeInTheDocument();
  });
});

describe("if the product requires registration", () => {
  beforeEach(() => {
    mockRegistration.requirement = "required";
  });

  describe("and the product is not registered yet", () => {
    beforeEach(() => {
      mockRegistration.code = null;
    });

    it("shows a button to register the product", async () => {
      installerRender(<ProductPage />);
      await screen.findByRole("button", { name: "Register" });
    });
  });

  describe("and the product is already registered", () => {
    beforeEach(() => {
      mockRegistration.code = "11112222";
    });

    it("shows a button to deregister the product", async () => {
      installerRender(<ProductPage />);
      await screen.findByRole("button", { name: "Deregister product" });
    });
  });
});

describe("when the services are busy", () => {
  beforeEach(() => {
    mockRegistration.requirement = "required";
    mockRegistration.code = null;
    mockSoftware.getStatus = jest.fn().mockResolvedValue(BUSY);
  });

  it("shows disabled buttons", async () => {
    installerRender(<ProductPage />);

    const selectButton = await screen.findByRole("button", { name: "Change product" });
    const registerButton = await screen.findByRole("button", { name: "Register" });

    expect(selectButton).toHaveAttribute("disabled");
    expect(registerButton).toHaveAttribute("disabled");
  });
});

describe("when the button for changing the product is clicked", () => {
  describe("and the product is not registered", () => {
    beforeEach(() => {
      mockRegistration.code = null;
    });

    it("opens a popup for selecting a new product", async () => {
      const { user } = installerRender(<ProductPage />);

      const button = screen.getByRole("button", { name: "Change product" });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      within(popup).getByText("Choose a product");
      within(popup).getByRole("row", { name: /Test Product1/ });
      const productOption = within(popup).getByRole("row", { name: /Test Product2/ });

      await user.click(productOption);
      const accept = within(popup).getByRole("button", { name: "Accept" });
      await user.click(accept);

      expect(mockProduct.select).toHaveBeenCalledWith("Test-Product2");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    describe("if the popup is canceled", () => {
      it("closes the popup without selecting a new product", async () => {
        const { user } = installerRender(<ProductPage />);

        const button = screen.getByRole("button", { name: "Change product" });
        await user.click(button);

        const popup = await screen.findByRole("dialog");
        const productOption = within(popup).getByRole("row", { name: /Test Product2/ });

        await user.click(productOption);
        const cancel = within(popup).getByRole("button", { name: "Cancel" });
        await user.click(cancel);

        expect(mockProduct.select).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("and the product is registered", () => {
    beforeEach(() => {
      mockRegistration.requirement = "mandatory";
      mockRegistration.code = "111222";
    });

    it("shows a warning", async () => {
      const { user } = installerRender(<ProductPage />);

      const button = screen.getByRole("button", { name: "Change product" });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      within(popup).getByText(/must be deregistered/);

      const accept = within(popup).getByRole("button", { name: "Close" });
      await user.click(accept);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

describe("when the button for registering the product is clicked", () => {
  beforeEach(() => {
    mockRegistration.requirement = "mandatory";
    mockRegistration.code = null;
    mockProduct.register = jest.fn().mockResolvedValue({ success: true });
  });

  it("opens a popup for registering the product", async () => {
    const { user } = installerRender(<ProductPage />);

    const button = screen.getByRole("button", { name: "Register" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Register Test Product1");
    const codeInput = within(popup).getByLabelText(/Registration code/);
    const emailInput = within(popup).getByLabelText("Email");

    await user.type(codeInput, "111222");
    await user.type(emailInput, "test@test.com");
    const accept = within(popup).getByRole("button", { name: "Accept" });
    await user.click(accept);

    expect(mockProduct.register).toHaveBeenCalledWith("111222", "test@test.com");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  describe("if the popup is canceled", () => {
    it("closes the popup without registering the product", async () => {
      const { user } = installerRender(<ProductPage />);

      const button = screen.getByRole("button", { name: "Register" });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      const cancel = within(popup).getByRole("button", { name: "Cancel" });
      await user.click(cancel);

      expect(mockProduct.register).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("if there is an error registering the product", () => {
    beforeEach(() => {
      mockProduct.register = jest.fn().mockResolvedValue({
        success: false,
        message: "Error registering product"
      });
    });

    it("does not close the popup and shows the error", async () => {
      const { user } = installerRender(<ProductPage />);

      const button = screen.getByRole("button", { name: "Register" });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      within(popup).getByText("Register Test Product1");
      const codeInput = within(popup).getByLabelText(/Registration code/);

      await user.type(codeInput, "111222");
      const accept = within(popup).getByRole("button", { name: "Accept" });
      await user.click(accept);

      within(popup).getByText("Error registering product");
    });
  });
});

describe("when the button to perform product de-registration is clicked", () => {
  beforeEach(() => {
    mockRegistration.requirement = "mandatory";
    mockRegistration.code = "111222";
    mockProduct.deregister = jest.fn().mockResolvedValue({ success: true });
  });

  it("opens a popup to deregister the product", async () => {
    const { user } = installerRender(<ProductPage />);

    const button = screen.getByRole("button", { name: "Deregister product" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Deregister Test Product1");

    const accept = within(popup).getByRole("button", { name: "Accept" });
    await user.click(accept);

    expect(mockProduct.deregister).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  describe("if the popup is canceled", () => {
    it("closes the popup without performing product de-registration", async () => {
      const { user } = installerRender(<ProductPage />);

      const button = screen.getByRole("button", { name: "Deregister product" });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      const cancel = within(popup).getByRole("button", { name: "Cancel" });
      await user.click(cancel);

      expect(mockProduct.deregister).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("if there is an error performing the product de-registration", () => {
    beforeEach(() => {
      mockProduct.deregister = jest.fn().mockResolvedValue({
        success: false,
        message: "Product cannot be deregistered"
      });
    });

    it("does not close the popup and shows the error", async () => {
      const { user } = installerRender(<ProductPage />);

      const button = screen.getByRole("button", { name: "Deregister product" });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      const accept = within(popup).getByRole("button", { name: "Accept" });
      await user.click(accept);

      within(popup).getByText("Product cannot be deregistered");
    });
  });
});
