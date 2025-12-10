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
import { Device } from "~/api/system/storage";
import type { Issue } from "~/api/issue";
import { storage as proposalStorage } from "~/api/proposal";
import { model as storageModel } from "~/api/storage";

const disk: Device = {
  sid: 60,
  name: "/dev/vda",
  description: "",
  class: "drive",
  drive: {
    type: "disk",
    vendor: "Seagate",
    model: "Unknown",
    driver: ["ahci", "mmcblk"],
    bus: "IDE",
  },
  block: {
    size: 1e6,
    start: 0,
    shrinking: {
      supported: false,
    },
  },
};

const mockProposal: proposalStorage.Proposal = {
  devices: [],
  actions: [],
};

const systemError: Issue = {
  description: "System error",
  class: "system",
  scope: "storage",
};

const configError: Issue = {
  description: "Config error",
  class: "config",
  scope: "storage",
};

const mockUseAvailableDevices = jest.fn();
const mockUseReset = jest.fn();
const mockUseProposal = jest.fn();
const mockActivateStorageAction = jest.fn();

jest.mock("~/hooks/api/system/storage", () => ({
  ...jest.requireActual("~/hooks/api/system/storage"),
  useAvailableDevices: () => mockUseAvailableDevices(),
}));

jest.mock("~/hooks/api/config/storage", () => ({
  ...jest.requireActual("~/hooks/api/config/storage"),
  useReset: () => mockUseReset(),
}));

jest.mock("~/hooks/api/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/api/proposal/storage"),
  useProposal: () => mockUseProposal(),
}));

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  activateStorageAction: () => mockActivateStorageAction(),
}));

const mockUseStorageModel = jest.fn();
jest.mock("~/hooks/api/storage", () => ({
  ...jest.requireActual("~/hooks/api/storage"),
  useStorageModel: () => mockUseStorageModel(),
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

const mockUseIssues = jest.fn();
jest.mock("~/hooks/api/issue", () => ({
  ...jest.requireActual("~/hooks/api/issue"),
  useIssues: () => mockUseIssues(),
}));

jest.mock("./ProposalTransactionalInfo", () => () => <div>trasactional info</div>);
jest.mock("./ProposalFailedInfo", () => () => <div>failed info</div>);
jest.mock("./UnsupportedModelInfo", () => () => <div>unsupported info</div>);
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
  mockUseStorageModel.mockReturnValue(null);
  mockUseAvailableDevices.mockReturnValue([]);
  mockUseZFCPSupported.mockReturnValue(false);
  mockUseDASDSupported.mockReturnValue(false);
});

describe("if there are not devices", () => {
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
    it("does not render an option for activating zFCP", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByRole("link", { name: /zFCP/ })).not.toBeInTheDocument();
    });
  });

  describe("if DASD is not supported", () => {
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
  });

  describe("and there are issues", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([systemError]);
    });

    it("renders an option for resetting the config", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByRole("button", { name: /reset/i })).toBeInTheDocument();
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

  describe("and there are not issues", () => {
    it("renders an unsupported model alert", async () => {
      mockUseProposal.mockReturnValue(mockProposal);
      installerRender(<ProposalPage />);
      expect(screen.queryByText("unsupported info")).toBeInTheDocument();
    });

    it("does not render the installation devices", async () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("installation devices")).not.toBeInTheDocument();
    });

    it("renders the result", () => {
      mockUseProposal.mockReturnValue(mockProposal);
      installerRender(<ProposalPage />);
      expect(screen.queryByText("result")).toBeInTheDocument();
    });
  });
});

describe("if there is a model", () => {
  beforeEach(() => {
    mockUseAvailableDevices.mockReturnValue([disk]);
    const model: storageModel.Config = { drives: [] };
    mockUseStorageModel.mockReturnValue(model);
  });

  describe("and there are issues", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([configError, systemError]);
    });

    it("renders the config errors", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("Config error")).toBeInTheDocument();
    });

    it("renders an option for resetting the config", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByRole("button", { name: /reset/i })).toBeInTheDocument();
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

  describe("and there are only proposal errors", () => {
    beforeEach(() => {
      const proposalError: Issue = {
        description: "Proposal error",
        class: "proposal",
        scope: "storage",
      };
      mockUseIssues.mockReturnValue([proposalError]);
    });

    it("renders a failed proposal failed", () => {
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

  describe("and there are neither config errors nor system errors", () => {
    it("renders the installation devices", () => {
      installerRender(<ProposalPage />);
      expect(screen.queryByText("installation devices")).toBeInTheDocument();
    });

    it("renders the result", () => {
      mockUseProposal.mockReturnValue(mockProposal);
      installerRender(<ProposalPage />);
      expect(screen.queryByText("result")).toBeInTheDocument();
    });
  });
});
