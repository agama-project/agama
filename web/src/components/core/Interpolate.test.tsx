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
import { plainRender } from "~/test-utils";
import Interpolate from "./Interpolate";

let consoleErrorSpy: jest.SpyInstance;

describe("Interpolate", () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, "error");
    consoleErrorSpy.mockImplementation();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("with a printf placeholder", () => {
    it("renders surrounding text for %s", () => {
      const { container } = plainRender(
        <Interpolate sentence="Go to %s page">{() => <strong>settings</strong>}</Interpolate>,
      );

      expect(container.textContent).toBe("Go to settings page");
    });

    it("renders surrounding text for %d", () => {
      const { container } = plainRender(
        <Interpolate sentence="There are %d issues">{() => <strong>3</strong>}</Interpolate>,
      );

      expect(container.textContent).toBe("There are 3 issues");
    });

    it("calls children with an empty string", () => {
      const received: string[] = [];

      plainRender(
        <Interpolate sentence="Go to %s page">
          {(text) => {
            received.push(text);
            return <strong>{text}</strong>;
          }}
        </Interpolate>,
      );

      expect(received).toEqual([""]);
    });

    it("works when the placeholder is at the start", () => {
      const { container } = plainRender(
        <Interpolate sentence="%s is at the start">{() => <strong>This</strong>}</Interpolate>,
      );

      expect(container.textContent).toBe("This is at the start");
    });

    it("works when the placeholder is at the end", () => {
      const { container } = plainRender(
        <Interpolate sentence="At the end: %s">{() => <strong>here</strong>}</Interpolate>,
      );

      expect(container.textContent).toBe("At the end: here");
    });

    it("works when the whole sentence is the placeholder", () => {
      const { container } = plainRender(
        <Interpolate sentence="%s">{() => <strong>everything</strong>}</Interpolate>,
      );

      expect(container.textContent).toBe("everything");
    });

    it("supports multiple placeholders", () => {
      const { container } = plainRender(
        <Interpolate sentence="First %s and second %d">
          {[() => <strong>one</strong>, () => <strong>two</strong>]}
        </Interpolate>,
      );

      expect(container.textContent).toBe("First one and second two");

      const strongs = container.querySelectorAll("strong");

      expect(strongs).toHaveLength(2);
      expect(strongs[0]).toHaveTextContent("one");
      expect(strongs[1]).toHaveTextContent("two");
    });

    it("throws when placeholder count does not match render functions", () => {
      expect(() =>
        plainRender(
          <Interpolate sentence="First %s and second %d">{() => <strong>X</strong>}</Interpolate>,
        ),
      ).toThrow("Interpolate: found 2 placeholder(s) but received 1 render function(s).");
    });
  });

  describe("with a [marker] placeholder", () => {
    it("renders the surrounding text", () => {
      const { container } = plainRender(
        <Interpolate sentence="Go to [settings] page">
          {(text) => <strong>{text}</strong>}
        </Interpolate>,
      );

      expect(container.textContent).toBe("Go to settings page");
    });

    it("passes the extracted text to children", () => {
      const { container } = plainRender(
        <Interpolate sentence="Go to [settings] page">
          {(text) => <strong>{text}</strong>}
        </Interpolate>,
      );

      expect(container.querySelector("strong")).toHaveTextContent("settings");
    });

    it("works when the placeholder is at the start", () => {
      const { container } = plainRender(
        <Interpolate sentence="[Start] of the sentence">
          {(text) => <strong>{text}</strong>}
        </Interpolate>,
      );

      expect(container.textContent).toBe("Start of the sentence");
      expect(container.querySelector("strong")).toHaveTextContent("Start");
    });

    it("works when the placeholder is at the end", () => {
      const { container } = plainRender(
        <Interpolate sentence="End of the [sentence]">
          {(text) => <strong>{text}</strong>}
        </Interpolate>,
      );

      expect(container.textContent).toBe("End of the sentence");
      expect(container.querySelector("strong")).toHaveTextContent("sentence");
    });

    it("works when the whole sentence is the placeholder", () => {
      const { container } = plainRender(
        <Interpolate sentence="[only]">{(text) => <strong>{text}</strong>}</Interpolate>,
      );

      expect(container.querySelector("strong")).toHaveTextContent("only");
    });

    it("passes an empty string to children when the brackets are empty", () => {
      const { container } = plainRender(
        <Interpolate sentence="Click [] to continue">
          {(text) => <strong aria-label="injected">{text}</strong>}
        </Interpolate>,
      );

      expect(container.querySelector("strong")).toHaveTextContent("");
    });

    it("supports multiple placeholders", () => {
      const { container } = plainRender(
        <Interpolate sentence="Using [jdoe] and [root] accounts">
          {[(text) => <strong>{text}</strong>, (text) => <em>{text}</em>]}
        </Interpolate>,
      );

      expect(container.textContent).toBe("Using jdoe and root accounts");
      expect(container.querySelector("strong")).toHaveTextContent("jdoe");
      expect(container.querySelector("em")).toHaveTextContent("root");
    });

    it("throws when placeholder count does not match render functions", () => {
      expect(() =>
        plainRender(
          <Interpolate sentence="[first] and [second]">
            {(text) => <strong>{text}</strong>}
          </Interpolate>,
        ),
      ).toThrow("Interpolate: found 2 placeholder(s) but received 1 render function(s).");
    });

    it("treats unmatched brackets as plain text", () => {
      const { container } = plainRender(
        <Interpolate sentence="[unclosed">{(text) => <strong>{text}</strong>}</Interpolate>,
      );

      expect(container.textContent).toBe("[unclosed");
      expect(container.querySelector("strong")).toBeNull();
    });
  });

  describe("mixed placeholder styles", () => {
    it("throws when mixing printf and marker placeholders", () => {
      expect(() =>
        plainRender(
          <Interpolate sentence="Hello %s [world]">
            {[() => <strong>A</strong>, () => <strong>B</strong>]}
          </Interpolate>,
        ),
      ).toThrow("Interpolate: cannot mix printf and [marker] placeholders.");
    });
  });

  describe("without a placeholder", () => {
    it("renders the sentence as plain text", () => {
      const { container } = plainRender(
        <Interpolate sentence="No placeholder here">
          {(text) => <strong>{text}</strong>}
        </Interpolate>,
      );

      expect(container.textContent).toBe("No placeholder here");
    });

    it("does not render any injected content", () => {
      const { container } = plainRender(
        <Interpolate sentence="No placeholder here">
          {(text) => <strong>{text}</strong>}
        </Interpolate>,
      );

      expect(container.querySelector("strong")).toBeNull();
    });

    it("treats malformed markers as plain text", () => {
      const { container } = plainRender(
        <Interpolate sentence="Hello [world">{(text) => <strong>{text}</strong>}</Interpolate>,
      );

      expect(container.textContent).toBe("Hello [world");
      expect(container.querySelector("strong")).toBeNull();
    });
  });

  describe("when children returns null", () => {
    it("renders the surrounding text without the injected node", () => {
      const { container } = plainRender(
        <Interpolate sentence="Before [marker] after">{() => null}</Interpolate>,
      );

      expect(container.textContent).toBe("Before  after");
      expect(container.querySelector("strong")).toBeNull();
    });
  });

  describe("across multiple renders", () => {
    it("renders correctly across renders", () => {
      const first = plainRender(
        <Interpolate sentence="[one]">{(text) => <strong>{text}</strong>}</Interpolate>,
      );

      expect(first.container.textContent).toBe("one");

      const second = plainRender(
        <Interpolate sentence="[two]">{(text) => <strong>{text}</strong>}</Interpolate>,
      );

      expect(second.container.textContent).toBe("two");
    });
  });
});
