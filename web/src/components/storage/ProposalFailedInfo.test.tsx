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

const mockCreateNothingConfigModel: ConfigModel.Config = {
  boot: { configure: false },
  drives: [
    {
      name: "/dev/vdb",
      partitions: [
        {
          name: "/dev/vdb1", // Has name, so it's not new
          size: { default: false, min: 6430916608 },
        },
      ],
    },
  ],
  volumeGroups: [],
};

const mockUseConfigModel = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockUseConfigModel(),
}));

const showMore = () => screen.getByRole("button", { name: "Show more about the storage layout" });
const popup = () => screen.getByRole("dialog", { name: "Storage layout not calculated" });

/** Renders the alert and opens its popup, where the explanation is. */
const renderOpen = async () => {
  const { user } = installerRender(<ProposalFailedInfo />);
  await user.click(showMore());
};

describe("ProposalFailedInfo", () => {
  beforeEach(() => {
    mockUseConfigModel.mockReturnValue(mockFullConfigModel);
  });

  it("says in one line that no layout can be calculated, with a way to learn more", () => {
    installerRender(<ProposalFailedInfo />);

    screen.getByText("Warning alert:");
    const line = screen.getByText(/No storage layout can be calculated with the current settings/);
    expect(line).toContainElement(showMore());
    expect(showMore()).toHaveTextContent("Show more");
  });

  it("keeps the explanation out of the page until it is asked for", () => {
    installerRender(<ProposalFailedInfo />);

    expect(screen.queryByText(/It is not possible/)).not.toBeInTheDocument();
  });

  describe("when there are no new partitions or logical volumes", () => {
    beforeEach(() => {
      mockUseConfigModel.mockReturnValue(mockCreateNothingConfigModel);
    });

    it("explains it in general terms", async () => {
      await renderOpen();
      within(popup()).getByText(
        /It is not possible to install the system with the current configuration/,
      );
    });
  });

  describe("when there are new partitions or logical volumes", () => {
    describe("and boot is configured", () => {
      it("says the boot partition does not fit either", async () => {
        await renderOpen();
        within(popup()).getByText(
          /It is not possible to allocate space for the boot partition and for/,
        );
      });

      it("displays the mount paths with sizes", async () => {
        await renderOpen();
        // Should show mount paths for new partitions and logical volumes
        within(popup()).getByText(/\/documents/);
        within(popup()).getByText(/swap/);
      });
    });

    describe("and boot is not configured", () => {
      beforeEach(() => {
        mockUseConfigModel.mockReturnValue({
          ...mockFullConfigModel,
          boot: { configure: false },
        });
      });

      it("does not mention the boot partition", async () => {
        await renderOpen();
        within(popup()).getByText(/It is not possible to allocate space for/);
        expect(within(popup()).queryByText(/boot partition/)).not.toBeInTheDocument();
      });
    });
  });

  describe("helper text", () => {
    it("always shows adjustment guidance", async () => {
      await renderOpen();
      within(popup()).getByText(/Adjust the settings below/);
    });
  });
});
