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
import { model as apiModel } from "~/api/storage";

const mockUseStorageModel = jest.fn();

jest.mock("~/hooks/api/storage", () => ({
  useStorageModel: () => mockUseStorageModel(),
}));

// mock i18n
jest.mock("~/i18n", () => ({
  ...jest.requireActual("~/i18n"),
  formatList: (list: string[]) => list.join(", "),
}));

describe("ProposalFailedInfo", () => {
  beforeEach(() => {
    mockUseStorageModel.mockReturnValue({
      boot: { configure: false },
      drives: [],
      volumeGroups: [],
    });
  });

  const renderComponent = () => {
    return installerRender(<ProposalFailedInfo />);
  };

  it("renders a warning alert", () => {
    renderComponent();
    expect(screen.getByText("Failed to calculate a storage layout")).toBeInTheDocument();
  });

  describe("Description", () => {
    it("shows a generic message if there are no partitions or volumes", () => {
      renderComponent();
      expect(
        screen.getByText(
          "It is not possible to install the system with the current configuration. Adjust the settings below.",
        ),
      ).toBeInTheDocument();
    });

    it("mentions boot partition if it is configured", () => {
      mockUseStorageModel.mockReturnValue({
        boot: { configure: true },
        drives: [
          {
            name: "vda",
            partitions: [{ mountPath: "/", size: { min: 1024 }, filesystem: { type: "btrfs" } }],
          },
        ],
        volumeGroups: [],
      });
      renderComponent();
      expect(
        screen.getByText(/It is not possible to allocate space for the boot partition and for/),
      ).toBeInTheDocument();
    });

    it("lists the required partitions", () => {
      const model: apiModel.Config = {
        boot: { configure: false },
        drives: [
          {
            name: "/dev/vda",
            partitions: [
              {
                mountPath: "/",
                size: { default: false, min: 1024 },
                filesystem: { default: false, type: "btrfs" },
              },
            ],
          },
        ],
        volumeGroups: [
          {
            vgName: "system",
            targetDevices: [],
            logicalVolumes: [
              {
                lvName: "home",
                mountPath: "/home",
                size: { default: false, min: 2048 },
                filesystem: { default: false, type: "xfs" },
              },
            ],
          },
        ],
      };
      mockUseStorageModel.mockReturnValue(model);

      renderComponent();

      // The real formatting is more complex, but we mocked formatList
      expect(
        screen.getByText(
          /It is not possible to allocate space for "\/" \(at least 1 KiB\), "\/home" \(at least 2 KiB\)/,
        ),
      ).toBeInTheDocument();
    });
  });
});
