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
import { installerRender, mockRoutes } from "~/test-utils";
import StoragePageContent from "~/components/storage/storage-page/StoragePageContent";

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => ({
    drives: [{ name: "/dev/sda", partitions: [] }],
    mdRaids: [],
    volumeGroups: [],
  }),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: () => null,
}));

jest.mock("~/components/storage/storage-page/Result", () => () => (
  <button>what the configuration does</button>
));
jest.mock("~/components/storage/storage-page/TopLine", () => () => <button>boot disk</button>);
jest.mock("~/components/storage/entries-table/EntriesTable", () => () => <div>entries</div>);
jest.mock("~/components/storage/storage-page/GlobalActions", () => () => null);
jest.mock("~/components/storage/device-sheet/DeviceSheetHeading", () => () => "sda");
jest.mock("~/components/storage/device-sheet/DeviceDetail", () => () => null);
jest.mock("~/components/storage/entries-table/DriveMenu", () => () => null);

const report = () => screen.getByRole("button", { name: "what the configuration does" });
const setting = () => screen.getByRole("button", { name: "boot disk" });

describe("StoragePageContent", () => {
  it("reports what the configuration does before the page it is about", () => {
    installerRender(<StoragePageContent />);

    expect(report().compareDocumentPosition(setting())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  describe("while the sheet covers the page", () => {
    it("keeps the report within reach, so a change made in the sheet can be acted on", () => {
      mockRoutes("/storage?sheet=drives.0");
      installerRender(<StoragePageContent />);

      screen.getByRole("region", { name: "sda" });
      expect(report().closest("[inert]")).toBeNull();
    });

    it("puts the rest of the page out of reach", () => {
      mockRoutes("/storage?sheet=drives.0");
      installerRender(<StoragePageContent />);

      expect(setting().closest("[inert]")).not.toBeNull();
    });
  });
});
