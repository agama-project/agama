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
import { act, screen, waitFor } from "@testing-library/react";
import { installerRender, mockProduct, mockProductConfig, mockL10n } from "~/test-utils";
import { Product } from "~/model/system";
import { RegistrationInfo } from "~/model/system/software";
import { Config } from "~/model/config";
import { putConfig } from "~/api";
import { Issue } from "~/model/issue";
import useTrackQueriesRefetch from "~/hooks/use-track-queries-refetch";
import ProductRegistrationForm from "./ProductRegistrationForm";

const sle: Product = {
  id: "sle",
  name: "SLE",
  registration: true,
  modes: [],
};

let mockRegistrationInfo: RegistrationInfo | undefined;
let mockConfig: Config;
let mockIssues: Issue[] = [];

jest.mock("~/hooks/use-track-queries-refetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseTrackQueriesRefetch = jest.mocked(useTrackQueriesRefetch);

jest.mock("~/hooks/model/system/software", () => ({
  useSystem: () => ({ registration: mockRegistrationInfo }),
}));

jest.mock("~/hooks/model/config", () => ({
  useConfig: () => mockConfig,
}));

jest.mock("~/hooks/model/issue", () => ({
  useIssues: () => mockIssues,
}));

jest.mock("~/api", () => ({
  putConfig: jest.fn(),
}));

describe("ProductRegistrationForm", () => {
  beforeEach(() => {
    mockConfig = { product: { id: "sle", mode: "standard", registrationCode: "" } };
    mockIssues = [];
    mockProductConfig(mockConfig.product);
    mockProduct(sle);
    mockL10n({ keymap: "us", language: "en-US" });
    mockRegistrationInfo = undefined;

    // Set up default mock for useTrackQueriesRefetch - called twice (system + issues)
    mockUseTrackQueriesRefetch.mockReturnValue({
      startTracking: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("allows registering the product without an email address", async () => {
    const { user } = installerRender(<ProductRegistrationForm />);
    const registrationCodeInput = screen.getByLabelText("Registration code");
    const submitButton = screen.getByRole("button", { name: "Register" });

    await user.type(registrationCodeInput, "INTERNAL-USE-ONLY-1234-5678");

    await user.click(submitButton);

    await waitFor(() => {
      expect(putConfig).toHaveBeenCalledWith({
        ...mockConfig,
        product: {
          id: "sle",
          mode: "standard",
          registrationCode: "INTERNAL-USE-ONLY-1234-5678",
          registrationEmail: undefined,
          registrationUrl: undefined,
        },
      });
    });
  });

  it("allows registering the product with an email address", async () => {
    const { user } = installerRender(<ProductRegistrationForm />);
    const registrationCodeInput = screen.getByLabelText("Registration code");
    const emailInput = screen.getByRole("textbox", { name: /Email/ });
    const submitButton = screen.getByRole("button", { name: "Register" });

    await user.type(registrationCodeInput, "INTERNAL-USE-ONLY-1234-5678");
    await user.type(emailInput, "example@company.test");

    await user.click(submitButton);

    await waitFor(() => {
      expect(putConfig).toHaveBeenCalledWith({
        ...mockConfig,
        product: {
          id: "sle",
          mode: "standard",
          registrationCode: "INTERNAL-USE-ONLY-1234-5678",
          registrationEmail: "example@company.test",
          registrationUrl: undefined,
        },
      });
    });
  });

  it("allows registering using a custom server", async () => {
    const { user } = installerRender(<ProductRegistrationForm />);
    const registrationServerButton = screen.getByRole("button", { name: "Registration server" });
    await user.click(registrationServerButton);
    const customServer = screen.getByRole("option", { name: /^Custom/ });
    await user.click(customServer);
    const serverUrlInput = screen.getByRole("textbox", { name: "Server URL" });
    await user.type(serverUrlInput, "https://custom-server.test");
    const submitButton = screen.getByRole("button", { name: "Register" });

    await user.click(submitButton);
    await waitFor(() => {
      expect(putConfig).toHaveBeenCalledWith({
        ...mockConfig,
        product: {
          id: "sle",
          mode: "standard",
          registrationUrl: "https://custom-server.test",
          registrationCode: undefined,
          registrationEmail: undefined,
        },
      });
    });
  });

  describe("if registering with the default server", () => {
    it("shows an error when no registration code is provided", async () => {
      const { user } = installerRender(<ProductRegistrationForm />);
      const submitButton = screen.getByRole("button", { name: "Register" });

      await user.click(submitButton);

      expect(putConfig).not.toHaveBeenCalled();
      await screen.findByText("Enter a registration code");
    });
  });

  describe("if registering with a custom server", () => {
    it("shows an error when no server URL is provided", async () => {
      const { user } = installerRender(<ProductRegistrationForm />);
      const registrationServerButton = screen.getByRole("button", {
        name: "Registration server",
      });
      await user.click(registrationServerButton);
      const customServer = screen.getByRole("option", { name: /^Custom/ });
      await user.click(customServer);
      const submitButton = screen.getByRole("button", { name: "Register" });
      await user.click(submitButton);

      expect(putConfig).not.toHaveBeenCalled();
      await screen.findByText("Enter a server URL");
    });

    it("allows providing an optional registration code", async () => {
      const { user } = installerRender(<ProductRegistrationForm />);
      const registrationServerButton = screen.getByRole("button", {
        name: "Registration server",
      });
      await user.click(registrationServerButton);
      const customServer = screen.getByRole("option", { name: /^Custom/ });
      await user.click(customServer);
      const serverUrlInput = screen.getByRole("textbox", { name: "Server URL" });
      await user.type(serverUrlInput, "https://custom-server.test");
      const registrationCodeInput = screen.getByLabelText(/Registration code/);
      await user.type(registrationCodeInput, "INTERNAL-USE-ONLY-1234-5678");
      const submitButton = screen.getByRole("button", { name: "Register" });
      await user.click(submitButton);

      await waitFor(() => {
        expect(putConfig).toHaveBeenCalledWith({
          ...mockConfig,
          product: {
            id: "sle",
            mode: "standard",
            registrationUrl: "https://custom-server.test",
            registrationCode: "INTERNAL-USE-ONLY-1234-5678",
            registrationEmail: undefined,
          },
        });
      });
    });
  });

  describe("when the registration failed", () => {
    beforeEach(() => {
      mockIssues = [
        {
          scope: "software",
          class: "system_registration_failed",
          description: "Unauthorized code",
        },
      ];
    });

    it("renders errors returned by the registration server", async () => {
      installerRender(<ProductRegistrationForm />);

      screen.getByText("Danger alert:");
      screen.getByText("Unauthorized code");
    });

    it("allows dismissing the error and clearing the registration data", async () => {
      const { user } = installerRender(<ProductRegistrationForm />);

      const button = screen.getByRole("button", { name: "Dismiss and clear registration data" });
      await user.click(button);
      expect(putConfig).toHaveBeenCalledWith({
        ...mockConfig,
        product: {
          id: "sle",
          mode: "standard",
        },
      });
    });
  });

  describe("loading state", () => {
    it("shows loading state when submitting registration", async () => {
      const { user } = installerRender(<ProductRegistrationForm />);
      const registrationCodeInput = screen.getByLabelText("Registration code");
      const submitButton = screen.getByRole("button", { name: "Register" });

      await user.type(registrationCodeInput, "INTERNAL-USE-ONLY-1234-5678");
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(submitButton).toHaveAttribute("aria-describedby");
      });

      screen.getByText("Registration in progress");
    });

    it("hides registration issue alert during loading", async () => {
      mockIssues = [
        {
          scope: "software",
          class: "system_registration_failed",
          description: "Unauthorized code",
        },
      ];

      const { user } = installerRender(<ProductRegistrationForm />);

      screen.getByText("Unauthorized code");

      const registrationCodeInput = screen.getByLabelText("Registration code");
      const submitButton = screen.getByRole("button", { name: "Register" });

      await user.clear(registrationCodeInput);
      await user.type(registrationCodeInput, "ANOTHER-CODE-1234-5678");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText("Unauthorized code")).not.toBeInTheDocument();
      });
    });

    // The component uses useTrackQueriesRefetch to track the system query.
    // Mock the hook to capture the callback, which gets called when the tracked
    // query refetches. In real usage, the backend sends a SystemChanged event
    // after putConfig (success or failure), triggering the query to refetch with
    // fresh data (dataUpdatedAt > startTracking timestamp). The callback then
    // fires, stopping the loading state. Here simulate that by manually invoking
    // the callback after updating mockIssues.
    it("stops loading when registration fails", async () => {
      let mockCallback: (startedAt: number, completedAt: number) => void;

      mockUseTrackQueriesRefetch.mockImplementation((keys, callback) => {
        mockCallback = callback;
        return { startTracking: jest.fn() };
      });

      const { user } = installerRender(<ProductRegistrationForm />);
      const registrationCodeInput = screen.getByLabelText("Registration code");
      const submitButton = screen.getByRole("button", { name: "Register" });

      await user.type(registrationCodeInput, "INVALID-CODE");
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
      screen.getByText("Registration in progress");

      mockIssues = [
        {
          scope: "software",
          class: "system_registration_failed",
          description: "Invalid registration code",
        },
      ];

      // Simulate query refetch completion by calling the callback
      const startedAt = Date.now();
      act(() => {
        mockCallback(startedAt, startedAt + 100);
      });

      await waitFor(() => {
        expect(screen.queryByText("Registration in progress")).not.toBeInTheDocument();
      });

      screen.getByText("Invalid registration code");

      screen.getByRole("button", { name: "Dismiss and clear registration data" });
    });

    it("re-enables button when backend returns same registration issue object", async () => {
      const sameIssue = {
        scope: "software" as const,
        class: "system_registration_failed",
        description: "Unauthorized code",
      };

      mockIssues = [sameIssue];

      const { user, rerender } = installerRender(<ProductRegistrationForm />);
      const submitButton = screen.getByRole("button", { name: "Register" });

      await user.click(submitButton);

      rerender(<ProductRegistrationForm />);

      expect(submitButton).not.toBeDisabled();
      screen.getByText("Unauthorized code");

      await user.click(submitButton);

      rerender(<ProductRegistrationForm />);

      expect(submitButton).not.toBeDisabled();
      screen.getByText("Unauthorized code");
    });
  });
});
