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
import ConfigEditor from "./ConfigEditor";
import { plainRender } from "~/test-utils";

const mockIsoTimestamp = jest.fn();
jest.mock("~/utils", () => ({
  ...jest.requireActual("~/utils"),
  isoTimestamp: () => mockIsoTimestamp(),
}));

// Monaco editor is too heavy to render in tests; replace with a lightweight stub
// that exposes the props we care about.
jest.mock("@patternfly/react-code-editor", () => ({
  CodeEditor: ({
    code,
    downloadFileName,
    emptyState,
  }: {
    code?: string;
    downloadFileName: string;
    emptyState?: React.ReactNode;
  }) =>
    code === undefined ? (
      <>{emptyState}</>
    ) : (
      <div>
        <pre aria-label="Configuration code">{code}</pre>
        <div aria-label="Download filename">{downloadFileName}</div>
      </div>
    ),
  Language: { json: "json" },
}));

jest.mock("@monaco-editor/react", () => ({
  loader: {
    config: jest.fn(),
  },
}));

jest.mock("monaco-editor/esm/vs/editor/editor.api.js", () => ({}));

const mockConfig = { software: { product: "Agama" } };

global.fetch = jest.fn();
const fetchSpy = global.fetch as jest.Mock;

const renderConfigEditorDialog = () => {
  const { user } = plainRender(<ConfigEditor />);
  return { user };
};

describe("ConfigEditor", () => {
  beforeEach(() => {
    mockIsoTimestamp.mockReturnValue("2026-06-03T10-30-00-000Z");
    fetchSpy.mockReset();
  });

  it("shows a spinner while the config is loading", () => {
    fetchSpy.mockReturnValue(new Promise(() => {}));
    renderConfigEditorDialog();

    screen.getByRole("progressbar");
  });

  it("displays the config content once loaded", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockConfig)),
    } as Response);

    renderConfigEditorDialog();

    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());

    expect(screen.getByLabelText("Configuration code").textContent).toBe(
      JSON.stringify(mockConfig, null, 2),
    );
  });

  // The extension is omitted here on purpose: CodeEditor appends it based on
  // its language prop.
  it("uses a timestamped filename without extension for the download", async () => {
    fetchSpy.mockResolvedValue({
      text: () => Promise.resolve(JSON.stringify(mockConfig)),
    } as Response);

    renderConfigEditorDialog();

    await waitFor(() => {
      expect(screen.getByLabelText("Download filename")).toHaveTextContent(
        "agama-config-2026-06-03T10-30-00-000Z",
      );
    });
  });

  it("falls back to an empty config on fetch error", async () => {
    fetchSpy.mockRejectedValue(new Error("network error"));
    // mock console.error, the error is expected, do not print it on the terminal
    jest.spyOn(global.console, "error").mockImplementation(() => {});

    renderConfigEditorDialog();

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.getByLabelText("Configuration code")).toHaveTextContent("");
    });

    // remove the console mock
    jest.spyOn(global.console, "error").mockRestore();
  });
});
