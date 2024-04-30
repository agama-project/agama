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
import { If } from "~/components/core";

describe("If", () => {
  describe("when condition evaluates to true", () => {
    describe("and 'then' prop was given", () => {
      it("renders content given in 'then' prop", () => {
        plainRender(<If condition={3 < 6} then="Hello World!" else="Goodbye World!" />);

        screen.getByText("Hello World!");
      });
      it("renders result of function given in 'then' prop", () => {
        plainRender(<If condition={3 < 6} then={() => "Hello World!"} else={() => "Goodbye World!"} />);

        screen.getByText("Hello World!");
      });
    });

    describe("but 'then' prop was not given", () => {
      it("renders nothing", () => {
        const { container } = plainRender(<If condition={3 < 6} else="Goodbye World!" />);

        expect(container).toBeEmptyDOMElement();
      });
    });
  });

  describe("when condition evaluates to false", () => {
    describe("and 'else' prop was given", () => {
      it("renders content given in 'else' prop", () => {
        plainRender(<If condition={6 < 3} then="Hello World!" else="Goodbye World!" />);

        screen.getByText("Goodbye World!");
      });
      it("renders result of function given in 'else' prop", () => {
        plainRender(<If condition={6 < 3} then={() => "Hello World!"} else={() => "Goodbye World!"} />);

        screen.getByText("Goodbye World!");
      });
    });

    describe("but 'else' prop was not given", () => {
      it("renders nothing", () => {
        const { container } = plainRender(<If condition={6 < 3} then="Hello World!" />);

        expect(container).toBeEmptyDOMElement();
      });
    });
  });
});
