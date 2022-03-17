import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installerRender } from "./test-utils";
import Overview from "./Overview";
import { createClient } from "./lib/client";

jest.mock("./lib/client");

const proposal = {
  candidateDevices: ["/dev/sda"],
  availableDevices: [
    { id: "/dev/sda", label: "/dev/sda, 500 GiB" },
    { id: "/dev/sdb", label: "/dev/sdb, 650 GiB" }
  ],
  lvm: false
};
const actions = [{ text: "Mount /dev/sda1 as root", subvol: false }];
const languages = [{ id: "en_US", name: "English" }];
const products = [{ id: "openSUSE", name: "openSUSE Tumbleweed" }];
const startInstallationFn = jest.fn();

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      storage: {
        getStorageProposal: () => Promise.resolve(proposal),
        getStorageActions: () => Promise.resolve(actions),
        onActionsChange: jest.fn()
      },
      language: {
        getLanguages: () => Promise.resolve(languages),
        getSelectedLanguages: () => Promise.resolve(["en_US"])
      },
      software: {
        getProducts: () => Promise.resolve(products),
        getSelectedProduct: () => Promise.resolve("openSUSE")
      },
      manager: {
        startInstallation: startInstallationFn
      }
    };
  });
});

test("renders the Overview", async () => {
  installerRender(<Overview />);
  const title = screen.getByText(/Installation Summary/i);
  expect(title).toBeInTheDocument();

  await screen.findByText("English");
  await screen.findByText("/dev/sda");
  await screen.findByText("openSUSE Tumbleweed");
});

test("starts the installation when the user clicks 'Install'", async () => {
  installerRender(<Overview />);

  // TODO: we should have some UI element to tell the user we have finished
  // with loading data.
  await screen.findByText("English");

  userEvent.click(screen.getByRole("button", { name: /Install/ }));
  expect(startInstallationFn).toHaveBeenCalled();
});
