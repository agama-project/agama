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
import GlobalActions from "~/components/storage/storage-page/GlobalActions";

const mockConfig = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

/* Each control is tested on its own. What matters here is which ones are offered. */
jest.mock("~/components/storage/storage-page/SingleDiskSpaceDecision", () => () => (
  <div role="group" aria-label="Allowed changes" />
));
jest.mock("~/components/storage/storage-page/ChangeInstallationDisk", () => () => (
  <button>Change installation disk</button>
));
jest.mock("~/components/storage/ConfigureDeviceMenu", () => ({ label }: { label: string }) => (
  <button>{label}</button>
));

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [{ name: "/dev/vda" }],
  mdRaids: [],
  volumeGroups: [],
  ...values,
});

describe("GlobalActions", () => {
  describe("when the installation uses a single disk", () => {
    beforeEach(() => {
      mockConfig.mockReturnValue(config());
    });

    it("offers changing that disk and adding more devices", () => {
      plainRender(<GlobalActions />);

      screen.getByRole("button", { name: "Change installation disk" });
      screen.getByRole("button", { name: "Add more devices" });
    });
  });

  describe("when the installation uses more than one disk", () => {
    beforeEach(() => {
      mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/vda" }, { name: "/dev/vdb" }] }));
    });

    it("offers only adding more devices", () => {
      plainRender(<GlobalActions />);

      expect(screen.queryByRole("button", { name: "Change installation disk" })).toBeNull();
      screen.getByRole("button", { name: "Add more devices" });
    });
  });

  it("includes the space decision for a single disk, which decides by itself whether to show", () => {
    mockConfig.mockReturnValue(config());
    plainRender(<GlobalActions />);

    screen.getByRole("group", { name: "Allowed changes" });
  });
});
