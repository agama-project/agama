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
import { installerRender } from "~/test-utils";
import WifiEnterpriseFields, { defaultEnterpriseSettings } from "./WifiEnterpriseFields";

const mockOnChange = jest.fn();

describe("WifiEnterpriseFields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("offers the inner authentication methods of the selected EAP method", () => {
    installerRender(
      <WifiEnterpriseFields value={defaultEnterpriseSettings} onChange={mockOnChange} />,
    );
    expect(screen.getByRole("combobox", { name: "Authentication" })).toHaveValue("peap");
    const innerAuth = screen.getByRole("combobox", { name: "Inner authentication" });
    expect(innerAuth).toHaveValue("mschapv2");
    expect(screen.queryByRole("option", { name: "PAP" })).toBeNull();
  });

  it("selects the default inner authentication when the EAP method changes", async () => {
    const { user } = installerRender(
      <WifiEnterpriseFields value={defaultEnterpriseSettings} onChange={mockOnChange} />,
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Authentication" }), "TTLS");
    expect(mockOnChange).toHaveBeenCalledWith({ eap: ["ttls"], phase2Auth: "pap" });
  });

  it.each([
    ["User name", "identity"],
    ["Password", "password"],
    ["Anonymous identity (optional)", "anonymousIdentity"],
  ])("does not keep an empty %s", async (label, key) => {
    const { user } = installerRender(
      <WifiEnterpriseFields
        value={{ ...defaultEnterpriseSettings, [key]: "a" }}
        onChange={mockOnChange}
      />,
    );
    await user.clear(screen.getByLabelText(label));
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.not.objectContaining({ [key]: expect.anything() }),
    );
  });

  it.each([[["tls"]], [[]]])("falls back to PEAP when the method is %j", (eap) => {
    installerRender(
      <WifiEnterpriseFields
        value={{ ...defaultEnterpriseSettings, eap }}
        onChange={mockOnChange}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Authentication" })).toHaveValue("peap");
    screen.getByRole("option", { name: "GTC" });
  });

  it("warns that the server certificate will not be verified", () => {
    installerRender(
      <WifiEnterpriseFields value={defaultEnterpriseSettings} onChange={mockOnChange} />,
    );
    screen.getByText("Server certificate will not be verified");
  });
});
