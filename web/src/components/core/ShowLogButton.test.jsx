/*
 * Copyright (c) [2022] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import cockpit from "../../lib/cockpit";
import { ShowLogButton } from "~/components/core";

jest.mock("../../lib/cockpit");

const executor = jest.fn();
const loadLogsFn = jest.fn().mockImplementation(() => new Promise(executor));

beforeEach(() => {
  cockpit.file.mockImplementation(() => {
    return {
      read: loadLogsFn
    }
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ShowLogButton", () => {
  it("renders a button for displaying logs", () => {
    plainRender(<ShowLogButton />);
    const button = screen.getByRole("button", "Show Logs");
    expect(button).not.toHaveAttribute("disabled");
  });

  describe("when user clicks on it", () => {
    it("starts loading the log file", async () => {
      const { user } = plainRender(<ShowLogButton />);
      const button = screen.getByRole("button", "Show Logs");
      await user.click(button);
      expect(loadLogsFn).toHaveBeenCalled();
    });
  });

  describe("when loading the log succeeds", () => {
    const log = "Content of the YaST log file";

    beforeEach(() => {
      loadLogsFn.mockResolvedValue(log);
    });

    it("displays the log content", async () => {
      const { user } = plainRender(<ShowLogButton />);
      const button = screen.getByRole("button", "Show Logs");

      await user.click(button);
      const dialog = await screen.findByRole("dialog");
      within(dialog).getByText(log);
    });

    it("triggers the on show callback", async () => {
      const callback = jest.fn();
      const { user } = plainRender(<ShowLogButton onShowCallback={callback}/>);
      const button = screen.getByRole("button", "Show Logs");

      await user.click(button);
      expect(callback).toHaveBeenCalled();
    });
  });

  describe("when loading the log fails", () => {
    beforeEach(() => {
      loadLogsFn.mockRejectedValue("Cannot read log");
    });

    it("displays a warning alert", async () => {
      const { user } = plainRender(<ShowLogButton />);
      const button = screen.getByRole("button", "Show Logs");
      await user.click(button);
      screen.getByRole("heading", { name: /cannot read the log file/i });
    });
  });
});
