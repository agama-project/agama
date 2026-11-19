/*
 * Copyright (c) [2025] SUSE LLC
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
import type { ConfigModel } from "~/model/storage/config-model";
import ProposalFailedInfo from "./ProposalFailedInfo";

const mockFullConfigModel: ConfigModel.Config = {
  boot: {
    configure: true,
    device: {
      default: true,
      name: "/dev/vdb",
    },
  },
  drives: [
    {
      name: "/dev/vdb",
      spacePolicy: "delete",
      partitions: [
        {
          name: "/dev/vdb1",
          size: {
            default: true,
            min: 6430916608,
            max: 6430916608,
          },
          delete: true,
          deleteIfNeeded: false,
          resize: false,
          resizeIfNeeded: false,
        },
        {
          name: "/dev/vdb2",
          size: {
            default: true,
            min: 4305436160,
            max: 4305436160,
          },
          delete: true,
          deleteIfNeeded: false,
          resize: false,
          resizeIfNeeded: false,
        },
      ],
    },
    {
      name: "/dev/vdc",
      spacePolicy: "delete",
      partitions: [
        {
          mountPath: "/documents",
          filesystem: {
            reuse: false,
            default: false,
            type: "xfs",
            label: "",
          },
          size: {
            default: false,
            min: 136365211648,
          },
          delete: false,
          deleteIfNeeded: false,
          resize: false,
          resizeIfNeeded: false,
        },
      ],
    },
  ],
  volumeGroups: [
    {
      vgName: "system",
      targetDevices: ["/dev/vdb"],
      logicalVolumes: [
        {
          lvName: "root",
          mountPath: "/",
          filesystem: {
            reuse: false,
            default: true,
            type: "btrfsSnapshots",
          },
          size: {
            default: true,
            min: 13421772800,
          },
        },
        {
          lvName: "swap",
          mountPath: "swap",
          filesystem: {
            reuse: false,
            default: true,
            type: "swap",
          },
          size: {
            default: true,
            min: 1073741824,
            max: 2147483648,
          },
        },
      ],
    },
  ],
};

const mockUseConfigModel = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockUseConfigModel(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useAvailableDevices: () => [],
  useVolumeTemplates: () => [],
}));

const showDetails = () =>
  screen.getByRole("button", { name: "Show details about the failed storage calculation." });
const popup = () => screen.getByRole("dialog", { name: "Failed to plan storage changes" });

const renderOpen = async () => {
  const { user } = installerRender(<ProposalFailedInfo />);
  await user.click(showDetails());
};

describe("ProposalFailedInfo", () => {
  beforeEach(() => {
    mockUseConfigModel.mockReturnValue(mockFullConfigModel);
  });

  it("says in one line that the configuration cannot be applied, with a way to learn more", () => {
    installerRender(<ProposalFailedInfo />);

    screen.getByText("Warning alert:");
    screen.getByText("The configuration cannot be applied");
    expect(showDetails()).toHaveTextContent("Show details…");
  });

  it("keeps the explanation out of the page until it is asked for", () => {
    installerRender(<ProposalFailedInfo />);

    expect(screen.queryByText(/Applying the configuration implies/)).not.toBeInTheDocument();
  });

  describe("when boot is configured", () => {
    it("says the boot partition has to fit too, with the new mount paths and their sizes", async () => {
      await renderOpen();

      const intro = within(popup()).getByText(
        /Applying the configuration implies allocating the boot partition and also/,
      );
      expect(intro).toHaveTextContent("/documents");
      expect(intro).toHaveTextContent("swap");
    });
  });

  describe("when boot is not configured", () => {
    beforeEach(() => {
      mockUseConfigModel.mockReturnValue({ ...mockFullConfigModel, boot: { configure: false } });
    });

    it("does not mention the boot partition", async () => {
      await renderOpen();

      within(popup()).getByText(/Applying the configuration implies allocating/);
      expect(within(popup()).queryByText(/boot partition/)).not.toBeInTheDocument();
    });
  });

  it("suggests what to adjust, ending with the partitions and their sizes", async () => {
    await renderOpen();

    within(popup()).getByText("Consider adjusting one or several of the following aspects.");
    const items = within(popup())
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items).toEqual([
      "Changing the way the partitions are distributed on the different disks.",
      "Changing the partitions or adjusting its size limits.",
    ]);
  });
});
