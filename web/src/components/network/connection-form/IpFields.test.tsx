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
import { defaultOptions, FormIpMode } from "./fields";
import IpFields from "./IpFields";

function TestForm({
  defaultValues = {},
  protocol = "ipv4",
}: {
  defaultValues?: object;
  protocol?: "ipv4" | "ipv6";
}) {
  const form = useAppForm({
    ...defaultOptions,
    defaultValues: {
      ...defaultOptions.defaultValues,
      ...defaultValues,
    },
  });

  return <IpFields form={form} protocol={protocol} />;
}

describe("IpFields", () => {
  it("renders the protocol label", () => {
    installerRender(<TestForm />);
    screen.getByText("IPv4 Settings");
  });

  it("does not show addresses or gateway when mode is automatic", () => {
    installerRender(<TestForm />);
    expect(screen.queryByText("IPv4 Addresses")).not.toBeInTheDocument();
    expect(screen.queryByText("IPv4 Gateway")).not.toBeInTheDocument();
  });

  describe("when mode is manual", () => {
    const defaultValues = { ipv4Mode: FormIpMode.MANUAL };

    it("shows IPv4 Addresses as required", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.getByText("IPv4 Addresses").closest("label")).not.toHaveTextContent(
        "(optional)",
      );
    });

    it("shows IPv4 Gateway as required", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.getByText("IPv4 Gateway").closest("label")).not.toHaveTextContent("(optional)");
    });

    it("does not note that the gateway is ignored without a static IP", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.getByText("IPv4 Gateway").closest("label")).not.toHaveTextContent("ignored");
    });
  });

  describe("when mode is advanced auto", () => {
    const defaultValues = { ipv4Mode: FormIpMode.ADVANCED_AUTO };

    it("shows IPv4 Addresses as required", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.getByText("IPv4 Addresses").closest("label")).not.toHaveTextContent(
        "(optional)",
      );
    });

    it("shows IPv4 Gateway as optional", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.getByText("IPv4 Gateway").closest("label")).toHaveTextContent("(optional)");
    });
  });

  describe("address normalization", () => {
    it("adds default /24 prefix to Class C IPv4 addresses without prefix", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ ipv4Mode: FormIpMode.MANUAL }} />,
      );
      const input = screen.getByRole("textbox", { name: /IPv4 Addresses/i });
      await user.type(input, "192.168.1.1");
      await user.keyboard("{Enter}");
      screen.getByText("192.168.1.1/24");
    });

    it("adds default /8 prefix to Class A IPv4 addresses without prefix", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ ipv4Mode: FormIpMode.MANUAL }} />,
      );
      const input = screen.getByRole("textbox", { name: /IPv4 Addresses/i });
      await user.type(input, "10.0.0.1");
      await user.keyboard("{Enter}");
      screen.getByText("10.0.0.1/8");
    });

    it("adds default /16 prefix to Class B IPv4 addresses without prefix", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ ipv4Mode: FormIpMode.MANUAL }} />,
      );
      const input = screen.getByRole("textbox", { name: /IPv4 Addresses/i });
      await user.type(input, "172.16.0.1");
      await user.keyboard("{Enter}");
      screen.getByText("172.16.0.1/16");
    });

    it("does not modify IPv4 addresses that already have a prefix", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ ipv4Mode: FormIpMode.MANUAL }} />,
      );
      const input = screen.getByRole("textbox", { name: /IPv4 Addresses/i });
      await user.type(input, "192.168.1.1/16");
      await user.keyboard("{Enter}");
      screen.getByText("192.168.1.1/16");
    });

    it("does not add prefix to invalid IPv4 addresses", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ ipv4Mode: FormIpMode.MANUAL }} />,
      );
      const input = screen.getByRole("textbox", { name: /IPv4 Addresses/i });
      await user.type(input, "not-an-ip");
      await user.keyboard("{Enter}");
      screen.getByText("not-an-ip");
      expect(screen.queryByText("not-an-ip/24")).not.toBeInTheDocument();
    });
  });

  describe("IPv6 address normalization", () => {
    it("adds default /64 prefix to IPv6 addresses without prefix", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ ipv6Mode: FormIpMode.MANUAL }} protocol="ipv6" />,
      );
      const input = screen.getByRole("textbox", { name: /IPv6 Addresses/i });
      await user.type(input, "2001:db8::1");
      await user.keyboard("{Enter}");
      screen.getByText("2001:db8::1/64");
    });
  });
});
