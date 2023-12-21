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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { DevelopmentInfo } from "~/components/core";

const originalEnv = process.env;

describe("DevelopmentInfo", () => {
  afterEach(() => {
    process.env = originalEnv;
  });

  describe("when not running in development mode", () => {
    beforeEach(() => {
      process.env = {
        ...originalEnv,
        WEBPACK_SERVE: false
      };
    });

    it("renders nothing", () => {
      const { container } = plainRender(<DevelopmentInfo />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when running in development mode", () => {
    beforeEach(() => {
      process.env = {
        ...originalEnv,
        WEBPACK_SERVE: true
      };
    });

    it("renders Cockpit server url", () => {
      plainRender(<DevelopmentInfo />);
      screen.getByText("Cockpit server:");
    });

    // TODO: write tests checking the right url is rendered
  });
});
