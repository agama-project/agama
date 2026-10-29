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
import { installerRender } from "~/test-utils";
import configModel from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { Partitionable } from "~/model/storage/config-model";
import PartitionableContent from "~/components/storage/device-sheet/PartitionableContent";

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => ({ drives: [{ name: "/dev/vdc" }] }),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useFlattenDevices: () => [],
}));

const entry: Entry = {
  config: { name: "/dev/vdc", partitions: [] } as Partitionable.Device,
  device: undefined,
  name: "vdc",
  isVolumeGroup: false,
};

const subject = { collection: "drives" as const, index: 0 };

describe("PartitionableContent", () => {
  describe("on a disk used only for booting", () => {
    beforeEach(() => jest.spyOn(configModel.boot, "hasDevice").mockReturnValue(true));
    afterEach(() => jest.restoreAllMocks());

    it("says it is used for booting only, in one line, and offers adding more", () => {
      installerRender(<PartitionableContent entry={entry} subject={subject} />);

      expect(screen.getByRole("paragraph")).toHaveTextContent(
        "Used for booting only, no other partitions planned yet",
      );
      screen.getByRole("link", { name: "Add partition" });
    });
  });
});
