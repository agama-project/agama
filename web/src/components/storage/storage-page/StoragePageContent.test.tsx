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

const mockPageState = jest.fn();
jest.mock("~/components/storage/storage-page/use-page-state", () => ({
  usePageState: () => mockPageState(),
}));
jest.mock("~/components/storage/storage-page/use-announce-result", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock("~/components/storage/storage-page/StorageEmptyState", () => ({
  __esModule: true,
  default: ({ state }) => <p>empty state: {state.kind}</p>,
}));
/* The page's own line holds the settings; the report of what the configuration
   does is the result line kept in sight above it. */
jest.mock("~/components/storage/storage-page/TopLine", () => ({
  __esModule: true,
  default: () => <button>boot disk</button>,
  TopResult: () => <button>what the configuration does</button>,
}));
jest.mock("~/components/storage/entries-table/EntriesTable", () => () => <div>entries</div>);
jest.mock("~/components/storage/storage-page/GlobalActions", () => () => null);
jest.mock("~/components/storage/device-details/DeviceDetailsHeading", () => () => "sda");
jest.mock("~/components/storage/device-details/DeviceDetailsBody", () => () => null);
jest.mock("~/components/storage/entries-table/DriveMenu", () => () => null);

const report = () => screen.getByRole("button", { name: "what the configuration does" });
const setting = () => screen.getByRole("button", { name: "boot disk" });

describe("StoragePageContent", () => {
  beforeEach(() => {
    mockPageState.mockReturnValue({ kind: "page" });
  });

  describe.each([
    { kind: "noDevices" },
    { kind: "invalid", issues: [] },
    { kind: "unknown", hasProposal: false },
    { kind: "unknown", hasProposal: true },
  ])("when the state is %j", (state) => {
    it("shows the empty state instead of the page", () => {
      mockPageState.mockReturnValue(state);
      installerRender(<StoragePageContent />);

      screen.getByText(`empty state: ${state.kind}`);
      expect(screen.queryByRole("button", { name: "boot disk" })).toBeNull();
      expect(screen.queryByRole("button", { name: "what the configuration does" })).toBeNull();
      expect(screen.queryByText("entries")).toBeNull();
    });
  });

  it("reports what the configuration does before the page it is about", () => {
    installerRender(<StoragePageContent />);

    expect(report().compareDocumentPosition(setting())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  describe("while the panel covers the page", () => {
    it("keeps the report within reach, so a change made in the panel can be acted on", () => {
      mockRoutes("/storage?device=drives.sda");
      installerRender(<StoragePageContent />);

      screen.getByRole("region", { name: "sda" });
      expect(report().closest("[inert]")).toBeNull();
    });

    it("puts the rest of the page out of reach", () => {
      mockRoutes("/storage?device=drives.sda");
      installerRender(<StoragePageContent />);

      expect(setting().closest("[inert]")).not.toBeNull();
    });
  });
});
