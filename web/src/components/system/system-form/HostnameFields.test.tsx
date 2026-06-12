/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { installerRender, mockSystem } from "~/test-utils";
import { useAppForm } from "~/hooks/form";
import { defaultOptions } from "./fields";
import HostnameFields from "./HostnameFields";

function TestForm({ defaultValues = {} }: { defaultValues?: object }) {
  const form = useAppForm({
    ...defaultOptions,
    defaultValues: {
      ...defaultOptions.defaultValues,
      ...defaultValues,
    },
  });

  return <HostnameFields form={form} />;
}

describe("HostnameFields", () => {
  beforeEach(() => {
    mockSystem({});
  });

  it("renders the Hostname fieldset", () => {
    installerRender(<TestForm />);
    screen.getByRole("group", { name: "Hostname" });
  });

  it("renders Mode dropdown", () => {
    installerRender(<TestForm />);
    screen.getByLabelText("Mode");
  });

  describe("when mode is transient", () => {
    const defaultValues = { hostnameMode: "transient", hostnameValue: "linux-abc" };

    it("renders read-only Name field", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      screen.getByText("linux-abc");
      expect(screen.queryByRole("textbox", { name: "Name" })).not.toBeInTheDocument();
    });

    it("shows transient mode helper text", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      screen.getByText(/may change after a reboot or network update/);
    });

    it("wraps emphasized text in strong element", () => {
      const { container } = installerRender(<TestForm defaultValues={defaultValues} />);
      const strong = container.querySelector("strong");
      expect(strong).toBeInTheDocument();
      expect(strong).toHaveTextContent(/may change after a reboot or network update/);
    });

    it("does not show static mode helper text", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.queryByText(/will remain unchanged/)).not.toBeInTheDocument();
    });
  });

  describe("when mode is static", () => {
    const defaultValues = { hostnameMode: "static", hostnameValue: "my-server" };

    it("renders editable Name field", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      const nameField = screen.getByRole("textbox", { name: "Name" });
      expect(nameField).toHaveValue("my-server");
      expect(nameField).not.toHaveAttribute("readonly");
    });

    it("shows static mode helper text", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      screen.getByText(/will remain unchanged/);
    });

    it("does not show transient mode helper text", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.queryByText(/may change after a reboot/)).not.toBeInTheDocument();
    });
  });

  describe("aria-live announcements", () => {
    it("announces helper text changes to screen readers via aria-live", () => {
      const { container } = installerRender(<TestForm />);
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
    });
  });

  describe("mode switching", () => {
    it("switches from transient to static mode", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ hostnameMode: "transient", hostnameValue: "temp-name" }} />,
      );

      const modeButton = screen.getByLabelText("Mode");
      await user.click(modeButton);

      const staticOption = screen.getByRole("option", { name: /Static/ });
      await user.click(staticOption);

      screen.getByRole("textbox", { name: "Name" });
      screen.getByText(/will remain unchanged/);
    });

    it("switches from static to transient mode", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ hostnameMode: "static", hostnameValue: "static-name" }} />,
      );

      const modeButton = screen.getByLabelText("Mode");
      await user.click(modeButton);

      const transientOption = screen.getByRole("option", { name: /Transient/ });
      await user.click(transientOption);

      screen.getByText("static-name");
      expect(screen.queryByRole("textbox", { name: "Name" })).not.toBeInTheDocument();
      screen.getByText(/may change after a reboot/);
    });
  });

  describe("registration alert", () => {
    it("does not render when product is not registered", () => {
      mockSystem({});
      installerRender(<TestForm />);
      expect(screen.queryByText("Registered hostname will not change")).not.toBeInTheDocument();
    });

    it("renders when product is registered", () => {
      mockSystem({
        software: {
          registration: {
            code: "12345",
          },
        },
      });
      installerRender(<TestForm />);
      screen.getByText("Registered hostname will not change");
      screen.getByText(/Hostname changes will not affect the hostname stored/);
    });
  });
});
