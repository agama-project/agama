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
import { getAnnouncements, installerRender } from "~/test-utils";
import type { Issue } from "~/model/issue";
import useAnnounceResult from "~/components/storage/storage-page/use-announce-result";

const mockConfigModel = jest.fn();
const mockAvailableDevices = jest.fn();
const mockProposal = jest.fn();
const mockIssues = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfigModel(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useAvailableDevices: () => mockAvailableDevices(),
}));

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useProposal: () => mockProposal(),
}));

jest.mock("~/hooks/model/issue", () => ({
  ...jest.requireActual("~/hooks/model/issue"),
  useIssues: () => mockIssues(),
}));

/* Each report is tested on its own. What matters here is which one is shown. */
jest.mock("~/components/storage/storage-page/Consequences", () => ({
  __esModule: true,
  default: () => <p>consequences</p>,
  summaryOf: (actions: unknown[]) => `It takes ${actions.length} actions.`,
}));
jest.mock("~/components/storage/ProposalFailedInfo", () => ({
  __esModule: true,
  default: () => <p>failed</p>,
  proposalFailedTitle: () => "No layout can be calculated.",
}));
jest.mock("~/components/storage/FixableConfigInfo", () => ({
  __esModule: true,
  default: () => <p>fixable</p>,
  fixableConfigTitle: () => "There are issues to fix.",
}));

const issue = (klass: string): Issue => ({ description: klass, class: klass, scope: "storage" });

/** Only runs the hook: what it says is said through the announcer. */
function Announcer() {
  useAnnounceResult();
  return null;
}

describe("useAnnounceResult", () => {
  beforeEach(() => {
    mockConfigModel.mockReturnValue({ drives: [] });
    mockAvailableDevices.mockReturnValue([{ sid: 1 }]);
    mockProposal.mockReturnValue({ actions: [{}, {}, {}] });
    mockIssues.mockReturnValue([]);
  });

  it("says nothing while a state replaces the page", () => {
    const { rerender } = installerRender(<Announcer />);
    mockAvailableDevices.mockReturnValue([]);
    rerender(<Announcer />);

    expect(getAnnouncements()).toEqual([]);
  });

  describe("when a change turns the report into another kind", () => {
    it("says nothing about the report it starts with", () => {
      installerRender(<Announcer />);

      expect(getAnnouncements()).toEqual([]);
    });

    it("says the problem once the layout can no longer be calculated", () => {
      const { rerender } = installerRender(<Announcer />);
      mockProposal.mockReturnValue(null);
      mockIssues.mockReturnValue([issue("proposal")]);
      rerender(<Announcer />);

      expect(getAnnouncements()).toEqual(["No layout can be calculated."]);
    });

    it("says what is left to fix once the configuration has issues", () => {
      const { rerender } = installerRender(<Announcer />);
      mockProposal.mockReturnValue(null);
      mockIssues.mockReturnValue([issue("configNoRoot"), issue("proposal")]);
      rerender(<Announcer />);

      expect(getAnnouncements()).toEqual(["There are issues to fix."]);
    });

    it("says the plan once a layout can be calculated again", () => {
      mockProposal.mockReturnValue(null);
      mockIssues.mockReturnValue([issue("proposal")]);
      const { rerender } = installerRender(<Announcer />);
      mockProposal.mockReturnValue({ actions: [{}, {}, {}] });
      mockIssues.mockReturnValue([]);
      rerender(<Announcer />);

      expect(getAnnouncements()).toEqual(["It takes 3 actions."]);
    });

    it("says nothing when only the number of actions changes", () => {
      const { rerender } = installerRender(<Announcer />);
      mockProposal.mockReturnValue({ actions: [{}, {}, {}, {}, {}] });
      rerender(<Announcer />);

      expect(getAnnouncements()).toEqual([]);
    });

    it("says nothing when one problem gives way to another", () => {
      mockProposal.mockReturnValue(null);
      mockIssues.mockReturnValue([issue("configNoRoot"), issue("proposal")]);
      const { rerender } = installerRender(<Announcer />);
      mockIssues.mockReturnValue([issue("proposal")]);
      rerender(<Announcer />);

      expect(getAnnouncements()).toEqual([]);
    });
  });
});
