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

import { act, renderHook } from "@testing-library/react";
import { useScrollsSideways } from "~/hooks/use-scrolls-sideways";

let watched: Element[] = [];
let notify: (() => void)[] = [];

/* jsdom lays nothing out and has no ResizeObserver. This one records what it
   watches and lets a test say that something changed size. */
class ResizeObserverMock {
  private own: Element[] = [];
  private callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
    notify.push(callback);
  }

  observe(node: Element) {
    this.own.push(node);
    watched.push(node);
  }

  unobserve() {}

  disconnect() {
    watched = watched.filter((node) => !this.own.includes(node));
    notify = notify.filter((callback) => callback !== this.callback);
  }
}

/* A box of the given width holding content of the given width. */
const box = (clientWidth: number, scrollWidth: number) => {
  const node = document.createElement("div");
  node.appendChild(document.createElement("table"));
  Object.defineProperty(node, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(node, "scrollWidth", { configurable: true, value: scrollWidth });
  return node;
};

const resize = (node: HTMLElement, clientWidth: number, scrollWidth: number) => {
  Object.defineProperty(node, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(node, "scrollWidth", { configurable: true, value: scrollWidth });
  act(() => notify.forEach((callback) => callback()));
};

beforeEach(() => {
  watched = [];
  notify = [];
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
});

afterEach(() => {
  delete (window as { ResizeObserver?: unknown }).ResizeObserver;
});

describe("useScrollsSideways", () => {
  it("reports false when the content fits", () => {
    const { result } = renderHook(() => useScrollsSideways(box(800, 800)));

    expect(result.current).toBe(false);
  });

  it("reports true when the content is wider than the box", () => {
    const { result } = renderHook(() => useScrollsSideways(box(320, 640)));

    expect(result.current).toBe(true);
  });

  it("follows the box as it changes size", () => {
    const node = box(800, 800);
    const { result } = renderHook(() => useScrollsSideways(node));

    resize(node, 320, 640);
    expect(result.current).toBe(true);

    resize(node, 800, 800);
    expect(result.current).toBe(false);
  });

  it("watches what the box holds as well as the box", () => {
    const node = box(800, 800);
    renderHook(() => useScrollsSideways(node));

    expect(watched).toContain(node);
    expect(watched).toContain(node.firstElementChild);
  });

  describe("when the element goes away", () => {
    it("reports false and stops watching it", () => {
      const node = box(320, 640);
      const { result, rerender } = renderHook(
        (element: HTMLElement | null) => useScrollsSideways(element),
        { initialProps: node as HTMLElement | null },
      );

      rerender(null);

      expect(result.current).toBe(false);
      expect(watched).not.toContain(node);
    });
  });
});
