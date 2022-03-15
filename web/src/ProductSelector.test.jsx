import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installerRender } from "./test-utils";
import ProductSelector from "./ProductSelector";
import { createClient } from "./lib/client";

jest.mock("./lib/client");

const products = [
  { id: "openSUSE", name: "openSUSE Tumbleweed" },
  { id: "micro", name: "openSUSE MicroOS" }
];

const softwareMock = {
  getProducts: () => Promise.resolve(products),
  getSelectedProduct: () => Promise.resolve("micro")
};

const selectProductFn = jest.fn().mockResolvedValue();

beforeEach(() => {
  // if defined outside, the mock is cleared automatically
  createClient.mockImplementation(() => {
    return {
      software: {
        ...softwareMock,
        selectProduct: selectProductFn
      }
    };
  });
});

it("displays the proposal", async () => {
  installerRender(<ProductSelector />);
  await screen.findByText("openSUSE MicroOS");
});

describe("when the user changes the product", () => {
  it("changes the selected product", async () => {
    installerRender(<ProductSelector />);
    const button = await screen.findByRole("button", {
      name: "openSUSE MicroOS"
    });
    userEvent.click(button);

    const productSelector = await screen.findByLabelText(/Select the product/);
    userEvent.selectOptions(productSelector, ["openSUSE Tumbleweed"]);
    userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByRole("button", { name: "openSUSE Tumbleweed" });
    expect(selectProductFn).toHaveBeenCalledWith("openSUSE");
    expect(selectProductFn).toHaveBeenCalledTimes(1);
  });
});
