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
  onDevice: System.Device[] = [partition(1, ["Windows 11"]), partition(2), partition(3)],
): Entry => ({
  config: { name: "/dev/vdd", spacePolicy, partitions } as Partitionable.Device,
  device: {
    sid: 10,
    name: "/dev/vdd",
    class: "drive",
    partitions: onDevice,
  } as System.Device,
  name: "vdd",
  isVolumeGroup: false,
});

const subject = { collection: "drives" as const, index: 0 };

/** The menu giving every partition the same action. */
const options = () => screen.queryByRole("button", { name: "Actions for all partitions" });

/** The sentence summing up the content, which describes the toggle under it. */
const summary = () =>
  document.getElementById(
    screen
      .getByRole("button", { name: /^(Show|Hide) partition details$/ })
      .getAttribute("aria-describedby"),
  );

/** The cells of a partition's row after its name: content, size, action and menu. */
const cellsOf = (name: string) =>
  within(screen.getByRole("rowheader", { name }).closest("tr")).getAllByRole("cell");

/** Renders the section and opens what its toggle puts away. */
const renderShown = async (ui: React.ReactElement) => {
  const rendered = installerRender(ui);
  await rendered.user.click(screen.getByRole("button", { name: "Show partition details" }));
  return rendered;
};

describe("CurrentContentSection", () => {
  it("sums up what happens to the partitions, with how many there are in bold", () => {
    installerRender(<CurrentContentSection entry={entry("delete")} subject={subject} />);

    expect(summary()).toHaveTextContent("3 partitions: all will be deleted (including Windows 11)");
    expect(within(summary()).getByText("3 partitions")).toHaveClass("pf-v6-u-font-weight-bold");
  });

  it("puts the actions for every partition right after the summary", () => {
    installerRender(<CurrentContentSection entry={entry("delete")} subject={subject} />);

    expect(summary().compareDocumentPosition(options())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("describes the actions for every partition with the summary", () => {
    installerRender(<CurrentContentSection entry={entry("delete")} subject={subject} />);

    expect(document.getElementById(options().getAttribute("aria-describedby"))).toBe(summary());
  });

  it("keeps the partitions out of sight until asked for", async () => {
    const { user } = installerRender(
      <CurrentContentSection entry={entry("delete")} subject={subject} />,
    );

    expect(screen.queryByRole("table")).toBeNull();
    const toggle = screen.getByRole("button", { name: "Show partition details" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    screen.getByRole("table", { name: "Current content" });
    expect(screen.getByRole("button", { name: "Hide partition details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("offers giving every partition the same decision outside the table, open or not", async () => {
    const { user } = installerRender(
      <CurrentContentSection entry={entry("delete")} subject={subject} />,
    );

    options();

    await user.click(screen.getByRole("button", { name: "Show partition details" }));

    expect(screen.getByRole("table")).not.toContainElement(options());
  });

  it("never puts the partitions away when an action is chosen", async () => {
    const { user } = await renderShown(
      <CurrentContentSection entry={entry("delete")} subject={subject} />,
    );
    await user.click(options());
    await user.click(screen.getByRole("menuitem", { name: /^Keep all partitions/ }));

    screen.getByRole("table", { name: "Current content" });
  });

  it("heads the column of row menus with a name and nothing else", async () => {
    await renderShown(<CurrentContentSection entry={entry("delete")} subject={subject} />);

    const header = screen.getByRole("columnheader", { name: "Options" });
    expect(within(header).queryByRole("button")).toBeNull();
  });

  it("describes the toggle with the summary", () => {
    installerRender(<CurrentContentSection entry={entry("delete")} subject={subject} />);

    const toggle = screen.getByRole("button", { name: "Show partition details" });

    const description = document.getElementById(toggle.getAttribute("aria-describedby"));

    expect(description).toHaveTextContent(
      "3 partitions: all will be deleted (including Windows 11)",
    );
  });

  describe("when the partitions are given different decisions", () => {
    const mixed = entry("custom", [{ name: "/dev/vdd1", delete: true }]);

    it("counts what becomes of them, keeping the partitions out of sight", () => {
      installerRender(<CurrentContentSection entry={mixed} subject={subject} />);

      expect(summary()).toHaveTextContent("3 partitions: 1 will be deleted (including Windows 11)");
      expect(screen.queryByRole("table")).toBeNull();
    });
  });

  describe("when the new system uses some partitions", () => {
    const reusing = entry("delete", [{ name: "/dev/vdd3", mountPath: "/home" }]);

    it("counts them among the rest", () => {
      installerRender(<CurrentContentSection entry={reusing} subject={subject} />);

      expect(summary()).toHaveTextContent(
        '3 partitions: 2 will be deleted (including Windows 11) and 1 will be formatted for "/home"',
      );
    });

    it("says when it keeps one as it is, rather than formatting it", () => {
      const keeping = entry("delete", [
        { name: "/dev/vdd3", mountPath: "/home", filesystem: { reuse: true, default: false } },
      ]);
      installerRender(<CurrentContentSection entry={keeping} subject={subject} />);

      expect(summary()).toHaveTextContent(
        '3 partitions: 2 will be deleted (including Windows 11) and 1 will be mounted at "/home"',
      );
    });

    it("still offers giving the others the same decision", async () => {
      const { user } = await renderShown(
        <CurrentContentSection entry={reusing} subject={subject} />,
      );
      await user.click(options());

      screen.getByRole("menuitem", { name: /^Keep all partitions/ });
    });
  });

  it("offers no decision when the new system uses every partition", async () => {
    const reusingAll = entry(
      "custom",
      [1, 2, 3].map((n) => ({ name: `/dev/vdd${n}`, mountPath: `/data${n}` })),
    );
    await renderShown(<CurrentContentSection entry={reusingAll} subject={subject} />);

    expect(summary()).toHaveTextContent("3 partitions: all will be formatted for the new system");
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
    it("keeps every partition, with no decision to offer", async () => {
      await renderShown(
        <CurrentContentSection entry={entry("keep")} subject={subject} fixedDecision="keep" />,
      );

      expect(summary()).toHaveTextContent("3 partitions: all will be kept");
      expect(options()).toBeNull();
    });
  });

  describe("on a device given whole to a file system", () => {
    it("deletes every partition, with nothing to decide about them", async () => {
      await renderShown(
        <CurrentContentSection entry={entry("keep")} subject={subject} fixedDecision="delete" />,
      );

      expect(summary()).toHaveTextContent(
        "3 partitions: all will be deleted (including Windows 11)",
      );
      expect(options()).toBeNull();
      expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
    });
  });

  describe("in the Action column", () => {
    const GiB = 1024 ** 3;
    const shrinkable: System.Device = {
      sid: 2,
      name: "/dev/vdd2",
      class: "partition",
      block: {
        start: 2,
        size: 18 * GiB,
        systems: [],
        shrinking: { supported: true, minSize: 0.5 * GiB },
      },
    };

    it("keeps a partition allowed to shrink that cannot, and says why under it", async () => {
      await renderShown(<CurrentContentSection entry={entry("resize")} subject={subject} />);

      const [, , action] = cellsOf("vdd1");
      within(action).getByText("Keep");
      within(action).getByText("Cannot be shrunk");
    });

    it("says how much shrinking may free", async () => {
      await renderShown(
        <CurrentContentSection
          entry={entry("resize", [], [partition(1), shrinkable])}
          subject={subject}
        />,
      );

      const [, , action] = cellsOf("vdd2");
      within(action).getByText("Shrink if needed");
      within(action).getByText("Up to 17.5 GiB may be freed");
    });

    it("says how much deleting frees", async () => {
      await renderShown(<CurrentContentSection entry={entry("delete")} subject={subject} />);

      const [content, , action] = cellsOf("vdd1");
      within(action).getByText("Delete");
      within(action).getByText("1 GiB will be freed");
      within(content).getByText("Windows 11");
    });

    it("says what a formatted partition becomes, and shows what it holds today as it is", async () => {
      await renderShown(
        <CurrentContentSection
          entry={entry("keep", [
            { name: "/dev/vdd3", mountPath: "/docs", filesystem: { default: false, type: "xfs" } },
          ])}
          subject={subject}
        />,
      );

      const [content, , action] = cellsOf("vdd3");
      within(action).getByText("Format as xfs");
      within(action).getByText('To mount "/docs"');
      expect(within(content).queryByText("xfs")).toBeNull();
    });

    it("leaves the file system out where none is known yet", async () => {
      await renderShown(
        <CurrentContentSection
          entry={entry("keep", [
            { name: "/dev/vdd3", mountPath: "/docs", filesystem: { default: true } },
          ])}
          subject={subject}
        />,
      );

      const [, , action] = cellsOf("vdd3");
      within(action).getByText("Format");
      within(action).getByText('To mount "/docs"');
    });

    it("names the system found on a partition the new system formats", async () => {
      await renderShown(
        <CurrentContentSection
          entry={entry("keep", [
            { name: "/dev/vdd1", mountPath: "/docs", filesystem: { default: false, type: "xfs" } },
          ])}
          subject={subject}
        />,
      );

      const [content] = cellsOf("vdd1");
      within(content).getByText("Windows 11");
    });
  });
});
