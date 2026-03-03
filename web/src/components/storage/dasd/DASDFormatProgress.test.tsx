/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import { screen, act } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import DASDFormatProgress from "./DASDFormatProgress";

const mockOnEvent = jest.fn();

jest.mock("~/context/installer", () => ({
  useInstallerClient: () => ({
    onEvent: mockOnEvent,
  }),
}));

describe("DASDFormatProgress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("when there are no signal progress events", () => {
    it("renders nothing", () => {
      mockOnEvent.mockImplementation(() => jest.fn());

      const { container } = installerRender(<DASDFormatProgress />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when signal contains empty summary", () => {
    it("renders nothing", () => {
      let eventCallback: (event: unknown) => void;

      mockOnEvent.mockImplementation((cb) => {
        eventCallback = cb;
        return jest.fn();
      });

      const { container } = installerRender(<DASDFormatProgress />);

      act(() => {
        eventCallback({
          type: "DASDFormatChanged",
          summary: [],
        });
      });

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when there is progress", () => {
    it("renders progress bars sorted by channel after DASDFormatChanged event", () => {
      let eventCallback: (event: unknown) => void;

      mockOnEvent.mockImplementation((cb) => {
        eventCallback = cb;
        return jest.fn();
      });

      installerRender(<DASDFormatProgress />);

      act(() => {
        eventCallback({
          type: "DASDFormatChanged",
          summary: [
            { channel: "0.0.0500", totalCylinders: 5, formattedCylinders: 1, finished: false },
            { channel: "0.0.0160", totalCylinders: 5, formattedCylinders: 5, finished: true },
            { channel: "0.0.0200", totalCylinders: 5, formattedCylinders: 1, finished: false },
          ],
        });
      });

      const progresses = screen.getAllByRole("progressbar");
      expect(progresses[0]).toHaveAccessibleName("0.0.0160");
      expect(progresses[1]).toHaveAccessibleName("0.0.0200");
      expect(progresses[2]).toHaveAccessibleName("0.0.0500");
      // Finished progress should use success variant
      expect(progresses[0].closest(".pf-v6-c-progress")).toHaveClass("pf-m-success");
    });
  });

  describe("when a DASDFormatFinished event is received", () => {
    it("clears the progress", () => {
      let eventCallback: (event: unknown) => void;
      mockOnEvent.mockImplementation((cb) => {
        eventCallback = cb;
        return jest.fn();
      });

      const { container } = installerRender(<DASDFormatProgress />);

      act(() => {
        eventCallback({
          type: "DASDFormatChanged",
          summary: [
            { channel: "0.0.0200", totalCylinders: 5, formattedCylinders: 5, finished: true },
          ],
        });
      });

      screen.getByRole("progressbar");

      act(() => {
        eventCallback({ type: "DASDFormatFinished" });
      });

      expect(container).toBeEmptyDOMElement();
    });
  });
});
