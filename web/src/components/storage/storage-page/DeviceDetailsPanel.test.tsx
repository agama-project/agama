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
import { useSearchParams } from "react-router";
import { installerRender, mockRoutes } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import DeviceDetailsPanel from "~/components/storage/storage-page/DeviceDetailsPanel";

const mockConfig = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: () => null,
}));

/* What the panel holds and its menus have their own tests: here only what the
   panel does with them. The body offers a way to another entry, as a "Details"
   menu item does. */
jest.mock("~/components/storage/device-details/DeviceDetailsBody", () => ({ entry }) => {
  const { useDeviceDetails } = jest.requireActual("~/components/storage/shared/use-device-details");
  const { openDetails } = useDeviceDetails();
  return (
    <>
      <p>details of {entry.name}</p>
      <button onClick={() => openDetails({ collection: "volumeGroups", index: 0 })}>
        Details of system
      </button>
    </>
  );
});
jest.mock("~/components/storage/device-details/DeviceDetailsHeading", () => ({ entry }) => (
  <>{entry.name}</>
));
jest.mock("~/components/storage/entries-table/DriveMenu", () => () => <button>disk menu</button>);
jest.mock("~/components/storage/entries-table/VolumeGroupMenu", () => () => (
  <button>volume group menu</button>
));

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [{ name: "/dev/sda", partitions: [] }],
  mdRaids: [],
  volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"], logicalVolumes: [] }],
  ...values,
});

/* The page the panel opens over, with the menu of each entry's row, where focus
   goes back when the panel closes. */
const page = (
  <div>
    <p>the storage page</p>
    <table>
      <tbody>
        <tr>
          <td data-entry-menu="drives.sda">
            <button>Actions for sda</button>
          </td>
        </tr>
        <tr>
          <td data-entry-menu="volumeGroups.system">
            <button>Actions for system</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

const Address = () => {
  const [params] = useSearchParams();
  return <output>{params.toString()}</output>;
};

const panel = () => screen.queryByRole("region");

const renderAt = (address: string) => {
  mockRoutes(address);
  return installerRender(
    <>
      <DeviceDetailsPanel page={page} />
      <Address />
    </>,
  );
};

describe("DeviceDetailsPanel", () => {
  beforeEach(() => {
    mockConfig.mockReturnValue(config());
  });

  it("shows the page and no panel where the address names nothing", () => {
    renderAt("/storage");

    screen.getByText("the storage page");
    expect(panel()).toBeNull();
  });

  describe("when the address names an entry", () => {
    it("opens on it, named by it, and moves the reader into it", () => {
      renderAt("/storage?device=drives.sda");

      const region = screen.getByRole("region", { name: "sda" });
      screen.getByText("details of sda");
      expect(region).toHaveFocus();
    });

    it("offers the same menu its row offers", () => {
      renderAt("/storage?device=drives.sda");

      screen.getByRole("button", { name: "disk menu" });
    });

    it("offers a volume group's menu on a volume group", () => {
      renderAt("/storage?device=volumeGroups.system");

      screen.getByRole("button", { name: "volume group menu" });
    });

    it("closes with Escape, back on the menu of the entry's row", async () => {
      const { user } = renderAt("/storage?device=drives.sda");
      await user.keyboard("{Escape}");

      expect(panel()).toBeNull();
      expect(screen.getByRole("status").textContent).toBe("");
      expect(screen.getByRole("button", { name: "Actions for sda" })).toHaveFocus();
    });

    it("closes with its close button, back on the menu of the entry's row", async () => {
      const { user } = renderAt("/storage?device=drives.sda");
      await user.click(screen.getByRole("button", { name: "Close" }));

      expect(panel()).toBeNull();
      expect(screen.getByRole("button", { name: "Actions for sda" })).toHaveFocus();
    });
  });

  describe("when the reader moves to another entry from inside it", () => {
    it("shows that entry and keeps the reader in the panel", async () => {
      const { user } = renderAt("/storage?device=drives.sda");
      await user.click(screen.getByRole("button", { name: "Details of system" }));

      const region = screen.getByRole("region", { name: "system" });
      expect(region).toHaveFocus();
    });

    it("lets Escape still close it, back on the row of the entry it showed last", async () => {
      const { user } = renderAt("/storage?device=drives.sda");
      await user.click(screen.getByRole("button", { name: "Details of system" }));
      await user.keyboard("{Escape}");

      expect(panel()).toBeNull();
      expect(screen.getByRole("button", { name: "Actions for system" })).toHaveFocus();
    });
  });

  describe("when the address names an entry the configuration no longer has", () => {
    it("leaves the reader on the page rather than on a broken panel", () => {
      renderAt("/storage?device=drives.vdz");

      screen.getByText("the storage page");
      expect(panel()).toBeNull();
    });

    it("takes the entry out of the address, keeping the rest of it", () => {
      renderAt("/storage?settingsTab=1&device=drives.vdz");

      expect(screen.getByRole("status").textContent).toBe("settingsTab=1");
    });
  });

  describe("when its entry goes away while it is open", () => {
    it("closes rather than showing whatever entry takes its place", () => {
      mockConfig.mockReturnValue(
        config({
          drives: [
            { name: "/dev/sda", partitions: [] },
            { name: "/dev/sdb", partitions: [] },
          ],
        }),
      );
      const { rerender } = renderAt("/storage?device=drives.sda");
      screen.getByRole("region", { name: "sda" });

      /* The first disk leaves; another one now sits where it was. */
      mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sdb", partitions: [] }] }));
      rerender(
        <>
          <DeviceDetailsPanel page={page} />
          <Address />
        </>,
      );

      expect(panel()).toBeNull();
    });
  });

  it.each([
    ["by position, as it was once written", "drives.0"],
    ["the whole picture, as it once could", "result"],
    ["nothing that makes sense", "nonsense"],
  ])("reads an address naming %s as a shut panel", (_, value) => {
    renderAt(`/storage?device=${value}`);

    screen.getByText("the storage page");
    expect(panel()).toBeNull();
  });
});
