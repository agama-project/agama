/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { mockComponent, plainRender } from "~/test-utils";
import { ProposalSettingsSection } from "~/components/storage";

jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: mockComponent("PFSkeleton")
  };
});

let props;

const vda = {
  sid: "59",
  type: "disk",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  transport: "usb",
  dellBOSS: false,
  sdCard: true,
  active: true,
  name: "/dev/vda",
  size: 1024,
  systems : ["Windows", "openSUSE Leap 15.2"],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
  partitionTable: { type: "gpt", partitions: [] }
};

beforeEach(() => {
  props = {};
});

describe("Installation device field", () => {
  describe("if it is loading", () => {
    beforeEach(() => {
      props.isLoading = true;
    });

    describe("and there is no selected device yet", () => {
      beforeEach(() => {
        props.settings = { bootDevice: "" };
      });

      it("renders a message indicating that the device is not selected", () => {
        plainRender(<ProposalSettingsSection {...props} />);

        screen.getByText(/Installation device/);
        screen.getByText(/No device selected/);
      });
    });

    describe("and there is a selected device", () => {
      beforeEach(() => {
        props.settings = { bootDevice: "/dev/vda" };
      });

      it("renders the selected device", () => {
        plainRender(<ProposalSettingsSection {...props} />);

        screen.getByText(/Installation device/);
        screen.getByText("/dev/vda");
      });
    });
  });

  describe("if there is no selected device yet", () => {
    beforeEach(() => {
      props.settings = { bootDevice: "" };
    });

    it("renders a message indicating that the device is not selected", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      screen.getByText(/Installation device/);
      screen.getByText(/No device selected/);
    });
  });

  describe("if there is a selected device", () => {
    beforeEach(() => {
      props.settings = { bootDevice: "/dev/vda" };
    });

    it("renders the selected device", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      screen.getByText(/Installation device/);
      screen.getByText("/dev/vda");
    });
  });

  it("allows selecting a device when clicking on the device name", async () => {
    props = {
      availableDevices: [vda],
      settings: { bootDevice: "/dev/vda" },
      onChange: jest.fn()
    };

    const { user } = plainRender(<ProposalSettingsSection {...props} />);

    const button = screen.getByRole("button", { name: "/dev/vda, 1 KiB" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Installation device");

    const accept = within(popup).getByRole("button", { name: "Accept" });
    await user.click(accept);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(props.onChange).toHaveBeenCalled();
  });

  it("allows canceling the selection of the device", async () => {
    props = {
      availableDevices: [vda],
      settings: { bootDevice: "/dev/vda" },
      onChange: jest.fn()
    };

    const { user } = plainRender(<ProposalSettingsSection {...props} />);

    const button = screen.getByRole("button", { name: "/dev/vda, 1 KiB" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Installation device");

    const cancel = within(popup).getByRole("button", { name: "Cancel" });
    await user.click(cancel);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(props.onChange).not.toHaveBeenCalled();
  });
});

describe("LVM field", () => {
  describe("if LVM setting is not set yet", () => {
    beforeEach(() => {
      props.settings = { };
    });

    it("does not render the LVM switch", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      expect(screen.queryByLabelText(/Use logical volume/)).toBeNull();
    });
  });

  describe("if LVM setting is set", () => {
    beforeEach(() => {
      props.settings = { lvm: false };
    });

    it("renders the LVM switch", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      screen.getByRole("checkbox", { name: /Use logical volume/ });
    });
  });

  describe("if LVM is set to true", () => {
    beforeEach(() => {
      props.settings = { lvm: true };
      props.onChange = jest.fn();
    });

    it("renders the LVM switch as selected", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: /Use logical volume/ });
      expect(checkbox).toBeChecked();
    });

    it("changes the selection on click", async () => {
      const { user } = plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: /Use logical volume/ });
      await user.click(checkbox);

      expect(checkbox).not.toBeChecked();
      expect(props.onChange).toHaveBeenCalled();
    });
  });

  describe("if LVM is set to false", () => {
    beforeEach(() => {
      props.settings = { lvm: false };
      props.onChange = jest.fn();
    });

    it("renders the LVM switch as not selected", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: /Use logical volume/ });
      expect(checkbox).not.toBeChecked();
    });

    it("changes the selection on click", async () => {
      const { user } = plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: /Use logical volume/ });
      await user.click(checkbox);

      expect(checkbox).toBeChecked();
      expect(props.onChange).toHaveBeenCalled();
    });
  });
});

