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
import { useAppForm } from "~/hooks/form";
import { systemFormOptions } from "~/components/system/SystemPage";
import NtpSettings from "./NtpSettings";

function TestForm({ defaultValues = {} }: { defaultValues?: object }) {
  const form = useAppForm({
    ...systemFormOptions,
    defaultValues: {
      ...systemFormOptions.defaultValues,
      ...defaultValues,
    },
  });

  return <NtpSettings form={form} />;
}

describe("NtpSettings", () => {
  it("renders the NTP fieldset", () => {
    installerRender(<TestForm />);
    screen.getByRole("group", { name: "Time Synchronization Servers" });
  });

  it("renders Mode dropdown", () => {
    installerRender(<TestForm />);
    screen.getByLabelText("Mode");
  });

  describe("when mode is default", () => {
    const defaultValues = { ntpMode: "default" };

    it("does not show Server addresses field", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.queryByLabelText("Server addresses")).not.toBeInTheDocument();
    });
  });

  describe("when mode is custom", () => {
    const defaultValues = { ntpMode: "custom", ntpServers: [] };

    it("shows Server addresses field", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      screen.getByLabelText("Server addresses");
    });

    it("shows helper text", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      screen.getByText(/E\.g\., pool\.ntp\.org/);
    });

    it("displays existing NTP servers", () => {
      installerRender(
        <TestForm
          defaultValues={{ ntpMode: "custom", ntpServers: ["pool.ntp.org", "0.pool.ntp.org"] }}
        />,
      );
      screen.getByText("pool.ntp.org");
      screen.getByText("0.pool.ntp.org");
    });
  });

  describe("mode switching", () => {
    it("switches from default to custom mode", async () => {
      const { user } = installerRender(<TestForm defaultValues={{ ntpMode: "default" }} />);

      const modeButton = screen.getByLabelText("Mode");
      await user.click(modeButton);

      const customOption = screen.getByRole("option", { name: /Custom/ });
      await user.click(customOption);

      screen.getByLabelText("Server addresses");
    });

    it("switches from custom to default mode", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ ntpMode: "custom", ntpServers: ["pool.ntp.org"] }} />,
      );

      const modeButton = screen.getByLabelText("Mode");
      await user.click(modeButton);

      const defaultOption = screen.getByRole("option", { name: /Default/ });
      await user.click(defaultOption);

      expect(screen.queryByLabelText("Server addresses")).not.toBeInTheDocument();
    });
  });

  describe("adding NTP servers", () => {
    it("allows adding a server", async () => {
      const { user } = installerRender(<TestForm defaultValues={{ ntpMode: "custom" }} />);

      const input = screen.getByRole("textbox", { name: "Server addresses" });
      await user.type(input, "time.google.com{Enter}");

      screen.getByText("time.google.com");
    });
  });
});
