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
import { StorageDevice } from "~/types/storage";
import { Issue } from "~/types/issues";

const disk: StorageDevice = {
  sid: 60,
  type: "disk",
  isDrive: true,
  description: "",
  vendor: "Seagate",
  model: "Unknown",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  name: "/dev/vda",
  size: 1e6,
};

const systemError: Issue = {
  description: "System error",
  kind: "storage",
  details: "",
  source: 1,
  severity: 1,
};

const configError: Issue = {
  description: "Config error",
  kind: "storage",
  details: "",
  source: 2,
  severity: 1,
};

const mockUseAvailableDevices = jest.fn();
const mockUseResetConfigMutation = jest.fn();
const mockUseDeprecated = jest.fn();
const mockUseDeprecatedChanges = jest.fn();
const mockUseReprobeMutation = jest.fn();
jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useResetConfigMutation: () => mockUseResetConfigMutation(),
  useDeprecated: () => mockUseDeprecated(),
  useDeprecatedChanges: () => mockUseDeprecatedChanges(),
  useReprobeMutation: () => mockUseReprobeMutation(),
}));

jest.mock("~/hooks/storage/system", () => ({
  ...jest.requireActual("~/hooks/storage/system"),
  useAvailableDevices: () => mockUseAvailableDevices(),
}));

const mockUseConfigModel = jest.fn();
jest.mock("~/queries/storage/config-model", () => ({
  ...jest.requireActual("~/queries/storage/config-model"),
  useConfigModel: () => mockUseConfigModel(),
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

const mockUseSystemErrors = jest.fn();
const mockUseConfigErrors = jest.fn();
jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useSystemErrors: () => mockUseSystemErrors(),
  useConfigErrors: () => mockUseConfigErrors(),
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
  mockUseResetConfigMutation.mockReturnValue({ mutate: jest.fn() });
  mockUseReprobeMutation.mockReturnValue({ mutateAsync: jest.fn() });
  mockUseDeprecated.mockReturnValue(false);
  mockUseSystemErrors.mockReturnValue([]);
  mockUseConfigErrors.mockReturnValue([]);
});

describe("if there are not devices", () => {
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

describe("if there is not a model", () => {
  beforeEach(() => {
    mockUseAvailableDevices.mockReturnValue([disk]);
    mockUseConfigModel.mockReturnValue(null);
  });

  describe("and there are system errors", () => {
    beforeEach(() => {
      mockUseSystemErrors.mockReturnValue([systemError]);
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

  describe("and there are not system errors", () => {
    beforeEach(() => {
      mockUseSystemErrors.mockReturnValue([]);
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
    mockUseConfigModel.mockReturnValue({ drives: [] });
  });

  describe("and there are config errors and system errors", () => {
    beforeEach(() => {
      mockUseConfigErrors.mockReturnValue([configError]);
      mockUseSystemErrors.mockReturnValue([systemError]);
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

  describe("and there are not config errors but there are system errors", () => {
    beforeEach(() => {
      mockUseSystemErrors.mockReturnValue([systemError]);
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
    beforeEach(() => {
      mockUseSystemErrors.mockReturnValue([]);
      mockUseConfigErrors.mockReturnValue([]);
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
