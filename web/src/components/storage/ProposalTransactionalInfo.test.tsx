/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { ProposalTransactionalInfo } from "~/components/storage";
import { ProposalSettings, ProposalTarget, Volume, VolumeTarget } from "~/types/storage";

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useProduct: () => ({
    selectedProduct: { name: "Test" },
  }),
  useProductChanges: () => jest.fn(),
}));

const settings: ProposalSettings = {
  target: ProposalTarget.DISK,
  targetDevice: "/dev/sda",
  targetPVDevices: [],
  configureBoot: false,
  bootDevice: "",
  defaultBootDevice: "",
  encryptionPassword: "",
  encryptionMethod: "",
  spacePolicy: "delete",
  spaceActions: [],
  volumes: [],
  installationDevices: [],
};

const rootVolume: Volume = {
  mountPath: "/",
  target: VolumeTarget.DEFAULT,
  fsType: "Btrfs",
  minSize: 1024,
  maxSize: 2048,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: true,
    fsTypes: ["Btrfs", "Ext4"],
    supportAutoSize: true,
    snapshotsConfigurable: true,
    snapshotsAffectSizes: true,
    sizeRelevantVolumes: [],
    adjustByRam: false,
    productDefined: true,
  },
};

const props = { settings };

beforeEach(() => {
  settings.volumes = [];
});

describe("if the system is not transactional", () => {
  beforeEach(() => {
    settings.volumes = [rootVolume];
  });

  it("renders nothing", () => {
    const { container } = plainRender(<ProposalTransactionalInfo {...props} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("if the system is transactional", () => {
  beforeEach(() => {
    settings.volumes = [{ ...rootVolume, transactional: true }];
  });

  it("renders an explanation about the transactional system", () => {
    plainRender(<ProposalTransactionalInfo {...props} />);

    screen.getByText("Transactional root file system");
  });
});
