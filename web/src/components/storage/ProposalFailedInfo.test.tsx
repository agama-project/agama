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
import ProposalFailedInfo from "./ProposalFailedInfo";

const mockStorageModel = {
  boot: {
    configure: true,
    device: "/dev/vdb",
  },
  drives: [
    {
      name: "/dev/vdb",
      partitions: [
        {
          name: "/dev/vdb1",
          size: { min: 6430916608, max: 6430916608 },
        },
        {
          name: "/dev/vdb2",
          size: { min: 4305436160, max: 4305436160 },
        },
      ],
    },
    {
      name: "/dev/vdc",
      partitions: [
        {
          // Partition without name (new partition)
          mountPath: "/documents",
          filesystem: { type: "xfs" },
          size: { min: 136365211648 },
        },
      ],
    },
  ],
  volumeGroups: [
    {
      name: "system",
      logicalVolumes: [
        {
          name: "root",
          mountPath: "/",
          filesystem: { type: "btrfs" },
          size: { min: 13421772800 },
        },
        {
          name: "swap",
          mountPath: "swap",
          filesystem: { type: "swap" },
          size: { min: 1073741824, max: 2147483648 },
        },
      ],
    },
  ],
};

let mockUseStorageModel = jest.fn();

jest.mock("~/hooks/api/storage", () => ({
  useStorageModel: () => mockUseStorageModel(),
}));

describe("ProposalFailedInfo", () => {
  beforeEach(() => {
    mockUseStorageModel = jest.fn(() => mockStorageModel);
  });

  describe("when there are no new partitions or logical volumes", () => {
    beforeEach(() => {
      mockUseStorageModel = jest.fn(() => ({
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
      }));
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
      beforeEach(() => {
        mockUseStorageModel = jest.fn(() => ({
          ...mockStorageModel,
          boot: { configure: true },
        }));
      });

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
        mockUseStorageModel = jest.fn(() => ({
          ...mockStorageModel,
          boot: { configure: false },
        }));
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
