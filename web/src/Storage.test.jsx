import React from "react";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installerRender } from "./test-utils";
import Storage from "./Storage";
import { createClient } from "./lib/client";

jest.mock("./lib/client");

const proposalSettings = {
  availableDevices: ["/dev/sda", "/dev/sdb"],
  candidateDevices: ["/dev/sda"],
  lvm: false
};

let onActionsChangedFn = jest.fn();
let calculateStorageProposalFn;

const storageMock = {
  getStorageProposal: () => Promise.resolve(proposalSettings),
  getStorageActions: () => Promise.resolve([{ text: "Mount /dev/sda1 as root", subvol: false }])
};

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      storage: {
        ...storageMock,
        calculateStorageProposal: calculateStorageProposalFn,
        onActionsChanged: onActionsChangedFn
      }
    };
  });
});

it("displays the proposal", async () => {
  installerRender(<Storage />);
  await screen.findByText("Mount /dev/sda1 as root");
});

describe("when the user selects another disk", () => {
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
  let callbacks;

  beforeEach(() => {
    callbacks = [];
    onActionsChangedFn = cb => callbacks.push(cb);
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
      cb({ All: [{ text: "Mount /dev/sdb1 as root", subvol: false }] });
    });
    await screen.findByText("Mount /dev/sdb1 as root");
  });
});
