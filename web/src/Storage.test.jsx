import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installerRender } from "./test-utils";
import Storage from "./Storage";
import InstallerClient from "./lib/InstallerClient";

jest.mock("./lib/InstallerClient");

const initialProposal = [
  { mount: "/", type: "Btrfs", device: "/dev/sda1", size: 100000000 }
];

const disks = [{ name: "/dev/sda" }, { name: "/dev/sdb" }];

const clientMock = {
  getStorage: () => Promise.resolve(initialProposal),
  getDisks: () => Promise.resolve(disks),
  getOption: () => Promise.resolve("/dev/sda"),
  onPropertyChanged: jest.fn()
};

beforeEach(() => {
  InstallerClient.mockImplementation(() => clientMock);
});

it("displays the proposal", async () => {
  installerRender(<Storage />);
  await screen.findByText("/dev/sda1");
});

describe("when the user selects another disk", () => {
  let setOptionFn;

  beforeEach(() => {
    // if defined outside, the mock is cleared automatically
    setOptionFn = jest.fn().mockResolvedValue();
    InstallerClient.mockImplementation(() => {
      return {
        ...clientMock,
        setOption: setOptionFn
      };
    });
  });

  it("changes the selected disk", async () => {
    installerRender(<Storage />);
    const button = await screen.findByRole("button", { name: "/dev/sda" });
    userEvent.click(button);

    const targetSelector = await screen.findByLabelText("Select target");
    userEvent.selectOptions(targetSelector, ["/dev/sdb"]);
    userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByRole("button", { name: "/dev/sdb" });
    expect(setOptionFn).toHaveBeenCalledWith("Disk", "/dev/sdb");
  });
});

describe("when the proposal changes", () => {
  const callbacks = [];

  beforeEach(() => {
    const finalProposal = [
      { mount: "/", type: "Btrfs", device: "/dev/sdb1", size: 100000000 },
      { mount: "/home", type: "Ext4", device: "/dev/sdb2", size: 10000000000 }
    ];

    const getStorageFn = jest
      .fn()
      .mockResolvedValue(finalProposal) // default return value
      .mockResolvedValueOnce(initialProposal); // first call

    InstallerClient.mockImplementation(() => {
      return {
        ...clientMock,
        getStorage: getStorageFn,
        onPropertyChanged: cb => callbacks.push(cb)
      };
    });
  });

  it("updates the proposal", async () => {
    installerRender(<Storage />);
    await screen.findByText("/dev/sda1");

    const [cb] = callbacks;
    cb(
      "/org/openSUSE/YaST/Installer",
      "org.freedesktop.DBus.Properties",
      "PropertiesChanged",
      ["org.opensuse.YaST.Installer", { Disk: "/dev/sdb" }]
    );
    await screen.findByText("/dev/sdb1");
  });
});
