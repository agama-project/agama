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
import type { Storage as System } from "~/model/system";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import CurrentContentSection from "~/components/storage/device-sheet/CurrentContentSection";

const mockAnnounce = jest.fn();

jest.mock("~/context/announcer", () => ({
  ...jest.requireActual("~/context/announcer"),
  useAnnounce: () => mockAnnounce,
}));

/* Nothing the installer has worked out yet: every part reads as deleted. */
jest.mock("~/components/storage/shared/use-devices-manager", () => ({
  useDevicesManager: () => ({
    stagingDevice: () => undefined,
    hasNewFilesystem: () => false,
    resizedDevices: () => [],
  }),
}));

jest.mock("~/components/storage/device-sheet/partition-space", () => ({
  ...jest.requireActual("~/components/storage/device-sheet/partition-space"),
  usePartitionSpaceItems: () => [],
}));

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useDeletePartition: () => jest.fn(),
  useSetSpacePolicy: () => jest.fn(),
}));

const partition = (sid: number, systems: string[] = []): System.Device => ({
  sid,
  name: `/dev/vdd${sid}`,
  class: "partition",
  block: { start: sid, size: 1024 ** 3, systems, shrinking: { supported: false } },
});

const entry = (
  spacePolicy: ConfigModel.SpacePolicy,
  partitions: ConfigModel.Partition[] = [],
): Entry => ({
  config: { name: "/dev/vdd", spacePolicy, partitions } as Partitionable.Device,
  device: {
    sid: 10,
    name: "/dev/vdd",
    class: "drive",
    partitions: [partition(1, ["Windows 11"]), partition(2), partition(3)],
  } as System.Device,
  name: "vdd",
  isVolumeGroup: false,
});

const subject = { collection: "drives" as const, index: 0 };

const options = () => screen.queryByRole("group", { name: "Set all partitions to" });

describe("CurrentContentSection", () => {
  it("sums up what the chosen option does to the partitions", () => {
    installerRender(<CurrentContentSection entry={entry("delete")} subject={subject} />);

    screen.getByText("3 partitions: all will be deleted (including Windows 11)");
  });

  it("keeps the partitions out of sight until asked for", async () => {
    const { user } = installerRender(
      <CurrentContentSection entry={entry("delete")} subject={subject} />,
    );

    expect(screen.queryByRole("table")).toBeNull();
    const toggle = screen.getByRole("button", { name: "Show partitions" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    screen.getByRole("table", { name: "Current content" });
    expect(screen.getByRole("button", { name: "Hide partitions" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("describes the toggle with the summary", () => {
    installerRender(<CurrentContentSection entry={entry("delete")} subject={subject} />);

    expect(screen.getByRole("button", { name: "Show partitions" })).toHaveAccessibleDescription(
      "3 partitions: all will be deleted (including Windows 11)",
    );
  });

  it("reads pressed the decision every partition shares", () => {
    installerRender(<CurrentContentSection entry={entry("delete")} subject={subject} />);

    screen.getByRole("button", { name: "Delete", pressed: true });
  });

  describe("when the partitions are given different decisions", () => {
    const mixed = entry("custom", [{ name: "/dev/vdd1", delete: true }]);

    it("counts what becomes of them, keeping the partitions out of sight", () => {
      installerRender(<CurrentContentSection entry={mixed} subject={subject} />);

      screen.getByText("3 partitions: 1 will be deleted (including Windows 11) and 2 will be kept");
      expect(screen.queryByRole("table")).toBeNull();
    });

    it("reads none of the options pressed", () => {
      installerRender(<CurrentContentSection entry={mixed} subject={subject} />);

      expect(within(options()).queryAllByRole("button", { pressed: true })).toEqual([]);
    });
  });

  describe("when the new system uses some partitions", () => {
    const reusing = entry("delete", [{ name: "/dev/vdd3", mountPath: "/home" }]);

    it("says so first, then what happens to the others", () => {
      installerRender(<CurrentContentSection entry={reusing} subject={subject} />);

      screen.getByText(
        '3 partitions: 2 will be deleted (including Windows 11) and 1 will be formatted for "/home"',
      );
    });

    it("says when it keeps one as it is, rather than formatting it", () => {
      const keeping = entry("delete", [
        { name: "/dev/vdd3", mountPath: "/home", filesystem: { reuse: true, default: false } },
      ]);
      installerRender(<CurrentContentSection entry={keeping} subject={subject} />);

      screen.getByText(
        '3 partitions: 2 will be deleted (including Windows 11) and 1 will be mounted at "/home"',
      );
    });

    it("still offers giving the others the same decision", () => {
      installerRender(<CurrentContentSection entry={reusing} subject={subject} />);

      screen.getByRole("button", { name: "Delete", pressed: true });
      expect(screen.getByRole("button", { name: "Keep" })).toBeEnabled();
    });
  });

  it("offers no decision when the new system uses every partition", () => {
    const reusingAll = entry(
      "custom",
      [1, 2, 3].map((n) => ({ name: `/dev/vdd${n}`, mountPath: `/data${n}` })),
    );
    installerRender(<CurrentContentSection entry={reusingAll} subject={subject} />);

    screen.getByText("3 partitions: all will be formatted for the new system");
    expect(options()).toBeNull();
  });

  it("announces the new summary when the decisions change", () => {
    const { rerender } = installerRender(
      <CurrentContentSection entry={entry("delete")} subject={subject} />,
    );
    expect(mockAnnounce).not.toHaveBeenCalled();

    rerender(<CurrentContentSection entry={entry("keep")} subject={subject} />);

    expect(mockAnnounce).toHaveBeenCalledWith("3 partitions: all will be kept");
  });

  describe("on a device the installation does not use", () => {
    it("keeps every partition, with no space option to choose", () => {
      installerRender(
        <CurrentContentSection entry={entry("keep")} subject={subject} fixedDecision="keep" />,
      );

      screen.getByText("3 partitions: all will be kept");
      expect(options()).toBeNull();
    });
  });

  describe("on a device given whole to a file system", () => {
    it("deletes every partition, with nothing to decide about them", async () => {
      const { user } = installerRender(
        <CurrentContentSection entry={entry("keep")} subject={subject} fixedDecision="delete" />,
      );

      screen.getByText("3 partitions: all will be deleted (including Windows 11)");
      expect(options()).toBeNull();

      await user.click(screen.getByRole("button", { name: "Show partitions" }));
      expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
    });
  });
});
