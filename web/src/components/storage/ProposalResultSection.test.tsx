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
import { installerRender } from "~/test-utils";
import { ProposalResultSection } from "~/components/storage";
import type { Storage as System } from "~/model/system";
import type { Storage as Proposal } from "~/model/proposal";

jest.mock("~/components/storage/ProposalResultTable", () => () => <div>result table</div>);

const mockFlattenDevices = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useFlattenDevices: () => mockFlattenDevices(),
}));

const mockActions = jest.fn();

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useFlattenDevices: () => [],
  useActions: () => mockActions(),
}));

const systemDevices: System.Device[] = [
  {
    sid: 83,
    name: "/dev/vda",
    class: "drive",
  },
];

const actions: Proposal.Action[] = [
  {
    device: 78,
    text: "",
    delete: true,
  },
  {
    device: 79,
    text: "",
    delete: false,
  },
  {
    device: 80,
    text: "",
    delete: true,
  },
];

describe("ProposalResultSection", () => {
  beforeEach(() => {
    mockFlattenDevices.mockReturnValue(systemDevices);
    mockActions.mockReturnValue(actions);
  });

  describe("when there are no delete actions", () => {
    beforeEach(() => {
      mockActions.mockReturnValue(actions.filter((a) => !a.delete));
    });

    it("does not render a warning when there are not delete actions", () => {
      installerRender(<ProposalResultSection />);
      expect(screen.queryByText(/destructive/)).not.toBeInTheDocument();
    });
  });

  describe("when there are delete actions affecting a previous system", () => {
    beforeEach(() => {
      // NOTE: simulate the deletion of vdc2 for checking that affected systems are rendered in the
      //  warning summary.
      mockFlattenDevices.mockReturnValue([
        {
          sid: 79,
          name: "/dev/vda1",
          class: "partition",
          block: {
            start: 0,
            size: 1024,
            systems: ["openSUSE"],
          },
        } as System.Device,
      ]);
      mockActions.mockReturnValue([{ device: 79, delete: true, text: "" }]);
    });

    it("renders the affected systems in the deletion reminder, if any", () => {
      installerRender(<ProposalResultSection />);
      expect(screen.queryByText(/affecting openSUSE/)).toBeInTheDocument();
    });
  });

  it("renders a reminder about the delete actions", () => {
    installerRender(<ProposalResultSection />);
    expect(screen.queryByText(/2 destructive/)).toBeInTheDocument();
  });

  it("renders the final layout", async () => {
    const { user } = installerRender(<ProposalResultSection />);
    const tab = screen.getByRole("tab", { name: /Final layout/ });

    await user.click(tab);
    expect(screen.queryByText(/result table/)).toBeInTheDocument();
  });
});
