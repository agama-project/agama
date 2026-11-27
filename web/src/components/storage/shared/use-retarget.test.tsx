/*
 * Copyright (c) [2026] SUSE LLC
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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";
import { useRetarget } from "~/components/storage/shared/use-retarget";

const mockConfig = jest.fn();
const mockConvertDevice = jest.fn();
const mockAvailableDevices = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
  useConvertDevice: () => mockConvertDevice,
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useAvailableDevices: () => mockAvailableDevices(),
}));

/* The selector has its own tests; here only what it is offered and what choosing does. */
jest.mock(
  "~/components/storage/DeviceSelectorModal",
  () =>
    ({ disks, volumeGroups, onConfirm }) => (
      <div role="dialog" aria-label="selector">
        <p>disks: {disks.map((d) => d.name).join(", ")}</p>
        <p>volume groups: {volumeGroups.map((d) => d.name).join(", ")}</p>
        <button onClick={() => onConfirm([disks[disks.length - 1]])}>Pick the last disk</button>
      </div>
    ),
);

const disk = (name: string) => ({ sid: name.length, name, class: "drive" }) as Storage.Device;
const group = (name: string) => ({ sid: 99, name, class: "volumeGroup" }) as Storage.Device;

function Retarget({ entry }: { entry: Partitionable.Device }) {
  const { title, description, open, selector } = useRetarget(entry, disk(entry.name));
  return (
    <>
      <p>{title}</p>
      <p>{description}</p>
      <button onClick={open}>Use another device</button>
      {selector}
    </>
  );
}

const entry = (values: Partial<Partitionable.Device> = {}) =>
  ({ name: "/dev/vda", partitions: [], ...values }) as Partitionable.Device;

describe("useRetarget", () => {
  beforeEach(() => {
    mockConfig.mockReturnValue({ drives: [entry()], mdRaids: [], volumeGroups: [] });
    mockAvailableDevices.mockReturnValue([
      disk("/dev/vda"),
      disk("/dev/vdb"),
      group("/dev/system"),
    ]);
  });

  describe("title", () => {
    it("names the mount point of a device given whole to a file system", () => {
      installerRender(
        <Retarget
          entry={entry({ mountPath: "/home", filesystem: { reuse: false, default: false } })}
        />,
      );
      screen.getByText('Choose a different device to format as "/home"');
    });

    it("names the system when the device holds the root file system", () => {
      installerRender(
        <Retarget entry={entry({ partitions: [{ mountPath: "/" }] as ConfigModel.Partition[] })} />,
      );
      screen.getByText("Choose a different device to install the system");
    });

    it("names the new partitions otherwise", () => {
      installerRender(
        <Retarget
          entry={entry({ partitions: [{ mountPath: "/home" }] as ConfigModel.Partition[] })}
        />,
      );
      screen.getByText('Choose a different device to create "/home"');
    });

    it("speaks of configuring when nothing is planned on the device", () => {
      installerRender(<Retarget entry={entry()} />);
      screen.getByText("Choose a different device to configure");
    });
  });

  describe("description", () => {
    it("says which volume group stays on the device", () => {
      mockConfig.mockReturnValue({
        drives: [entry()],
        mdRaids: [],
        volumeGroups: [{ vgName: "system", targetDevices: ["/dev/vda"] }],
      });
      installerRender(<Retarget entry={entry()} />);
      screen.getByText("The LVM group 'system' will remain at vda");
    });

    it("says the boot partitions are adapted too", () => {
      mockConfig.mockReturnValue({
        drives: [entry()],
        mdRaids: [],
        volumeGroups: [],
        boot: { configure: true, device: { default: true, name: "/dev/vda" } },
      });
      installerRender(<Retarget entry={entry()} />);
      screen.getByText("Partitions needed for booting will also be adapted");
    });
  });

  describe("selector", () => {
    it("offers no volume group for a device given whole to a file system", async () => {
      const fsEntry = entry({ mountPath: "/home", filesystem: { reuse: false, default: false } });
      const { user } = installerRender(<Retarget entry={fsEntry} />);
      await user.click(screen.getByRole("button", { name: "Use another device" }));

      screen.getByText("disks: /dev/vda, /dev/vdb");
      screen.getByText("volume groups:");
    });

    it("moves the device configuration to the chosen device", async () => {
      const { user } = installerRender(<Retarget entry={entry()} />);
      await user.click(screen.getByRole("button", { name: "Use another device" }));
      await user.click(screen.getByRole("button", { name: "Pick the last disk" }));

      expect(mockConvertDevice).toHaveBeenCalledWith("/dev/vda", "/dev/vdb");
      expect(screen.queryByRole("dialog", { name: "selector" })).toBeNull();
    });
  });
});
