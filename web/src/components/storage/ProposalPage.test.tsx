/*
 * Copyright (c) [2022-2025] SUSE LLC
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

/*
 * NOTE: this test is not useful. The ProposalPage loads several queries but,
 * perhaps, each nested component should be responsible for loading the
 * information they need.
 */
import React from "react";
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import ProposalPage from "~/components/storage/ProposalPage";
import type { Storage } from "~/model/proposal";
import type { Issue } from "~/model/issue";

const disk: Storage.Device = {
  sid: 60,
  class: "drive",
  name: "/dev/vda",
  description: "Seagate disk",
  drive: { driver: ["ahci", "mmcblk"], bus: "IDE" },
  block: { start: 1, size: 1e6 },
};

const proposalIssue: Issue = {
  description: "No proposal",
  class: "proposal",
  scope: "storage",
};

const configFixableIssue: Issue = {
  description: "No root",
  class: "configNoRoot",
  scope: "storage",
};

const configUnfixableIssue: Issue = {
  description: "Config error",
  class: "something",
  scope: "storage",
};

const mockUseAvailableDevices = jest.fn();
const mockUseReset = jest.fn();
const mockUseConfigModel = jest.fn();
const mockUseProposal = jest.fn();
const mockUseIssues = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useAvailableDevices: () => mockUseAvailableDevices(),
}));

jest.mock("~/hooks/model/config/storage", () => ({
  ...jest.requireActual("~/hooks/model/config/storage"),
  useReset: () => mockUseReset(),
}));

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockUseConfigModel(),
}));

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useProposal: () => mockUseProposal(),
}));

jest.mock("~/hooks/model/issue", () => ({
  ...jest.requireActual("~/hooks/model/issue"),
  useIssues: () => mockUseIssues(),
}));

const mockUseZFCPSupported = jest.fn();
jest.mock("~/queries/storage/zfcp", () => ({
  ...jest.requireActual("~/queries/storage/zfcp"),
  useZFCPSupported: () => mockUseZFCPSupported(),
}));

const mockUseDASDSupported = jest.fn();
jest.mock("~/queries/storage/dasd", () => ({
  ...jest.requireActual("~/queries/storage/dasd"),
  useDASDSupported: () => mockUseDASDSupported(),
}));

jest.mock("./ProposalTransactionalInfo", () => () => <div>trasactional info</div>);
jest.mock("./ProposalFailedInfo", () => () => <div>proposal failed info</div>);
jest.mock("./UnsupportedModelInfo", () => () => <div>unsupported model info</div>);
jest.mock("./FixableConfigInfo", () => () => <div>fixable config info</div>);
jest.mock("./ProposalResultSection", () => () => <div>result</div>);
jest.mock("./ConfigEditor", () => () => <div>installation devices</div>);
jest.mock("./EncryptionSection", () => () => <div>encryption section</div>);
jest.mock("./BootSection", () => () => <div>boot section</div>);
jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>registration alert</div>
));

beforeEach(() => {
  mockUseReset.mockReturnValue(jest.fn());
  mockUseIssues.mockReturnValue([]);
  mockUseProposal.mockReturnValue(null);
  mockUseConfigModel.mockReturnValue({ drives: [] });
});

describe("if there are no devices", () => {
  beforeEach(() => {
    mockUseAvailableDevices.mockReturnValue([]);
  });

  it("renders an option for activating iSCSI", () => {
    installerRender(<ProposalPage />);
    expect(screen.queryByRole("link", { name: /iSCSI/ })).toBeInTheDocument();
  });

  it("does not render the installation devices", () => {
    installerRender(<ProposalPage />);
    expect(screen.queryByText("installation devices")).not.toBeInTheDocument();
  });

  it("does not render the result", () => {
    installerRender(<ProposalPage />);
    expect(screen.queryByText("result")).not.toBeInTheDocument();
  });

  describe("if zFCP is not supported", () => {
    beforeEach(() => {
      mockUseZFCPSupported.mockReturnValue(false);
    });

    it("does not render an option for activating zFCP", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByRole("link", { name: /zFCP/ })).not.toBeInTheDocument();
    });
  });

  describe("if DASD is not supported", () => {
    beforeEach(() => {
      mockUseDASDSupported.mockReturnValue(false);
    });

    it("does not render an option for activating DASD", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByRole("link", { name: /DASD/ })).not.toBeInTheDocument();
    });
  });

  describe("if zFCP is supported", () => {
    beforeEach(() => {
      mockUseZFCPSupported.mockReturnValue(true);
    });

    it("renders an option for activating zFCP", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByRole("link", { name: /zFCP/ })).toBeInTheDocument();
    });
  });

  describe("if DASD is supported", () => {
    beforeEach(() => {
      mockUseDASDSupported.mockReturnValue(true);
    });

    it("renders an option for activating DASD", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByRole("link", { name: /DASD/ })).toBeInTheDocument();
    });
  });
});

