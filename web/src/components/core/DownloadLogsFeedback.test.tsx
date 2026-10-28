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
import { screen, waitFor } from "@testing-library/react";
import DownloadLogsFeedback from "./DownloadLogsFeedback";
import { plainRender } from "~/test-utils";

const mockDownload = jest.fn();
jest.mock("~/utils", () => {
  const original = jest.requireActual("~/utils");
  return {
    ...original,
    download: (...args) => mockDownload(...args),
  };
});

const FIXED_DATE = "2026-06-03T10-30-00-000Z";
jest
  .spyOn(global, "Date")
  .mockImplementation(() => ({ toISOString: () => "2026-06-03T10:30:00.000Z" }) as unknown as Date);

const TestTrigger = ({ download }: { download: () => void }) => (
  <button onClick={download}>Download logs</button>
);

const renderDownloadLogsFeedback = () => {
  const { user } = plainRender(
    <DownloadLogsFeedback>
      {({ download }) => <TestTrigger download={download} />}
    </DownloadLogsFeedback>,
  );

  return { user };
};

describe("DownloadLogsFeedback", () => {
  beforeEach(() => {
    mockDownload.mockReset();
  });

  it("renders the trigger children", () => {
    renderDownloadLogsFeedback();
    screen.getByRole("button", { name: "Download logs" });
  });

  it("shows installation logs download alert when download starts", async () => {
    mockDownload.mockReturnValue(new Promise(() => {}));
    const { user } = renderDownloadLogsFeedback();

    await user.click(screen.getByRole("button", { name: "Download logs" }));

    screen.getByRole("heading", { name: "Info alert: Installation logs download" });
  });

  it("passes the correct URL and filename to the download utility", async () => {
    mockDownload.mockResolvedValue(undefined);
    const { user } = renderDownloadLogsFeedback();

    await user.click(screen.getByRole("button", { name: "Download logs" }));

    expect(mockDownload).toHaveBeenCalledWith(
      "/api/private/download_logs",
      `agama-logs-${FIXED_DATE}.tar.gz`,
    );
  });

  it("shows success alert after download completes", async () => {
    mockDownload.mockResolvedValue(undefined);
    const { user } = renderDownloadLogsFeedback();

    await user.click(screen.getByRole("button", { name: "Download logs" }));

    await waitFor(() =>
      screen.getByRole("heading", { name: "Success alert: Installation logs download" }),
    );
  });

  it("includes descriptive content about the logs file", async () => {
    mockDownload.mockResolvedValue(undefined);
    const { user } = renderDownloadLogsFeedback();

    await user.click(screen.getByRole("button", { name: "Download logs" }));

    await waitFor(() => screen.getByText(/contains a record of the installer activity so far/));
  });
});
