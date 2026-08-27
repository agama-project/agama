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
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { act, render, renderHook } from "@testing-library/react";
import { _ } from "~/i18n";
import { AnnouncerProvider, AnnouncerTarget, useAnnounce } from "~/context/announcer";

const wrapper = ({ children }: React.PropsWithChildren) => (
  <AnnouncerProvider>{children}</AnnouncerProvider>
);

const liveNodes = (politeness: string) =>
  Array.from(document.body.querySelectorAll(`[aria-live="${politeness}"]`));
const politeNodes = () => liveNodes("polite");
const assertiveNodes = () => liveNodes("assertive");
const textsOf = (nodes: Element[]) => nodes.map((node) => node.textContent);

describe("AnnouncerProvider", () => {
  it("renders empty polite and assertive regions from the start", () => {
    render(<AnnouncerProvider />);

    expect(textsOf(politeNodes())).toEqual(["", ""]);
    expect(textsOf(assertiveNodes())).toEqual(["", ""]);
  });

  it("removes the regions when unmounted", () => {
    const { unmount } = render(<AnnouncerProvider />);

    unmount();

    expect(document.body.querySelectorAll("[aria-live]")).toHaveLength(0);
  });
});

describe("useAnnounce", () => {
  it("throws without an AnnouncerProvider ancestor", () => {
    expect(() => renderHook(() => useAnnounce())).toThrow(/AnnouncerProvider/);
  });

  it("delivers messages to the polite region by default", () => {
    const {
      result: { current: announce },
    } = renderHook(() => useAnnounce(), { wrapper });

    act(() => announce(_("entry added")));

    expect(textsOf(politeNodes())).toContain("entry added");
    expect(textsOf(assertiveNodes())).toEqual(["", ""]);
  });

  it("delivers the rendered text of a React element message", () => {
    const {
      result: { current: announce },
    } = renderHook(() => useAnnounce(), { wrapper });

    act(() => announce(<strong>{_("emphasized sentence")}</strong>));

    expect(textsOf(politeNodes())).toContain("emphasized sentence");
  });

  it("delivers assertive messages to the alert region", () => {
    const {
      result: { current: announce },
    } = renderHook(() => useAnnounce(), { wrapper });

    act(() => announce(_("session expired"), { politeness: "assertive" }));

    expect(textsOf(assertiveNodes())).toContain("session expired");
    expect(textsOf(politeNodes())).toEqual(["", ""]);
  });

  it("moves a repeated message to the sibling node so it is announced again", () => {
    const {
      result: { current: announce },
    } = renderHook(() => useAnnounce(), { wrapper });

    act(() => announce(_("alpha added")));
    const firstTexts = textsOf(politeNodes());

    act(() => announce(_("alpha added")));
    const secondTexts = textsOf(politeNodes());

    expect(firstTexts).toContain("alpha added");
    expect(secondTexts).toContain("alpha added");
    expect(secondTexts).not.toEqual(firstTexts);
  });

  it("replaces a pending message instead of accumulating messages", () => {
    const {
      result: { current: announce },
    } = renderHook(() => useAnnounce(), { wrapper });

    act(() => announce(_("first")));
    act(() => announce(_("second")));

    const texts = textsOf(politeNodes());
    expect(texts).toContain("second");
    expect(texts).not.toContain("first");
  });

  it("clears the region when announcing an empty message", () => {
    const {
      result: { current: announce },
    } = renderHook(() => useAnnounce(), { wrapper });

    act(() => announce(_("something")));
    act(() => announce(""));

    expect(textsOf(politeNodes())).toEqual(["", ""]);
  });
});

describe("AnnouncerTarget", () => {
  let announce: ReturnType<typeof useAnnounce>;

  const CaptureAnnounce = () => {
    announce = useAnnounce();
    return null;
  };

  const Harness = ({ withTarget }: { withTarget: boolean }) => (
    <AnnouncerProvider>
      <CaptureAnnounce />
      {withTarget && (
        <section>
          <AnnouncerTarget />
        </section>
      )}
    </AnnouncerProvider>
  );

  it("relocates the live regions inside the mounted target", () => {
    render(<Harness withTarget />);

    act(() => announce(_("inside the dialog")));

    const section = document.querySelector("section");
    const nodes = document.querySelectorAll("[aria-live]");
    expect(nodes).toHaveLength(4);
    nodes.forEach((node) => expect(section.contains(node)).toBe(true));
    expect(textsOf(politeNodes())).toContain("inside the dialog");
  });

  it("drops the pending message when the regions relocate", () => {
    const { rerender } = render(<Harness withTarget={false} />);

    act(() => announce(_("sent before the dialog opens")));
    rerender(<Harness withTarget />);

    expect(textsOf(politeNodes())).toEqual(["", ""]);
  });

  it("returns the live regions to the document body when unmounted", () => {
    const { rerender } = render(<Harness withTarget />);

    act(() => announce(_("inside the dialog")));
    rerender(<Harness withTarget={false} />);
    act(() => announce(_("back at the page")));

    expect(document.querySelector("section")).toBeNull();
    expect(textsOf(politeNodes())).toContain("back at the page");
  });

  it("renders nothing without an AnnouncerProvider ancestor", () => {
    const { container } = render(<AnnouncerTarget />);

    expect(container).toBeEmptyDOMElement();
  });
});
