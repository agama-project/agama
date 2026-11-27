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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import DetailsSection from "~/components/storage/device-details/DetailsSection";
import type { Storage as System } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-details/entry";
import PlannedContentSection from "~/components/storage/device-details/PlannedContentSection";

const mockDeletePartition = jest.fn();
const mockDeleteLogicalVolume = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useDeletePartition: () => mockDeletePartition,
  useDeleteLogicalVolume: () => mockDeleteLogicalVolume,
}));

const group = (logicalVolumes: ConfigModel.LogicalVolume[]): Entry => ({
  config: { vgName: "system", name: "/dev/system", logicalVolumes },
  device: null,
  name: "system",
  isVolumeGroup: true,
});

const subject = { collection: "volumeGroups" as const, index: 0 };

const size = { default: false, min: 5 * 1024 ** 3 };

const home: ConfigModel.LogicalVolume = {
  mountPath: "/home",
  size,
};

const disk = (partitions: ConfigModel.Partition[]): Entry => ({
  config: { name: "/dev/vda", partitions },
  device: {
    sid: 1,
    name: "/dev/vda",
    class: "drive",
    partitions: [{ sid: 2, name: "/dev/vda2", class: "partition", filesystem: { type: "xfs" } }],
  } as System.Device,
  name: "vda",
  isVolumeGroup: false,
});

const diskSubject = { collection: "drives" as const, index: 0 };

describe("PlannedContentSection", () => {
  beforeEach(() => {
    mockDeletePartition.mockClear();
    mockDeleteLogicalVolume.mockClear();
  });

  it("lists what is planned, with a generic name outside a section", () => {
    installerRender(<PlannedContentSection entry={group([home])} subject={subject} />);

    const table = screen.getByRole("table", { name: "Planned content" });
    expect(table).toHaveTextContent("/home");
  });

  it("takes its name from the title of the section it is in", () => {
    installerRender(
      <DetailsSection title="Logical volumes for the new system">
        <PlannedContentSection entry={group([home])} subject={subject} />
      </DetailsSection>,
    );

    screen.getByRole("table", { name: "Logical volumes for the new system" });
  });

  describe("in the menu of a row", () => {
    const reusedPartition: ConfigModel.Partition = {
      name: "/dev/vda2",
      mountPath: "/data",
      filesystem: { default: false, reuse: true },
      size,
    };
    const newPartition: ConfigModel.Partition = { mountPath: "/home", size };

    const items = () =>
      within(screen.getByRole("menu"))
        .getAllByRole("menuitem")
        .map((item) => item.textContent);

    it("offers to edit and to delete a new partition", async () => {
      const { user } = installerRender(
        <PlannedContentSection entry={disk([newPartition])} subject={diskSubject} />,
      );
      await user.click(screen.getByRole("button", { name: "Actions for /home" }));

      expect(items()).toEqual(["Edit", "Delete"]);
      expect(screen.getByRole("menuitem", { name: "Delete" }).closest("li")).toHaveClass(
        "pf-m-danger",
      );

      await user.click(screen.getByRole("menuitem", { name: "Delete" }));
      expect(mockDeletePartition).toHaveBeenCalledWith("drives", 0, "/home");
    });

    it("offers to edit and to stop using a reused partition, as a danger", async () => {
      const { user } = installerRender(
        <PlannedContentSection entry={disk([reusedPartition])} subject={diskSubject} />,
      );
      await user.click(screen.getByRole("button", { name: "Actions for /data" }));

      expect(items()).toEqual(["Edit", "Stop using"]);
      expect(screen.getByRole("menuitem", { name: "Stop using" }).closest("li")).toHaveClass(
        "pf-m-danger",
      );

      await user.click(screen.getByRole("menuitem", { name: "Stop using" }));
      expect(mockDeletePartition).toHaveBeenCalledWith("drives", 0, "/data");
    });

    it("offers to edit and to delete a new logical volume", async () => {
      const { user } = installerRender(
        <PlannedContentSection entry={group([home])} subject={subject} />,
      );
      await user.click(screen.getByRole("button", { name: "Actions for /home" }));

      expect(items()).toEqual(["Edit", "Delete"]);
      expect(screen.getByRole("menuitem", { name: "Delete" }).closest("li")).toHaveClass(
        "pf-m-danger",
      );
    });

    it("offers to edit and to stop using a reused logical volume, as a danger", async () => {
      const reused: ConfigModel.LogicalVolume = {
        name: "/dev/system/data",
        lvName: "data",
        mountPath: "/data",
        filesystem: { default: false, reuse: true },
        size,
      };
      const entry = group([reused]);
      entry.device = {
        sid: 3,
        name: "/dev/system",
        class: "volumeGroup",
        logicalVolumes: [
          { sid: 4, name: "/dev/system/data", class: "logicalVolume", filesystem: { type: "xfs" } },
        ],
      } as System.Device;
      const { user } = installerRender(<PlannedContentSection entry={entry} subject={subject} />);
      await user.click(screen.getByRole("button", { name: "Actions for /data" }));

      expect(items()).toEqual(["Edit", "Stop using"]);
      expect(screen.getByRole("menuitem", { name: "Stop using" }).closest("li")).toHaveClass(
        "pf-m-danger",
      );

      await user.click(screen.getByRole("menuitem", { name: "Stop using" }));
      expect(mockDeleteLogicalVolume).toHaveBeenCalledWith("system", "/data");
    });
  });
});
