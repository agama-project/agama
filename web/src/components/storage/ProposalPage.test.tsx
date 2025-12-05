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

const disk = {
  name: "/dev/vda",
  description: "Seagate Unknown",
  size: 1e6,
};

const configIssue = {
  description: "Config error",
  class: "configNoRoot",
  scope: "storage",
};

const proposalIssue = {
  description: "Proposal error",
  class: "proposal",
  scope: "storage",
};

const unfixableIssue = {
  description: "System error",
  class: "systemError",
  scope: "storage",
};

const mockUseAvailableDevices = jest.fn();
const mockUseReset = jest.fn();
const mockUseStorageModel = jest.fn();
const mockUseProposal = jest.fn();
const mockUseIssues = jest.fn();

jest.mock("~/hooks/api/system/storage", () => ({
  ...jest.requireActual("~/hooks/api/system/storage"),
  useAvailableDevices: () => mockUseAvailableDevices(),
}));

jest.mock("~/hooks/api/config/storage", () => ({
  ...jest.requireActual("~/hooks/api/config/storage"),
  useReset: () => mockUseReset(),
}));

jest.mock("~/hooks/api/storage", () => ({
  ...jest.requireActual("~/hooks/api/storage"),
  useStorageModel: () => mockUseStorageModel(),
}));

jest.mock("~/hooks/api/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/api/proposal/storage"),
  useProposal: () => mockUseProposal(),
}));

jest.mock("~/hooks/api/issue", () => ({
  ...jest.requireActual("~/hooks/api/issue"),
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

jest.mock("./ProposalTransactionalInfo", () => () => <div>transactional info</div>);
jest.mock("./ProposalFailedInfo", () => () => <div>failed info</div>);
jest.mock("./UnsupportedModelInfo", () => () => <div>unsupported info</div>);
jest.mock("./ProposalResultSection", () => () => <div>result</div>);
jest.mock("./FixableConfigInfo", () => () => <div>fixable config info</div>);
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
  mockUseZFCPSupported.mockReturnValue(false);
  mockUseDASDSupported.mockReturnValue(false);
});

describe("if there are not devices", () => {
  beforeEach(() => {
    mockUseAvailableDevices.mockReturnValue([]);
    mockUseStorageModel.mockReturnValue({ drives: [] });
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

describe("if there is not a model", () => {
  beforeEach(() => {
    mockUseAvailableDevices.mockReturnValue([disk]);
    mockUseStorageModel.mockReturnValue(null);
  });

  describe("and there are unfixable issues", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([unfixableIssue]);
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

  describe("and there are config issues but no unfixable issues", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([configIssue]);
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

  describe("and there are no config issues and no proposal", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([]);
      mockUseProposal.mockReturnValue(null);
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

  describe("and there are no issues but there is a proposal", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([]);
      mockUseProposal.mockReturnValue({ drives: [] });
    });

    it("renders an unsupported model alert", async () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("unsupported info")).toBeInTheDocument();
    });

    it("does not render the installation devices", async () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("installation devices")).not.toBeInTheDocument();
    });

    it("renders the result", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("result")).toBeInTheDocument();
    });
  });
});

describe("if there is a model", () => {
  beforeEach(() => {
    mockUseAvailableDevices.mockReturnValue([disk]);
    mockUseStorageModel.mockReturnValue({ drives: [] });
  });

  describe("and there are config issues and unfixable issues", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([configIssue, unfixableIssue]);
    });

    it("renders the config errors", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("Config error")).toBeInTheDocument();
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

  describe("and there are no config issues but there are proposal issues", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([proposalIssue]);
      mockUseProposal.mockReturnValue(null);
    });

    it("renders the failed proposal info", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("failed info")).toBeInTheDocument();
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

  describe("and there are fixable config issues", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([configIssue]);
      mockUseProposal.mockReturnValue(null);
    });

    it("renders the fixable config info", () => {
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

  describe("and there are no issues and there is a proposal", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([]);
      mockUseProposal.mockReturnValue({ drives: [] });
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
