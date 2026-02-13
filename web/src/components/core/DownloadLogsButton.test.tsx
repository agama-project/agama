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
import { plainRender } from "~/test-utils";
import DownloadLogsButton from "./DownloadLogsButton";

describe("DownloadLogsButton", () => {
  it("renders a button with 'Download logs' label", () => {
    plainRender(<DownloadLogsButton />);
    screen.getByRole("link", { name: /Download logs/i });
  });

  it("has correct download attributes", () => {
    plainRender(<DownloadLogsButton />);
    const button = screen.getByRole("link", { name: /Download logs/i });
    expect(button).toHaveAttribute("href", "/api/v2/private/download_logs");
    expect(button).toHaveAttribute("download", "agama-logs.tar.gz");
  });

  it("renders as an anchor element", () => {
    plainRender(<DownloadLogsButton />);
    const button = screen.getByRole("link", { name: /Download logs/i });
    expect(button.tagName).toBe("A");
  });

  it("accepts custom props", () => {
    plainRender(<DownloadLogsButton data-testid="custom-download" />);
    screen.getByTestId("custom-download");
  });

  it("allows overriding size and variant", () => {
    plainRender(<DownloadLogsButton size="sm" variant="secondary" />);
    const button = screen.getByRole("link", { name: /Download logs/i });
    expect(button).toHaveClass("pf-m-secondary");
    expect(button).toHaveClass("pf-m-small");
  });
});
