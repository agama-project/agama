import React from "react";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installerRender } from "./test-utils";
import Storage from "./Storage";
import InstallerClient from "./lib/InstallerClient";

jest.mock("./lib/InstallerClient");

const proposalSettings = {
  availableDevices: ["/dev/sda", "/dev/sdb"],
  candidateDevices: ["/dev/sda"],
  lvm: false
};

const clientMock = {
  getStorageProposal: () => Promise.resolve(proposalSettings),
  getStorageActions: () => Promise.resolve([{ text: "Mount /dev/sda1 as root", subvol: false }]),
  onPropertyChanged: jest.fn()
};

beforeEach(() => {
  InstallerClient.mockImplementation(() => clientMock);
});

it("displays the proposal", async () => {
  installerRender(<Storage />);
  await screen.findByText("Mount /dev/sda1 as root");
});

describe("when the user selects another disk", () => {
  let calculateStorageProposalFn;

  beforeEach(() => {
    // if defined outside, the mock is cleared automatically
    InstallerClient.mockImplementation(() => {
      return {
        ...clientMock,
        calculateStorageProposal: calculateStorageProposalFn
      };
    });
  });

  it("changes the selected disk", async () => {
    calculateStorageProposalFn = jest.fn().mockResolvedValue(0);

    installerRender(<Storage />);
    const button = await screen.findByRole("button", { name: "/dev/sda" });
    userEvent.click(button);

    const targetSelector = await screen.findByLabelText("Select target");
    userEvent.selectOptions(targetSelector, ["/dev/sdb"]);
    userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByRole("button", { name: "/dev/sdb" });
    expect(calculateStorageProposalFn).toHaveBeenCalledWith({
      candidateDevices: ["/dev/sdb"]
    });
  });

  it("reports an error when the proposal is not possible", async () => {
    calculateStorageProposalFn = jest.fn().mockResolvedValue(1);

    installerRender(<Storage />);
    const button = await screen.findByRole("button", { name: "/dev/sda" });
    userEvent.click(button);

    const targetSelector = await screen.findByLabelText("Select target");
    userEvent.selectOptions(targetSelector, ["/dev/sdb"]);
    userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByRole("button", { name: "/dev/sdb" });
    await screen.findByText("Cannot make a proposal for /dev/sdb");
  });
});

describe("when the proposal changes", () => {
  const callbacks = [];

  beforeEach(() => {
    InstallerClient.mockImplementation(() => {
      return {
        ...clientMock,
        onPropertyChanged: cb => callbacks.push(cb)
      };
    });
  });

  it("updates the proposal", async () => {
    installerRender(<Storage />);
    await screen.findByText("Mount /dev/sda1 as root");

    const actions = [
      {
        t: "a{sv}",
        v: { Text: { t: "s", v: "Mount /dev/sdb1 as root" }, Subvol: { t: "b", v: false } }
      }
    ];
    const [cb] = callbacks;
    act(() => {
      cb(
        "/org/openSUSE/DInstaller/Storage/Actions1",
        "org.freedesktop.DBus.Properties",
        "PropertiesChanged",
        ["org.opensuse.DInstaller.Storage.Actions1", { All: { t: "av", v: actions } }]
      );
    });
    await screen.findByText("Mount /dev/sdb1 as root");
  });
});
