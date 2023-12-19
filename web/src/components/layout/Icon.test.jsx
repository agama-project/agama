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
import { plainRender } from "~/test-utils";
import { Icon } from "~/components/layout";

describe("Icon", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation();
  });

  afterAll(() => {
    console.error.mockRestore();
  });

  describe("mounted with a known name", () => {
    it("renders an aria-hidden SVG element", async () => {
      const { container } = plainRender(<Icon name="wifi" />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });

    it("includes the icon name as a data attribute of the SVG", async () => {
      const { container } = plainRender(<Icon name="wifi" />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute("data-icon-name", "wifi");
    });

    describe("and a predefined size", () => {
      it("adds a CSS class for given size", () => {
        const { container } = plainRender(<Icon name="wifi" size="xxxl" />);
        const icon = container.querySelector('svg');
        // Check that width and height are set to default (see .svgrrc for
        // production, __mocks__/svg.js for testing)
        expect(icon).toHaveAttribute("width", "28");
        expect(icon).toHaveAttribute("height", "28");
        // Check that "size" CSS class was added
        expect(icon.classList.contains("icon-xxxl")).toBe(true);
      });
    });

    describe("and an arbitrary size", () => {
      it("change the width and height attributes to given value", () => {
        const { container } = plainRender(<Icon name="wifi" size="1dhv" />);
        const icon = container.querySelector('svg');
        expect(icon).toHaveAttribute("width", "1dhv");
        expect(icon).toHaveAttribute("height", "1dhv");
      });
    });
  });

  describe("mounted with unknown name", () => {
    it("outputs to console.error", () => {
      plainRender(<Icon name="apsens" />);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("'apsens' not found")
      );
    });

    it("renders nothing", async () => {
      const { container } = plainRender(<Icon name="apsens" />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("mounted with a falsy value as name", () => {
    it("outputs to console.error", () => {
      plainRender(<Icon name="" />);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Rendering nothing")
      );
    });

    it("renders nothing", () => {
      const { container: contentWhenNotDefined } = plainRender(<Icon />);
      expect(contentWhenNotDefined).toBeEmptyDOMElement();

      const { container: contentWhenEmpty } = plainRender(<Icon name="" />);
      expect(contentWhenEmpty).toBeEmptyDOMElement();

      const { container: contentWhenFalse } = plainRender(<Icon name={false} />);
      expect(contentWhenFalse).toBeEmptyDOMElement();

      const { container: contentWhenNull } = plainRender(<Icon name={null} />);
      expect(contentWhenNull).toBeEmptyDOMElement();
    });
  });
});
