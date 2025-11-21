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
import { LogicalVolume } from "~/storage/data";
import { Issue, IssueSeverity, IssueSource } from "~/api/issue";
import { apiModel } from "~/api/storage/types";

const mockUseConfigErrorsFn = jest.fn();
let mockUseIssues = [];

const configError: Issue = {
  description: "Config error",
  kind: "storage",
  details: "",
  source: IssueSource.Config,
  severity: IssueSeverity.Error,
  scope: "storage",
};

const storageIssue: Issue = {
  description: "Fake Storage Issue",
  details: "",
  kind: "storage_issue",
  source: IssueSource.Unknown,
  severity: IssueSeverity.Error,
  scope: "storage",
};

const mockApiModel: apiModel.Config = {
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

jest.mock("~/hooks/storage/api-model", () => ({
  ...jest.requireActual("~/hooks/storage/api-model"),
  useApiModel: () => mockApiModel,
}));

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useConfigErrors: () => mockUseConfigErrorsFn(),
  useIssues: () => mockUseIssues,
}));

// eslint-disable-next-line
const fakeLogicalVolume: LogicalVolume = {
  // @ts-expect-error: The #name property is used to distinguish new "devices"
  // in the API model, but it is not yet exposed for logical volumes since they
  // are currently not reusable. This directive exists to ensure developers
  // don't overlook updating the ProposalFailedInfo component in the future,
  // when logical volumes become reusable and the #name property is exposed. See
  // the FIXME in the ProposalFailedInfo component for more context.
  name: "Reusable LV",
  lvName: "helpful",
};

describe("ProposalFailedInfo", () => {
  beforeEach(() => {
    mockUseIssues = [];
    mockUseConfigErrorsFn.mockReturnValue([]);
  });

  describe("when proposal can't be created due to configuration errors", () => {
    beforeEach(() => {
      mockUseConfigErrorsFn.mockReturnValue([configError]);
    });

    it("renders nothing", () => {
      const { container } = installerRender(<ProposalFailedInfo />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when proposal is valid", () => {
    describe("and has no errors", () => {
      beforeEach(() => {
        mockUseIssues = [];
      });

      it("renders nothing", () => {
        const { container } = installerRender(<ProposalFailedInfo />);
        expect(container).toBeEmptyDOMElement();
      });
    });

    describe("but has errors", () => {
      beforeEach(() => {
        mockUseIssues = [storageIssue];
      });

      it("renders a warning alert with hints about the failure", () => {
        installerRender(<ProposalFailedInfo />);
        screen.getByText("Warning alert:");
        screen.getByText("Failed to calculate a storage layout");
        screen.getByText(/It is not possible to allocate space for/);
      });
    });
  });
});
