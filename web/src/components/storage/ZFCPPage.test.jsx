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
import { screen, waitFor, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { createClient } from "~/client";
import { ZFCPPage } from "~/components/storage";

jest.mock("~/client");
jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: () => <div>PFSkeleton</div>

  };
});

const controllers = [
  { id: "1", channel: "0.0.fa00", active: false, lunScan: false },
  { id: "2", channel: "0.0.fb00", active: true, lunScan: false }
];

const disks = [
  { id: "1", name: "/dev/sda", channel: "0.0.fb00", wwpn: "0x500507630703d3b3", lun: "0x0000000000000001" },
  { id: "2", name: "/dev/sdb", channel: "0.0.fb00", wwpn: "0x500507630703d3b3", lun: "0x0000000000000002" }
];

const defaultClient = {
  probe: jest.fn().mockResolvedValue(),
  getControllers: jest.fn().mockResolvedValue(controllers),
  getDisks: jest.fn().mockResolvedValue(disks),
  getWWPNs: jest.fn().mockResolvedValue([]),
  getLUNs: jest.fn().mockResolvedValue([]),
  onControllerChanged: jest.fn().mockResolvedValue(jest.fn()),
  onDiskAdded: jest.fn().mockResolvedValue(jest.fn()),
  onDiskChanged: jest.fn().mockResolvedValue(jest.fn()),
  onDiskRemoved: jest.fn().mockResolvedValue(jest.fn()),
  activateController: jest.fn().mockResolvedValue(0),
  getAllowLUNScan: jest.fn().mockResolvedValue(false),
  activateDisk: jest.fn().mockResolvedValue(0),
  deactivateDisk: jest.fn().mockResolvedValue(0)
};

let client;

beforeEach(() => {
  client = { ...defaultClient };
  createClient.mockImplementation(() => ({ storage: { zfcp: client } }));
});

it("renders two sections: Controllers and Disks", () => {
  installerRender(<ZFCPPage />);

  screen.findByRole("heading", { name: "Controllers" });
  screen.findByRole("heading", { name: "Disks" });
});

it.skip("loads the zFCP devices", async () => {
  client.getWWPNs = jest.fn().mockResolvedValue(["0x500507630703d3b3", "0x500507630704d3b3"]);
  installerRender(<ZFCPPage />);

  screen.getAllByText(/PFSkeleton/);
  expect(screen.queryAllByRole("grid").length).toBe(0);
  await waitFor(() => expect(client.probe).toHaveBeenCalled());
  await waitFor(() => expect(client.getLUNs).toHaveBeenCalledWith(controllers[1], "0x500507630703d3b3"));
  await waitFor(() => expect(client.getLUNs).toHaveBeenCalledWith(controllers[1], "0x500507630704d3b3"));
  await waitFor(() => expect(client.getLUNs).not.toHaveBeenCalledWith(controllers[0], "0x500507630703d3b3"));
  await waitFor(() => expect(client.getLUNs).not.toHaveBeenCalledWith(controllers[0], "0x500507630704d3b3"));
  expect(screen.getAllByRole("grid").length).toBe(2);
});

describe.skip("if allow-lun-scan is activated", () => {
  beforeEach(() => {
    client.getAllowLUNScan = jest.fn().mockResolvedValue(true);
  });

  it("renders an explanation about allow-lun-scan", async () => {
    installerRender(<ZFCPPage />);

    await screen.findByText(/automatically configures all its LUNs/);
  });
});

describe.skip("if allow-lun-scan is not activated", () => {
  beforeEach(() => {
    client.getAllowLUNScan = jest.fn().mockResolvedValue(false);
  });

  it("renders an explanation about not using allow-lun-scan", async () => {
    installerRender(<ZFCPPage />);

    await screen.findByText(/LUNs have to be manually configured/);
  });
});

