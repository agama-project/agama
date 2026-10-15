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
import type { Storage as System } from "~/model/system";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import CurrentContentSection from "~/components/storage/device-sheet/CurrentContentSection";

const mockPolicy = jest.fn();
const mockAnnounce = jest.fn();

jest.mock("~/components/storage/shared/space-policy", () => ({
  ...jest.requireActual("~/components/storage/shared/space-policy"),
  useSpacePolicy: () => ({ policy: mockPolicy() }),
}));

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
}));

/* The decision itself is tested on its own. */
jest.mock("~/components/storage/device-sheet/SpaceDecision", () => () => (
  <div role="group" aria-label="Allowed changes" />
));

const partition = (sid: number, systems: string[] = []): System.Device => ({
  sid,
  name: `/dev/vdd${sid}`,
  class: "partition",
  block: { start: sid, size: 1024 ** 3, systems, shrinking: { supported: false } },
});

const entry = (spacePolicy: ConfigModel.SpacePolicy): Entry => ({
  config: { name: "/dev/vdd", spacePolicy, partitions: [] } as Partitionable.Device,
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

describe("CurrentContentSection", () => {
  beforeEach(() => {
    mockPolicy.mockReturnValue("delete");
  });

  it("sums up what the chosen option does to the partitions", () => {
    installerRender(<CurrentContentSection entry={entry("delete")} subject={subject} />);

    screen.getByText("Deletes 3 partitions and their data, including Windows 11");
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
      "Deletes 3 partitions and their data, including Windows 11",
    );
  });

  describe("under the custom option", () => {
    beforeEach(() => {
      mockPolicy.mockReturnValue("custom");
    });

    it("always shows the partitions, with no summary and no toggle", () => {
      installerRender(<CurrentContentSection entry={entry("custom")} subject={subject} />);

      screen.getByRole("table", { name: "Current content" });
      expect(screen.queryByRole("button", { name: /partitions/ })).toBeNull();
      expect(screen.queryByText(/^Deletes/)).toBeNull();
    });
  });

  it("announces the new summary when the option changes", () => {
    const { rerender } = installerRender(
      <CurrentContentSection entry={entry("delete")} subject={subject} />,
    );
    expect(mockAnnounce).not.toHaveBeenCalled();

    mockPolicy.mockReturnValue("keep");
    rerender(<CurrentContentSection entry={entry("keep")} subject={subject} />);

    expect(mockAnnounce).toHaveBeenCalledWith("Keeps 3 partitions, with no free space to use");
  });

  describe("on a device the installation does not use", () => {
    it("keeps every partition, with no space option to choose", () => {
      installerRender(
        <CurrentContentSection entry={entry("keep")} subject={subject} fixedDecision="keep" />,
      );

      screen.getByText("Keeps 3 partitions as they are");
      expect(screen.queryByRole("group", { name: "Allowed changes" })).toBeNull();
    });
  });

  describe("on a device given whole to a file system", () => {
    it("deletes every partition, with nothing to decide about them", async () => {
      const { user } = installerRender(
        <CurrentContentSection entry={entry("keep")} subject={subject} fixedDecision="delete" />,
      );

      screen.getByText("Deletes 3 partitions and their data, including Windows 11");
      expect(screen.queryByRole("group", { name: "Allowed changes" })).toBeNull();

      await user.click(screen.getByRole("button", { name: "Show partitions" }));
      expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
    });
  });
});
