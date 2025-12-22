/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { plainRender } from "~/test-utils";
import ProposalTransactionalInfo from "./ProposalTransactionalInfo";
import type { Storage as System } from "~/model/system";

jest.mock("~/hooks/model/config", () => ({
  ...jest.requireActual("~/hooks/model/config"),
  useProduct: () => ({ name: "Test" }),
}));

const mockVolumeTemplates = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useVolumeTemplates: () => mockVolumeTemplates(),
}));

const rootVolume: System.Volume = {
  mountPath: "/",
  mountOptions: [],
  autoSize: false,
  minSize: 1024,
  maxSize: 2048,
  fsType: "btrfs",
  snapshots: false,
  transactional: false,
  outline: {
    required: true,
    fsTypes: ["btrfs", "ext4"],
    supportAutoSize: true,
    snapshotsConfigurable: true,
    snapshotsAffectSizes: true,
    sizeRelevantVolumes: [],
    adjustByRam: false,
  },
};

describe("if the system is not transactional", () => {
  beforeEach(() => {
    mockVolumeTemplates.mockReturnValue([rootVolume]);
  });

  it("renders nothing", () => {
    const { container } = plainRender(<ProposalTransactionalInfo />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("if the system is transactional", () => {
  beforeEach(() => {
    mockVolumeTemplates.mockReturnValue([{ ...rootVolume, transactional: true }]);
  });

  it("renders an explanation about the transactional system", () => {
    plainRender(<ProposalTransactionalInfo />);

    screen.getByText("Transactional root file system");
  });
});
