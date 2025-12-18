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
import { screen } from "@testing-library/react";
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
            type: "btrfs",
            snapshots: true,
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
          size: { min: 6430916608 },
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

describe("ProposalFailedInfo", () => {
  beforeEach(() => {
    mockUseConfigModel.mockReturnValue(mockFullConfigModel);
  });

  describe("when there are no new partitions or logical volumes", () => {
    beforeEach(() => {
      mockUseConfigModel.mockReturnValue(mockCreateNothingConfigModel);
    });

    it("renders a generic warning message", () => {
      installerRender(<ProposalFailedInfo />);
      screen.getByText("Warning alert:");
      screen.getByText("Failed to calculate a storage layout");
      screen.getByText(
        /It is not possible to install the system with the current configuration/,
      );
    });
  });

  describe("when there are new partitions or logical volumes", () => {
    describe("and boot is configured", () => {
      it("renders a warning mentioning boot partition", () => {
        installerRender(<ProposalFailedInfo />);
        screen.getByText("Warning alert:");
        screen.getByText("Failed to calculate a storage layout");
        screen.getByText(/It is not possible to allocate space for the boot partition and for/);
      });

      it("displays the mount paths with sizes", () => {
        installerRender(<ProposalFailedInfo />);
        // Should show mount paths for new partitions and logical volumes
        expect(screen.getByText(/\/documents/)).toBeInTheDocument();
        expect(screen.getByText(/\//)).toBeInTheDocument();
        expect(screen.getByText(/swap/)).toBeInTheDocument();
      });
    });

    describe("and boot is not configured", () => {
      beforeEach(() => {
        mockUseConfigModel.mockReturnValue({
          ...mockFullConfigModel,
          boot: { configure: false },
        });
      });

      it("renders a warning without mentioning boot partition", () => {
        installerRender(<ProposalFailedInfo />);
        screen.getByText("Warning alert:");
        screen.getByText("Failed to calculate a storage layout");
        screen.getByText(/It is not possible to allocate space for/);
        expect(screen.queryByText(/boot partition/)).not.toBeInTheDocument();
      });
    });
  });

  describe("helper text", () => {
    it("always shows adjustment guidance", () => {
      installerRender(<ProposalFailedInfo />);
      screen.getByText(/Adjust the settings below/);
    });
  });
});