describe.skip("if there are controllers", () => {
  it("renders the information for each controller", async () => {
    installerRender(<ZFCPPage />);

    await screen.findByRole("row", { name: "0.0.fa00 Deactivated -" });
    await screen.findByRole("row", { name: "0.0.fb00 Activated No" });
  });

  it("allows activating the controller", async () => {
    const { user } = installerRender(<ZFCPPage />);

    const row = await screen.findByRole("row", { name: /^0.0.fa00/ });
    const actions = within(row).getByRole("button", { name: "Actions" });
    await user.click(actions);
    const activate = within(row).getByRole("menuitem", { name: "Activate" });
    await user.click(activate);

    await waitFor(() => expect(client.activateController).toHaveBeenCalledWith(controllers[0]));
  });

  it("does not allow activating an already activated controller", async () => {
    installerRender(<ZFCPPage />);

    const row = await screen.findByRole("row", { name: /^0.0.fb00/ });
    await waitFor(() => expect(within(row).queryByRole("button", { name: "Actions" })).toBeNull());
  });
});

describe.skip("if there are not controllers", () => {
  beforeEach(() => {
    client.getControllers = jest.fn().mockResolvedValue([]);
  });

  it("does not render controllers information", async () => {
    installerRender(<ZFCPPage />);

    await waitFor(() => expect(screen.queryAllByRole("row", { name: /^0\.0\.f/ }).length).toBe(0));
  });

  it("renders a button for reading zFCP devices", async () => {
    installerRender(<ZFCPPage />);

    await screen.findByText("No zFCP controllers found.");
    await screen.findByRole("button", { name: /Read zFCP devices/ });
  });

  it("loads the zFCP devices if the button is clicked", async () => {
    const { user } = installerRender(<ZFCPPage />);

    const button = await screen.findByRole("button", { name: /Read zFCP devices/ });

    client.getControllers = jest.fn().mockResolvedValue(controllers);

    await user.click(button);
    await waitFor(() => expect(client.probe).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByRole("row", { name: /^0\.0\.f/ }).length).toBe(2));
    await waitFor(() => expect(screen.getAllByRole("row", { name: /^\/dev\// }).length).toBe(2));
  });
});

describe.skip("if there are disks", () => {
  beforeEach(() => {
    client.getWWPNs = jest.fn().mockResolvedValue(["0x500507630703d3b3"]);
    client.getLUNs = jest.fn().mockResolvedValue(
      ["0x0000000000000001", "0x0000000000000002", "0x0000000000000003"]
    );
  });

  it("renders the information for each disk", async () => {
    installerRender(<ZFCPPage />);

    await screen.findByRole("row", { name: "/dev/sda 0.0.fb00 0x500507630703d3b3 0x0000000000000001" });
    await screen.findByRole("row", { name: "/dev/sdb 0.0.fb00 0x500507630703d3b3 0x0000000000000002" });
  });

  it("renders a button for activating a disk", async () => {
    installerRender(<ZFCPPage />);

    const button = await screen.findByRole("button", { name: "Activate new disk" });
    expect(button).toBeEnabled();
  });

  describe("if there are not inactive LUNs", () => {
    beforeEach(() => {
      client.getWWPNs = jest.fn().mockResolvedValue(["0x500507630703d3b3"]);
      client.getLUNs = jest.fn().mockResolvedValue(["0x0000000000000001", "0x0000000000000002"]);
    });

    it("disables the button for activating a disk", async () => {
      installerRender(<ZFCPPage />);

      const button = await screen.findByRole("button", { name: "Activate new disk" });
      expect(button).toBeDisabled();
    });
  });

  describe("if the controller is not using auto LUN scan", () => {
    beforeEach(() => {
      client.getControllers = jest.fn().mockResolvedValue([
        { id: "1", channel: "0.0.fb00", active: true, lunScan: false }
      ]);
    });

    it("allows deactivating a disk", async () => {
      const { user } = installerRender(<ZFCPPage />);

      const row = await screen.findByRole("row", { name: /^\/dev\/sda/ });
      const actions = within(row).getByRole("button", { name: "Actions" });
      await user.click(actions);
      const deactivate = within(row).getByRole("menuitem", { name: "Deactivate" });
      await user.click(deactivate);

      const [controller] = await client.getControllers();
      const [disk] = await client.getDisks();

      await waitFor(() => expect(client.deactivateDisk).toHaveBeenCalledWith(controller, disk.wwpn, disk.lun));
    });
  });

  describe("if the controller is using auto LUN scan", () => {
    beforeEach(() => {
      client.getControllers = jest.fn().mockResolvedValue([
        { id: "1", channel: "0.0.fb00", active: true, lunScan: true }
      ]);
    });

    it("does not allow deactivating a disk", async () => {
      installerRender(<ZFCPPage />);

      const row = await screen.findByRole("row", { name: /^\/dev\/sda/ });
      waitFor(() => expect(within(row).queryByRole("button", { name: "Actions" })).toBeNull());
    });
  });
});

describe.skip("if there are not disks", () => {
  beforeEach(() => {
    client.getDisks = jest.fn().mockResolvedValue([]);
  });

  it("does not render disks information", async () => {
    installerRender(<ZFCPPage />);

    await waitFor(() => expect(screen.queryAllByRole("row", { name: /^\/dev\// }).length).toBe(0));
  });

  it("renders a button for activating a disk", async () => {
    installerRender(<ZFCPPage />);

    await screen.findByText("No zFCP disks found.");
    await screen.findByText(/try to activate a zFCP disk/);
    screen.findByRole("button", { name: "Activate zFCP disk" });
  });

  describe("and there is no active controller", () => {
    beforeEach(() => {
      client.getControllers = jest.fn().mockResolvedValue([controllers[0]]);
    });

    it("does not render a button for activating a disk", async () => {
      installerRender(<ZFCPPage />);

      await screen.findByText("No zFCP disks found.");
      await screen.findByText(/try to activate a zFCP controller/);
      await waitFor(() => expect(screen.queryByRole("button", { name: "Activate zFCP disk" })).toBeNull());
    });
  });
});

describe.skip("if the button for adding a disk is used", () => {
  beforeEach(() => {
    client.getWWPNs = jest.fn().mockResolvedValue(["0x500507630703d3b3"]);
    client.getLUNs = jest.fn().mockResolvedValue(
      ["0x0000000000000001", "0x0000000000000002", "0x0000000000000003"]
    );
  });

  it("opens a popup with the form for a new disk", async () => {
    const { user } = installerRender(<ZFCPPage />);

    const button = await screen.findByRole("button", { name: "Activate new disk" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Activate a zFCP disk");

    const form = screen.getByRole("form");
    within(form).getByRole("combobox", { name: "Channel ID" });
    within(form).getByRole("combobox", { name: "WWPN" });
    within(form).getByRole("combobox", { name: "LUN" });
  });

  it("only allows to select an active controller with inactive LUNs", async () => {
    const { user } = installerRender(<ZFCPPage />);

    const button = await screen.findByRole("button", { name: "Activate new disk" });
    await user.click(button);
    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Activate a zFCP disk");
    const form = screen.getByRole("form");

    const channelSelector = within(form).getByRole("combobox", { name: "Channel ID" });
    expect(within(channelSelector).getAllByRole("option").length).toBe(1);
    within(channelSelector).getByRole("option", { name: "0.0.fb00" });
  });

  it("submits the form if accept is clicked", async () => {
    const { user } = installerRender(<ZFCPPage />);

    const button = await screen.findByRole("button", { name: "Activate new disk" });
    await user.click(button);
    const popup = await screen.findByRole("dialog");

    const accept = await within(popup).findByRole("button", { name: "Accept" });
    await user.click(accept);

    expect(client.activateDisk).toHaveBeenCalledWith(
      controllers[1], "0x500507630703d3b3", "0x0000000000000003"
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the popup if cancel is clicked", async () => {
    const { user } = installerRender(<ZFCPPage />);

    const button = await screen.findByRole("button", { name: "Activate new disk" });
    await user.click(button);
    const popup = await screen.findByRole("dialog");

    const cancel = await within(popup).findByRole("button", { name: "Cancel" });
    await user.click(cancel);

    expect(client.activateDisk).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
