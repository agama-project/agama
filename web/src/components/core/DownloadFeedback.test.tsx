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
import DownloadFeedback from "./DownloadFeedback";
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
  <button onClick={download}>Download</button>
);

const TestTitle = () => <>Installation logs download</>;
const TestContent = ({ filename }: { filename?: string }) => <div>{filename}</div>;

const renderDownloadFeedback = (successTimeout?: number) => {
  const { user } = plainRender(
    <DownloadFeedback
      url="/api/logs"
      filenamePrefix="agama-logs"
      extension="tar.gz"
      info={{ title: TestTitle, content: TestContent }}
      success={{ title: TestTitle, content: TestContent, timeout: successTimeout }}
    >
      {({ download }) => <TestTrigger download={download} />}
    </DownloadFeedback>,
  );

  return { user };
};

describe("DownloadFeedback", () => {
  beforeEach(() => {
    mockDownload.mockReset();
  });

  it("renders the trigger children", () => {
    renderDownloadFeedback();
    screen.getByRole("button", { name: "Download" });
  });

  it("shows a pending alert immediately when download starts", async () => {
    mockDownload.mockReturnValue(new Promise(() => {}));
    const { user } = renderDownloadFeedback();

    await user.click(screen.getByRole("button", { name: "Download" }));

    screen.getByRole("heading", { name: "Info alert: Installation logs download" });
  });

  it("replaces the pending alert with a success alert once download completes", async () => {
    mockDownload.mockResolvedValue(undefined);
    const { user } = renderDownloadFeedback();

    await user.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Info alert: Installation logs download" }),
      ).toBeNull(),
    );
    screen.getByRole("heading", { name: "Success alert: Installation logs download" });
  });

  it("includes the generated filename in the success alert", async () => {
    mockDownload.mockResolvedValue(undefined);
    const { user } = renderDownloadFeedback();

    await user.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => screen.getByText(/agama-logs-2026-06-03T10-30-00-000Z\.tar\.gz/));
  });

  it("passes the generated filename to the download utility", async () => {
    mockDownload.mockResolvedValue(undefined);
    const { user } = renderDownloadFeedback();

    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(mockDownload).toHaveBeenCalledWith("/api/logs", `agama-logs-${FIXED_DATE}.tar.gz`);
  });

  it("auto-dismisses the success alert after the timeout", async () => {
    mockDownload.mockResolvedValue(undefined);
    const { user } = renderDownloadFeedback(10);

    await user.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() =>
      screen.getByRole("heading", { name: "Success alert: Installation logs download" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Success alert: Installation logs download" }),
      ).toBeNull(),
    );
  });

  it("dismisses the pending alert when the user closes it manually", async () => {
    mockDownload.mockReturnValue(new Promise(() => {}));
    const { user } = renderDownloadFeedback();

    await user.click(screen.getByRole("button", { name: "Download" }));
    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(
      screen.queryByRole("heading", { name: "Info alert: Installation logs download" }),
    ).toBeNull();
  });

  it("dismisses the success alert when the user closes it manually", async () => {
    mockDownload.mockResolvedValue(undefined);
    const { user } = renderDownloadFeedback();

    await user.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() =>
      screen.getByRole("heading", { name: "Success alert: Installation logs download" }),
    );
    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(
      screen.queryByRole("heading", { name: "Success alert: Installation logs download" }),
    ).toBeNull();
  });

  it("dismisses the pending alert silently on error without showing an error alert", async () => {
    mockDownload.mockRejectedValue(new Error("network error"));
    const { user } = renderDownloadFeedback();

    await user.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Info alert: Installation logs download" }),
      ).toBeNull(),
    );
    expect(
      screen.queryByRole("heading", { name: "Success alert: Installation logs download" }),
    ).toBeNull();
  });

  it("does not auto-dismiss if the user already closed the success alert", async () => {
    mockDownload.mockResolvedValue(undefined);
    const { user } = renderDownloadFeedback(10);

    await user.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() =>
      screen.getByRole("heading", { name: "Success alert: Installation logs download" }),
    );

    await user.click(screen.getByRole("button", { name: /close/i }));

    // Wait longer than the timeout to confirm it does not reappear
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      screen.queryByRole("heading", { name: "Success alert: Installation logs download" }),
    ).toBeNull();
  });
});
