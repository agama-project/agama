/*
 * Copyright (c) [2024-2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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
import BootSelection from "./BootSelection";
import { System } from "~/model/system";
import { Config } from "~/model/storage/model";
import { putStorageModel } from "~/api";

// FIXME: drop this mock once a better solution for dealing with
// ProductRegistrationAlert, which uses a query with suspense,
jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

const network = {
  connections: [],
  devices: [],
  state: {
    connectivity: true,
    copyNetwork: true,
    networkingEnabled: true,
    wirelessEnabled: true,
  },
  accessPoints: [],
};

const system = (): System => ({
  network,
  storage: {
    devices: [
      {
        sid: 1,
        class: "drive",
        name: "/dev/sda",
      },
      {
        sid: 2,
        class: "drive",
        name: "/dev/sdb",
      },
      {
        sid: 3,
        class: "drive",
        name: "/dev/sdc",
      },
    ],
    candidateDrives: [1, 2],
  },
});

const storageModel = (): Config => ({
  boot: {
    configure: true,
    device: {
      default: true,
      name: "/dev/sda",
    },
  },
});

const getSystem = jest.fn();
const getStorageModel = jest.fn();

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  getSystem: () => getSystem(),
  getStorageModel: () => getStorageModel(),
  putStorageModel: jest.fn(),
}));

beforeEach(() => {
  getSystem.mockResolvedValue(system());
  getStorageModel.mockResolvedValue(storageModel());
});

describe("BootSelectionDialog", () => {
  const automaticOption = () => screen.getByRole("radio", { name: "Automatic" });
  const selectDiskOption = () => screen.getByRole("radio", { name: "Select a disk" });
  const notConfigureOption = () => screen.getByRole("radio", { name: "Do not configure" });
  const diskSelector = () => screen.getByRole("combobox", { name: /choose a disk/i });

  it("offers an option to configure boot in the installation disk", async () => {
    installerRender(<BootSelection />);
    await waitFor(() => {
      expect(automaticOption()).toBeInTheDocument();
    });
  });

  it("offers an option to configure boot in a selected disk", async () => {
    installerRender(<BootSelection />);
    await waitFor(() => {
      expect(selectDiskOption()).toBeInTheDocument();
      expect(diskSelector()).toBeInTheDocument();
    });
  });

  it("offers an option to not configure boot", async () => {
    installerRender(<BootSelection />);
    await waitFor(() => {
      expect(notConfigureOption()).toBeInTheDocument();
    });
  });

  describe("if the current value is set to boot from the installation disk", () => {
    it("selects 'Automatic' option by default", async () => {
      installerRender(<BootSelection />);
      await waitFor(() => {
        expect(automaticOption()).toBeChecked();
        expect(selectDiskOption()).not.toBeChecked();
        expect(diskSelector()).toBeDisabled();
        expect(notConfigureOption()).not.toBeChecked();
      });
    });
  });

  describe("if the current value is set to boot from a selected disk", () => {
    beforeEach(() => {
      const model = storageModel();
      model.boot.device.default = false;
      getStorageModel.mockResolvedValue(model);
    });

    it("selects 'Select a disk' option by default", async () => {
      installerRender(<BootSelection />);
      await waitFor(() => {
        expect(automaticOption()).not.toBeChecked();
        expect(selectDiskOption()).toBeChecked();
        expect(diskSelector()).toBeEnabled();
        expect(notConfigureOption()).not.toBeChecked();
      });
    });
  });

  describe("if the current value is set to not configure boot", () => {
    beforeEach(() => {
      const model = storageModel();
      model.boot.configure = false;
      getStorageModel.mockResolvedValue(model);
    });

    it("selects 'Do not configure' option by default", async () => {
      installerRender(<BootSelection />);
      await waitFor(() => {
        expect(automaticOption()).not.toBeChecked();
        expect(selectDiskOption()).not.toBeChecked();
        expect(diskSelector()).toBeDisabled();
        expect(notConfigureOption()).toBeChecked();
      });
    });
  });

  describe("if the current boot device is not a candidate device", () => {
    beforeEach(() => {
      const model = storageModel();
      model.boot.device.name = "/dev/sdc";
      model.drives = [{ name: "/dev/sdc" }];
      getStorageModel.mockResolvedValue(model);
    });

    it("offers the current boot device as an option", async () => {
      const { user } = installerRender(<BootSelection />);
      await waitFor(() => expect(diskSelector()).toBeInTheDocument());
      await user.click(selectDiskOption());
      const selector = diskSelector();
      within(selector).getByRole("option", { name: /sdc/ });
    });
  });

  it("does not change the boot options on cancel", async () => {
    const { user } = installerRender(<BootSelection />);
    await waitFor(() => expect(diskSelector()).toBeInTheDocument());
    const cancel = screen.getByRole("link", { name: "Cancel" });
    await user.click(cancel);
    expect(putStorageModel).not.toHaveBeenCalled();
  });

  it("applies the expected boot options when 'Automatic' is selected", async () => {
    const { user } = installerRender(<BootSelection />);
    await waitFor(() => expect(diskSelector()).toBeInTheDocument());
    await user.click(automaticOption());
    const accept = screen.getByRole("button", { name: "Accept" });
    await user.click(accept);
    expect(putStorageModel).toHaveBeenCalledWith(
      expect.objectContaining({
        boot: {
          configure: true,
          device: {
            default: true,
          },
        },
      }),
    );
  });

  it("applies the expected boot options when a disk is selected", async () => {
    const { user } = installerRender(<BootSelection />);
    await waitFor(() => expect(diskSelector()).toBeInTheDocument());
    await user.click(selectDiskOption());
    const selector = diskSelector();
    const sdbOption = within(selector).getByRole("option", { name: /sdb/ });
    await user.selectOptions(selector, sdbOption);
    const accept = screen.getByRole("button", { name: "Accept" });
    await user.click(accept);
    expect(putStorageModel).toHaveBeenCalledWith(
      expect.objectContaining({
        boot: {
          configure: true,
          device: {
            default: false,
            name: "/dev/sdb",
          },
        },
      }),
    );
  });

  it("applies the expected boot options when 'No configure' is selected", async () => {
    const { user } = installerRender(<BootSelection />);
    await waitFor(() => expect(diskSelector()).toBeInTheDocument());
    await user.click(notConfigureOption());
    const accept = screen.getByRole("button", { name: "Accept" });
    await user.click(accept);
    expect(putStorageModel).toHaveBeenCalledWith(
      expect.objectContaining({
        boot: {
          configure: false,
        },
      }),
    );
  });
});
