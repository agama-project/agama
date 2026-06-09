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

const mockDownload = jest.fn();
jest.mock("~/utils", () => {
  const original = jest.requireActual("~/utils");
  return {
    ...original,
    download: (...args) => mockDownload(...args),
  };
});

describe("DownloadLogsButton", () => {
  it("renders a button with 'Download logs' label", () => {
    plainRender(<DownloadLogsButton />);
    screen.getByRole("button", { name: /Download logs/i });
  });

  it("triggers the download when clicked", async () => {
    const { user } = plainRender(<DownloadLogsButton />);
    const button = screen.getByRole("button", { name: /Download logs/i });
    await user.click(button);
    expect(mockDownload).toHaveBeenCalled();
  });

  it("accepts custom props", () => {
    plainRender(<DownloadLogsButton data-testid="custom-download" />);
    screen.getByTestId("custom-download");
  });

  it("allows overriding size and variant", () => {
    plainRender(<DownloadLogsButton size="sm" variant="secondary" />);
    const button = screen.getByRole("button", { name: /Download logs/i });
    expect(button).toHaveClass("pf-m-secondary");
    expect(button).toHaveClass("pf-m-small");
  });
});
