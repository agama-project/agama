/*
 * Copyright (c) [2026] SUSE LLC
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
import { installerRender } from "~/test-utils";
import { useAppForm } from "~/hooks/form";
import { gib } from "~/components/storage/utils";
import { defaultOptions } from "./fields";
import { validate } from "./validations";
import TargetDevicesField from "./TargetDevicesField";

import type { Storage as System } from "~/model/system";

// The tables of the dialog show the content of each device, which looks for
// the devices of the system.
jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevices: () => [],
  useFlattenDevices: () => [],
}));

const sda: System.Device = {
  sid: 59,
  class: "drive",
  name: "/dev/sda",
  description: "SDA drive",
  drive: {
    type: "disk",
    model: "Micron 1100 SATA",
    vendor: "Micron",
    bus: "IDE",
    busId: "",
    transport: "usb",
    drivers: ["ahci", "mmcblk"],
    info: { boss: false, sdCard: true },
  },
  block: {
    start: 1,
    size: gib(20),
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

const sdb: System.Device = {
  sid: 60,
  class: "drive",
  name: "/dev/sdb",
  description: "SDB drive",
  drive: {
    type: "disk",
    model: "Samsung Evo 8 Pro",
    vendor: "Samsung",
    bus: "IDE",
    busId: "",
    transport: "",
    info: { boss: false, sdCard: false },
  },
  block: {
    start: 1,
    size: gib(10),
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

const md0: System.Device = {
  sid: 70,
  class: "mdRaid",
  name: "/dev/md0",
  description: "MD RAID 0",
  md: { level: "raid1", devices: [1, 2] },
  block: {
    start: 0,
    size: gib(5),
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

const onSubmitMock = jest.fn();

function TestForm({
  devices = [sda, sdb, md0],
  targetDevices = [],
}: {
  devices?: System.Device[];
  targetDevices?: string[];
}) {
  const form = useAppForm({
    ...defaultOptions,
    defaultValues: { ...defaultOptions.defaultValues, vgName: "system", targetDevices },
    // The real validator, so the message under the field is the one of the form.
    validators: { onSubmitAsync: async (ctx) => validate(ctx.value) },
    onSubmit: ({ value }) => onSubmitMock(value),
  });

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <TargetDevicesField form={form} devices={devices} />
        <button type="submit">Submit</button>
      </form>
    </form.AppForm>
  );
}

type User = ReturnType<typeof installerRender>["user"];

/** Opens the list of devices the field offers. */
const openList = async (user: User) =>
  user.click(screen.getByRole("button", { name: "Show options" }));

/** The open list of devices. */
const list = () => within(screen.getByRole("listbox", { name: "Disks" }));

/** The option offering a device in the open list. */
const deviceOption = (name: string | RegExp) => list().getByRole("option", { name });

/** The devices already chosen, which the field renders as a list of its own. */
const entriesList = () => screen.queryByRole("listbox", { name: "Disks entries" });

/** The entry for a device already chosen, if there is one. */
const entry = (name: string) => entriesList() && within(entriesList()).queryByText(name);

/** Opens the dialog listing the devices with their details. */
const openDialog = async (user: User) => {
  await openList(user);
  await user.click(list().getByRole("option", { name: /Browse with details/ }));
};

/** The open dialog. */
const dialog = () => within(screen.getByRole("dialog"));

/** The row of a device in the open dialog. */
const deviceRow = (name: string) => dialog().getByRole("row", { name: new RegExp(name) });

/** Picks or unpicks a device in the open dialog. */
const toggleDevice = async (user: User, name: string) =>
  user.click(within(deviceRow(name)).getByRole("checkbox"));

