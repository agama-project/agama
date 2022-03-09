import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installerRender } from "./test-utils";
import Overview from "./Overview";
import InstallerClient from "./lib/client";

jest.mock("./lib/client");

const proposal = {
  candidateDevices: ["/dev/sda"],
  availableDevices: ["/dev/sda", "/dev/sdb"],
  lvm: false
};
const actions = [{ text: "Mount /dev/sda1 as root", subvol: false }];
const languages = [{ id: "en_US", name: "English" }];
const products = [{ id: "openSUSE", name: "openSUSE Tumbleweed" }];
const startInstallationFn = jest.fn();

beforeEach(() => {
  InstallerClient.mockImplementation(() => {
    return {
      storage: {
        getStorageProposal: () => Promise.resolve(proposal),
        getStorageActions: () => Promise.resolve(actions),
      },
      language: {
        getLanguages: () => Promise.resolve(languages),
        getSelectedLanguages: () => Promise.resolve(["en_US"]),
      },
      software: {
        getProducts: () => Promise.resolve(products),
        getSelectedProduct: () => Promise.resolve("openSUSE"),
      },
      onPropertyChanged: jest.fn(),
      startInstallation: startInstallationFn
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
