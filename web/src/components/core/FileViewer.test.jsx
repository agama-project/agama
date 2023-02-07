/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import { screen, waitFor, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { FileViewer } from "~/components/core";
import cockpit from "../../lib/cockpit";

jest.mock("../../lib/cockpit");

const readFn = jest.fn(() => new Promise(jest.fn()));

const fileFn = jest.fn();
fileFn.mockImplementation(() => {
  return {
    read: readFn
  };
});

cockpit.file.mockImplementation(fileFn);

// testing data
const file_name = "/testfile";
const content = "Read file content";
const title = "YaST Logs";

describe("FileViewer", () => {
  beforeEach(() => {
    readFn.mockResolvedValue(content);
  });

  it("displays the specified file and the title", async () => {
    plainRender(<FileViewer file={file_name} title={title} />);
    const dialog = await screen.findByRole("dialog");

    // the file was read from cockpit
    expect(fileFn).toHaveBeenCalledWith(file_name);
    expect(readFn).toHaveBeenCalled();

    within(dialog).getByText(title);
    within(dialog).getByText(content);
  });

  it("displays the file name when the title is missing", async () => {
    plainRender(<FileViewer file={file_name} />);
    const dialog = await screen.findByRole("dialog");

    within(dialog).getByText(file_name);
  });

  it("closes the popup after clicking the close button", async () => {
    const { user } = plainRender(<FileViewer file={file_name} title={title} />);
    const dialog = await screen.findByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: /Close/i });

    await user.click(closeButton);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("triggers the onCloseCallback after clicking the close button", async () => {
    const callback = jest.fn();
    const { user } = plainRender(<FileViewer file={file_name} title={title} onCloseCallback={callback} />);
    const dialog = await screen.findByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: /Close/i });

    await user.click(closeButton);

    expect(callback).toHaveBeenCalled();
  });

  describe("when the file does not exist", () => {
    beforeEach(() => {
      readFn.mockResolvedValue(null);
    });

    it("displays an error", async () => {
      plainRender(<FileViewer file={file_name} title={title} />);
      const dialog = await screen.findByRole("dialog");

      within(dialog).getByText(/cannot read the file/i);
    });
  });

  describe("when the file cannot be read", () => {
    beforeEach(() => {
      readFn.mockRejectedValue(new Error("read error"));
    });

    it("displays the error message", async () => {
      plainRender(<FileViewer file={file_name} title={title} />);
      const dialog = await screen.findByRole("dialog");

      within(dialog).getByText(/read error/i);
    });
  });
});
