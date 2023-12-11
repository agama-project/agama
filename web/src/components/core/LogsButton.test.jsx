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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { createClient } from "~/client";
import { LogsButton } from "~/components/core";

jest.mock("~/client");

const originalCreateElement = document.createElement;

const executor = jest.fn();
const fetchLogsFn = jest.fn();

beforeEach(() => {
  window.URL.createObjectURL = jest.fn(() => "fake-blob-url");
  window.URL.revokeObjectURL = jest.fn();

  fetchLogsFn.mockImplementation(() => new Promise(executor));

  createClient.mockImplementation(() => {
    return {
      manager: {
        fetchLogs: fetchLogsFn,
      }
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  window.URL.createObjectURL.mockRestore();
  window.URL.revokeObjectURL.mockRestore();
});

describe("LogsButton", () => {
  it("renders a button for downloading logs", () => {
    installerRender(<LogsButton />);
    screen.getByRole("button", "Download logs");
  });

  describe("when user clicks on it", () => {
    it("inits download logs process", async () => {
      const { user } = installerRender(<LogsButton />);
      const button = screen.getByRole("button", "Download logs");
      await user.click(button);
      expect(fetchLogsFn).toHaveBeenCalled();
    });

    it("changes button text, puts it as disabled, and displays an informative alert", async () => {
      const { user } = installerRender(<LogsButton />);

      const button = screen.getByRole("button", "Download logs");
      expect(button).not.toHaveAttribute("disabled");

      await user.click(button);

      expect(button.innerHTML).not.toContain("Download logs");
      expect(button.innerHTML).toContain("Collecting logs...");
      expect(button).toHaveAttribute("disabled");

      const info = screen.queryByRole("heading", { name: /.*logs download as soon as.*/i });
      const warning = screen.queryByRole("heading", { name: /.*went wrong*/i });

      expect(info).toBeInTheDocument();
      expect(warning).not.toBeInTheDocument();
    });

    describe("and logs are collected successfully", () => {
      beforeEach(() => {
        // new TextEncoder().encode("Hello logs!")
        const data = new Uint8Array([72, 101, 108, 108, 111, 32, 108, 111, 103, 115, 33]);
        fetchLogsFn.mockResolvedValue(data);
      });

      it("triggers the download", async () => {
        const { user } = installerRender(<LogsButton />);

        // Ugly mocking needed here.
        // Improvements are wanted and welcome.
        // NOTE: document.createElement cannot mocked in beforeAll because it breaks all testsuite
        // since its used internally by jsdom. Simply spying it is not enough because we want to
        // mock only the call to the HTMLAnchorElement creation that happens when user clicks on the
        // "Download logs".
        document._createElement = document.createElement;

        const anchorMock = document.createElement('a');
        anchorMock.setAttribute = jest.fn();
        anchorMock.click = jest.fn();

        jest.spyOn(document, "createElement").mockImplementation((tag) => {
          return (tag === 'a') ? anchorMock : document._createElement(tag);
        });

        // Now, let's simulate the "Download logs" user click
        const button = screen.getByRole("button", "Download logs");
        await user.click(button);

        // And test what we're looking for
        expect(document.createElement).toHaveBeenCalledWith('a');
        expect(anchorMock).toHaveAttribute("href", "fake-blob-url");
        expect(anchorMock).toHaveAttribute("download", expect.stringMatching(/agama-installation-logs/));
        expect(anchorMock.click).toHaveBeenCalled();

        // Be polite and restore document.createElement function,
        // although it should be done by the call to jest.restoreAllMocks()
        // in the afterAll block
        document.createElement = originalCreateElement;
      });
    });

    describe("but the process fails", () => {
      beforeEach(() => {
        fetchLogsFn.mockRejectedValue("Sorry, something went wrong");
      });

      it("displays a warning alert along with the Download logs button", async () => {
        const { user } = installerRender(<LogsButton />);

        const button = screen.getByRole("button", "Download logs");
        expect(button).not.toHaveAttribute("disabled");

        await user.click(button);

        expect(button.innerHTML).toContain("Download logs");
        screen.getByRole("heading", { name: /.*went wrong.*try again.*/i });
      });
    });
  });
});
