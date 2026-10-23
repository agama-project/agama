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
import ConfigDialog from "./ConfigDialog";
import { plainRender } from "~/test-utils";

const mockIsoTimestamp = jest.fn();
jest.mock("~/utils", () => ({
  ...jest.requireActual("~/utils"),
  isoTimestamp: () => mockIsoTimestamp(),
}));

// Monaco editor used in <ConfigEditor> is too heavy to render in tests
jest.mock(
  "~/components/core/ConfigEditor",
  () =>
    ({
      onChange,
      onValidationChange,
    }: {
      onChange?: (code: string) => void;
      onValidationChange?: (isValid: boolean) => void;
    }) => (
      <div>
        <div>ConfigEditor Mock</div>
        <button
          onClick={() => {
            onChange?.('{"software":{"product":"Agama"}}');
            onValidationChange?.(true);
          }}
          aria-label="Set Valid Config"
        >
          Set Valid
        </button>
        <button
          onClick={() => {
            onChange?.("{invalid-json}");
            onValidationChange?.(false);
          }}
          aria-label="Set Invalid Config"
        >
          Set Invalid
        </button>
        <button
          onClick={() => {
            onChange?.('{"software":{"unknownProp":123}}');
            onValidationChange?.(false);
          }}
          aria-label="Set Schema Invalid Config"
        >
          Set Schema Invalid
        </button>
      </div>
    ),
);

const mockPutConfig = jest.fn();
jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  putConfig: (config: unknown) => mockPutConfig(config),
}));

const mockOnClose = jest.fn();
global.fetch = jest.fn();

const renderConfigDialog = () => {
  const { user } = plainRender(<ConfigDialog onClose={mockOnClose} />);
  return { user };
};

describe("ConfigDialog", () => {
  beforeEach(() => {
    mockOnClose.mockReset();
    mockPutConfig.mockReset();
  });

  it("renders the dialog with the correct title", async () => {
    renderConfigDialog();
    await screen.findByText("ConfigEditor Mock");
    screen.getByRole("dialog", { name: "Installation settings in JSON format" });
  });

  it("calls onClose when the close button is clicked", async () => {
    const { user } = renderConfigDialog();
    await screen.findByText("ConfigEditor Mock");
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    await user.click(closeButtons[1]);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("disables Apply button until config is loaded", async () => {
    renderConfigDialog();
    await screen.findByText("ConfigEditor Mock");
    const applyButton = screen.getByRole("button", { name: "Apply" });
    expect(applyButton).toBeDisabled();
  });

  it("disables Apply button when invalid JSON is entered", async () => {
    const { user } = renderConfigDialog();
    await screen.findByText("ConfigEditor Mock");

    await user.click(screen.getByRole("button", { name: "Set Invalid Config" }));
    const applyButton = screen.getByRole("button", { name: "Apply" });
    expect(applyButton).toBeDisabled();
  });

  it("disables Apply button when schema validation fails", async () => {
    const { user } = renderConfigDialog();
    await screen.findByText("ConfigEditor Mock");

    await user.click(screen.getByRole("button", { name: "Set Schema Invalid Config" }));
    const applyButton = screen.getByRole("button", { name: "Apply" });
    expect(applyButton).toBeDisabled();
  });

  it("applies valid config and closes dialog when Apply is clicked", async () => {
    mockPutConfig.mockResolvedValue({});
    const { user } = renderConfigDialog();
    await screen.findByText("ConfigEditor Mock");

    await user.click(screen.getByRole("button", { name: "Set Valid Config" }));

    const applyButton = screen.getByRole("button", { name: "Apply" });
    expect(applyButton).toBeEnabled();

    await user.click(applyButton);
    expect(mockPutConfig).toHaveBeenCalledWith({ software: { product: "Agama" } });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("shows an error alert with expandable details when putConfig fails", async () => {
    mockPutConfig.mockRejectedValue({
      response: {
        data: {
          title: "Schema Validation Failed",
          detail: "Configuration does not match schema",
          errors: ["/software/product: is required"],
        },
      },
    });

    const { user } = renderConfigDialog();
    await screen.findByText("ConfigEditor Mock");

    await user.click(screen.getByRole("button", { name: "Set Valid Config" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mockPutConfig).toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(screen.getByText("Schema Validation Failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show details" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show details" }));
    expect(
      screen.getByText(
        /Configuration does not match schema[\s\S]*\/software\/product: is required/,
      ),
    ).toBeInTheDocument();
  });
});
