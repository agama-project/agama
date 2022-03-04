import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installerRender } from "./test-utils";
import ProductSelector from "./ProductSelector";
import InstallerClient from "./lib/InstallerClient";

jest.mock("./lib/InstallerClient");

const products = [
  { id: "openSUSE", name: "openSUSE Tumbleweed" },
  { id: "micro", name: "openSUSE MicroOS" }
];

const clientMock = {
  getProducts: () => Promise.resolve(products),
  getSelectedProduct: () => Promise.resolve("micro")
};

beforeEach(() => {
  InstallerClient.mockImplementation(() => clientMock);
});

it("displays the proposal", async () => {
  installerRender(<ProductSelector />);
  await screen.findByText("openSUSE MicroOS");
});

describe("when the user changes the product", () => {
  let selectProductFn;

  beforeEach(() => {
    // if defined outside, the mock is cleared automatically
    selectProductFn = jest.fn().mockResolvedValue();
    InstallerClient.mockImplementation(() => {
      return {
        ...clientMock,
        selectProduct: selectProductFn
      };
    });
  });

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
  });
});