describe("if the UI does not support the current configuration (no model)", () => {
  beforeEach(() => {
    mockUseAvailableDevices.mockReturnValue([disk]);
    mockUseConfigModel.mockReturnValue(null);
  });

  describe("and there are unfixable config errors", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([configUnfixableIssue]);
    });

    it("renders a text explaining the settings are wrong", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("Invalid storage settings")).toBeInTheDocument();
    });

    it("renders an option for resetting the config", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByRole("button", { name: /Reset/ })).toBeInTheDocument();
    });

    it("does not render the installation devices", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("installation devices")).not.toBeInTheDocument();
    });

    it("does not render the result", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("result")).not.toBeInTheDocument();
    });
  });

  describe("and there are config errors but all of them are fixable", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([configFixableIssue]);
    });

    it("renders a text explaining the settings are wrong", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("Invalid storage settings")).toBeInTheDocument();
    });

    it("renders an option for resetting the config", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByRole("button", { name: /Reset/ })).toBeInTheDocument();
    });

    it("does not render the installation devices", async () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("installation devices")).not.toBeInTheDocument();
    });

    it("does not render the result", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("result")).not.toBeInTheDocument();
    });
  });

  describe("and there are no config errors but the proposal failed", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([proposalIssue]);
      mockUseProposal.mockReturnValue(null);
    });

    it("renders a text explaining the settings cannot be adjusted", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("Unable to modify the settings")).toBeInTheDocument();
    });

    it("renders an option for resetting the config", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByRole("button", { name: /Reset/ })).toBeInTheDocument();
    });

    it("does not render the installation devices", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("installation devices")).not.toBeInTheDocument();
    });

    it("does not render the result", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("result")).not.toBeInTheDocument();
    });
  });

  describe("and the proposal succeeded", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([]);
      mockUseProposal.mockReturnValue({ devices: [], actions: [] });
    });

    it("renders an info block explaining the settings cannot be adjusted", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("unsupported model info")).toBeInTheDocument();
    });

    it("does not render the installation devices", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("installation devices")).not.toBeInTheDocument();
    });

    it("renders the result", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("result")).toBeInTheDocument();
    });
  });
});

describe("if the UI supports the configuration (there is a model)", () => {
  beforeEach(() => {
    mockUseAvailableDevices.mockReturnValue([disk]);
    mockUseConfigModel.mockReturnValue({ drives: [] });
  });

  describe("and there are unfixable config errors", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([configUnfixableIssue]);
    });

    it("renders a text explaining the settings are wrong", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("Invalid storage settings")).toBeInTheDocument();
    });

    it("renders an option for resetting the config", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByRole("button", { name: /Reset/ })).toBeInTheDocument();
    });

    it("does not render the installation devices", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("installation devices")).not.toBeInTheDocument();
    });

    it("does not render the result", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("result")).not.toBeInTheDocument();
    });
  });

  describe("and there are config errors but all of them are fixable", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([configFixableIssue]);
    });

    it("renders an info block explaining the settings must be fixed", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("fixable config info")).toBeInTheDocument();
    });

    it("renders the installation devices", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("installation devices")).toBeInTheDocument();
    });

    it("does not render the result", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("result")).not.toBeInTheDocument();
    });
  });

  describe("and there are no config errors but the proposal failed", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([proposalIssue]);
      mockUseProposal.mockReturnValue(null);
    });

    it("renders an info block explaining the proposal failed", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("proposal failed info")).toBeInTheDocument();
    });

    it("renders the installation devices", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("installation devices")).toBeInTheDocument();
    });

    it("does not render the result", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("result")).not.toBeInTheDocument();
    });
  });

  describe("and the proposal succeeded", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([]);
      mockUseProposal.mockReturnValue({ devices: [], actions: [] });
    });

    it("renders the installation devices", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("installation devices")).toBeInTheDocument();
    });

    it("renders the result", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("result")).toBeInTheDocument();
    });
  });
});