describe("TargetDevicesField", () => {
  beforeEach(() => {
    onSubmitMock.mockClear();
  });

  it("renders the disks field with its explanation", () => {
    installerRender(<TestForm />);
    screen.getByRole("combobox", { name: "Disks" });
    screen.getByText("LVM physical volumes will be added as partitions on the chosen disks.");
  });

  it("offers the drives and the RAID devices, with their size", async () => {
    const { user } = installerRender(<TestForm />);
    await openList(user);
    // The name of an option also carries its description
    deviceOption(/^sda \(20 GiB\)/);
    deviceOption(/^sdb \(10 GiB\)/);
    deviceOption(/^md0 \(5 GiB\)/);
  });

  // Every word in an option is read out with it, so the list says the least it
  // can get away with and the dialog says the rest.
  it("tells the devices apart by their type, and says no more in an option", async () => {
    const { user } = installerRender(<TestForm />);
    await openList(user);

    expect(deviceOption(/sda/)).toHaveTextContent("SD Card");
    expect(deviceOption(/md0/)).toHaveTextContent("Software RAID1");
    expect(deviceOption(/sda/)).not.toHaveTextContent("Micron 1100 SATA");
  });

  it("shows the devices already chosen", () => {
    installerRender(<TestForm targetDevices={["/dev/sda", "/dev/md0"]} />);
    expect(entry("sda (20 GiB)")).toBeInTheDocument();
    expect(entry("md0 (5 GiB)")).toBeInTheDocument();
    expect(entry("sdb (10 GiB)")).not.toBeInTheDocument();
  });

  it("finds a device by its name", async () => {
    const { user } = installerRender(<TestForm />);
    await user.type(screen.getByRole("combobox", { name: "Disks" }), "sdb");

    deviceOption(/sdb/);
    expect(list().queryByRole("option", { name: /sda/ })).not.toBeInTheDocument();
  });

  it("adds the devices chosen from the list", async () => {
    const { user } = installerRender(<TestForm />);
    await openList(user);
    await user.click(deviceOption(/sdb/));

    expect(entry("sdb (10 GiB)")).toBeInTheDocument();
  });

  it("does not take a name that is not one of the devices", async () => {
    const { user } = installerRender(<TestForm />);
    await user.type(screen.getByRole("combobox", { name: "Disks" }), "/dev/sdz{Enter}");

    expect(entriesList()).not.toBeInTheDocument();
  });

  it("submits the names of the chosen devices", async () => {
    const { user } = installerRender(<TestForm />);
    await openList(user);
    await user.click(deviceOption(/sdb/));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({ targetDevices: ["/dev/sdb"] }),
    );
  });

  it("asks for at least one disk once the form is submitted", async () => {
    const { user } = installerRender(<TestForm />);
    expect(screen.queryByText("Select at least one disk.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("Select at least one disk.");
    expect(onSubmitMock).not.toHaveBeenCalled();
  });

  describe("when there are no devices", () => {
    it("does not lead to a dialog with nothing in it", async () => {
      const { user } = installerRender(<TestForm devices={[]} />);
      await openList(user);

      expect(screen.queryByRole("option", { name: /Browse with details/ })).toBeNull();
    });
  });

  describe("dialog with the details of the devices", () => {
    it("is offered at the foot of the list", async () => {
      const { user } = installerRender(<TestForm />);
      await openList(user);
      list().getByRole("option", { name: /Browse with details/ });
    });

    it("lists the drives and the RAID devices, in the tabs of the dialog", async () => {
      const { user } = installerRender(<TestForm />);
      await openDialog(user);

      screen.getByRole("dialog", { name: "Select disks" });
      deviceRow("sda");
      deviceRow("sdb");
      await user.click(dialog().getByRole("tab", { name: "RAID" }));
      deviceRow("md0");
    });

    it("explains that volume groups are not offered", async () => {
      const { user } = installerRender(<TestForm />);
      await openDialog(user);
      await user.click(dialog().getByRole("tab", { name: "LVM" }));

      dialog().getByText(/Only disks and software RAID devices can hold/);
    });

    it("starts with the devices already chosen picked", async () => {
      const { user } = installerRender(<TestForm targetDevices={["/dev/sdb"]} />);
      await openDialog(user);

      expect(within(deviceRow("sda")).getByRole("checkbox")).not.toBeChecked();
      expect(within(deviceRow("sdb")).getByRole("checkbox")).toBeChecked();
    });

    it("sets the devices picked as the value of the field", async () => {
      const { user } = installerRender(<TestForm targetDevices={["/dev/sda"]} />);
      await openDialog(user);
      await toggleDevice(user, "sda");
      await toggleDevice(user, "sdb");
      await user.click(dialog().getByRole("button", { name: "Accept" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(entry("sdb (10 GiB)")).toBeInTheDocument();
      expect(entry("sda (20 GiB)")).not.toBeInTheDocument();
    });

    it("can pick devices of different tabs", async () => {
      const { user } = installerRender(<TestForm />);
      await openDialog(user);
      await toggleDevice(user, "sda");
      await user.click(dialog().getByRole("tab", { name: "RAID" }));
      await toggleDevice(user, "md0");
      await user.click(dialog().getByRole("button", { name: "Accept" }));

      expect(entry("sda (20 GiB)")).toBeInTheDocument();
      expect(entry("md0 (5 GiB)")).toBeInTheDocument();
    });

    it("leaves the field as it was when the dialog is cancelled", async () => {
      const { user } = installerRender(<TestForm targetDevices={["/dev/sda"]} />);
      await openDialog(user);
      await toggleDevice(user, "sda");
      await toggleDevice(user, "sdb");
      await user.click(dialog().getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(entry("sda (20 GiB)")).toBeInTheDocument();
      expect(entry("sdb (10 GiB)")).not.toBeInTheDocument();
    });

    it("empties the field when everything is unpicked", async () => {
      const { user } = installerRender(<TestForm targetDevices={["/dev/sda"]} />);
      await openDialog(user);
      await toggleDevice(user, "sda");
      await user.click(dialog().getByRole("button", { name: "Accept" }));

      expect(entriesList()).not.toBeInTheDocument();
    });
  });
});