describe("Encryption field", () => {
  describe("if encryption password setting is not set yet", () => {
    beforeEach(() => {
      props.settings = { };
    });

    it("does not render the encryption switch", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      expect(screen.queryByLabelText("Use encryption")).toBeNull();
    });
  });

  describe("if encryption password setting is set", () => {
    beforeEach(() => {
      props.settings = { encryptionPassword: "" };
    });

    it("renders the encryption switch", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      screen.getByRole("checkbox", { name: "Use encryption" });
    });
  });

  describe("if encryption password is not empty", () => {
    beforeEach(() => {
      props.settings = { encryptionPassword: "1234" };
      props.onChange = jest.fn();
    });

    it("renders the encryption switch as selected", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: "Use encryption" });
      expect(checkbox).toBeChecked();
    });

    it("renders a button for changing the encryption settings", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      screen.getByRole("button", { name: /Encryption settings/ });
    });

    it("changes the selection on click", async () => {
      const { user } = plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: "Use encryption" });
      await user.click(checkbox);

      expect(checkbox).not.toBeChecked();
      expect(props.onChange).toHaveBeenCalled();
    });

    it("allows changing the encryption settings when clicking on the settings button", async () => {
      const { user } = plainRender(<ProposalSettingsSection {...props} />);

      const button = screen.getByRole("button", { name: /Encryption settings/ });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      screen.getByText("Encryption settings");

      const accept = within(popup).getByRole("button", { name: "Accept" });
      await user.click(accept);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(props.onChange).toHaveBeenCalled();
    });

    it("allows canceling the changes of the encryption settings", async () => {
      const { user } = plainRender(<ProposalSettingsSection {...props} />);

      const button = screen.getByRole("button", { name: /Encryption settings/ });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      screen.getByText("Encryption settings");

      const cancel = within(popup).getByRole("button", { name: "Cancel" });
      await user.click(cancel);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(props.onChange).not.toHaveBeenCalled();
    });
  });

  describe("if encryption password is empty", () => {
    beforeEach(() => {
      props.settings = { encryptionPassword: "" };
      props.onChange = jest.fn();
    });

    it("renders the encryption switch as not selected", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: "Use encryption" });
      expect(checkbox).not.toBeChecked();
    });

    it("does not render a button for changing the encryption settings", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      const button = screen.queryByRole("button", { name: /Encryption settings/ });
      expect(button).toBeNull();
    });

    it("changes the selection and allows changing the settings on click", async () => {
      const { user } = plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: "Use encryption" });
      await user.click(checkbox);

      const popup = await screen.findByRole("dialog");
      screen.getByText("Encryption settings");

      const passwordInput = screen.getByLabelText("Password");
      const passwordConfirmInput = screen.getByLabelText("Password confirmation");
      await user.type(passwordInput, "1234");
      await user.type(passwordConfirmInput, "1234");
      const accept = within(popup).getByRole("button", { name: "Accept" });
      await user.click(accept);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      expect(props.onChange).toHaveBeenCalled();
      expect(checkbox).toBeChecked();
    });

    it("does not select encryption if the settings are canceled", async () => {
      const { user } = plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: "Use encryption" });
      await user.click(checkbox);

      const popup = await screen.findByRole("dialog");
      screen.getByText("Encryption settings");

      const cancel = within(popup).getByRole("button", { name: "Cancel" });
      await user.click(cancel);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(props.onChange).not.toHaveBeenCalled();
      expect(checkbox).not.toBeChecked();
    });
  });
});
