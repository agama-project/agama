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
import ConfigurationSummary from "~/components/storage/storage-page/ConfigurationSummary";

const mockConfig = jest.fn();
const mockSystemDevice = jest.fn();
const mockProposal = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: () => mockSystemDevice(),
}));

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useProposal: () => mockProposal(),
}));

jest.mock("./ConfigurationTitle", () => () => <>what the configuration does</>);
jest.mock("./Consequences", () => () => <>what the configuration costs</>);
jest.mock("./SpaceDecision", () => () => <>what may happen to what is there</>);
jest.mock("./DeviceSummary", () => () => <>why the configuration has no layout</>);
jest.mock("~/components/storage/entries-table/EntriesTable", () => () => (
  <>what the configuration is made of</>
));

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [],
  mdRaids: [],
  volumeGroups: [],
  ...values,
});

const guidance = "Review and configure the entries below.";
const spaceDecision = "what may happen to what is there";
const cost = "what the configuration costs";
const noLayout = "why the configuration has no layout";
const entries = "what the configuration is made of";

/** A disk with something already on it, which is what makes space a question. */
const usedDisk = { name: "/dev/vdd", partitions: [{ name: "/dev/vdd1" }] };

describe("ConfigurationSummary", () => {
  beforeEach(() => {
    mockSystemDevice.mockReturnValue(usedDisk);
    mockProposal.mockReturnValue({ actions: [] });
  });

  it("opens with what the configuration does", () => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/vdd" }] }));
    plainRender(<ConfigurationSummary />);

    expect(
      screen.getByRole("heading", { level: 2, name: "what the configuration does" }),
    ).toBeInTheDocument();
  });

  describe("when the configuration is a single device", () => {
    beforeEach(() => {
      mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/vdd" }] }));
    });

    it("reports what it costs, the same as any other configuration", () => {
      plainRender(<ConfigurationSummary />);

      expect(screen.getByText(cost)).toBeInTheDocument();
    });

    describe("and the installer worked out no layout for it", () => {
      beforeEach(() => {
        mockProposal.mockReturnValue(null);
      });

      it("says why, in place of what the configuration would have cost", () => {
        plainRender(<ConfigurationSummary />);

        screen.getByText(noLayout);
        expect(screen.queryByText(cost)).not.toBeInTheDocument();
      });
    });

    it("says nothing about a list, since there is none", () => {
      plainRender(<ConfigurationSummary />);

      expect(screen.queryByText(new RegExp(guidance))).not.toBeInTheDocument();
      expect(screen.queryByText(entries)).not.toBeInTheDocument();
    });

    it("offers the space decision, since there is one device it can be about", () => {
      plainRender(<ConfigurationSummary />);

      expect(screen.getByText(spaceDecision)).toBeInTheDocument();
    });

    describe("and there is nothing on it yet", () => {
      beforeEach(() => {
        mockSystemDevice.mockReturnValue({ name: "/dev/vdd", partitions: [] });
      });

      it("does not ask about existing content, since there is none", () => {
        plainRender(<ConfigurationSummary />);

        expect(screen.queryByText(spaceDecision)).not.toBeInTheDocument();
      });
    });
  });

  describe("when the configuration is several entries", () => {
    beforeEach(() => {
      mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/vda" }, { name: "/dev/vdb" }] }));
    });

    it("points the reader at the entries under it", () => {
      plainRender(<ConfigurationSummary />);

      expect(screen.getByText(new RegExp(guidance))).toBeInTheDocument();
    });

    it("lists what the configuration is made of", () => {
      plainRender(<ConfigurationSummary />);

      screen.getByText(entries);
    });

    it("reports what it costs, the same as a single device", () => {
      plainRender(<ConfigurationSummary />);

      expect(screen.getByText(cost)).toBeInTheDocument();
    });

    it("says nothing about one device having no room, since no device speaks for it", () => {
      mockProposal.mockReturnValue(null);
      plainRender(<ConfigurationSummary />);

      expect(screen.queryByText(noLayout)).not.toBeInTheDocument();
    });

    it("leaves the space decision to each row, since one answer cannot speak for two disks", () => {
      plainRender(<ConfigurationSummary />);

      expect(screen.queryByText(spaceDecision)).not.toBeInTheDocument();
    });
  });

  describe("when the only entry is a volume group", () => {
    beforeEach(() => {
      mockConfig.mockReturnValue(config({ volumeGroups: [{ vgName: "system" }] }));
    });

    it("points the reader at the entries under it, since no device speaks for it", () => {
      plainRender(<ConfigurationSummary />);

      expect(screen.getByText(new RegExp(guidance))).toBeInTheDocument();
    });
  });
});
