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
import { plainRender } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import SingleDiskSpaceDecision from "~/components/storage/storage-page/SingleDiskSpaceDecision";

const mockConfig = jest.fn();
const mockDevice = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: () => mockDevice(),
}));

/* The decision itself is tested on its own. What matters here is whether it
   is offered at all. */
jest.mock("~/components/storage/storage-page/SpaceDecision", () => () => (
  <div role="group" aria-label="Allowed changes" />
));

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [{ name: "/dev/vda" }],
  mdRaids: [],
  volumeGroups: [],
  ...values,
});

const disk = (partitions: System.Device[]): System.Device => ({
  sid: 1,
  name: "/dev/vda",
  class: "drive",
  partitions,
});

const partition: System.Device = { sid: 2, name: "/dev/vda1", class: "partition" };

describe("SingleDiskSpaceDecision", () => {
  beforeEach(() => {
    mockConfig.mockReturnValue(config());
    mockDevice.mockReturnValue(disk([partition]));
  });

  it("offers the decision where the installation uses one disk with partitions", () => {
    plainRender(<SingleDiskSpaceDecision />);

    screen.getByRole("group", { name: "Allowed changes" });
  });

  it("offers nothing where the disk holds no partitions", () => {
    mockDevice.mockReturnValue(disk([]));
    plainRender(<SingleDiskSpaceDecision />);

    expect(screen.queryByRole("group")).toBeNull();
  });

  it("offers nothing where the installation uses more than one disk", () => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/vda" }, { name: "/dev/vdb" }] }));
    plainRender(<SingleDiskSpaceDecision />);

    expect(screen.queryByRole("group")).toBeNull();
  });
});
