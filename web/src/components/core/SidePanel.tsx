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

import React, { useEffect, useId, useRef, useState } from "react";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerPanelBody,
  DrawerPanelContent,
  Flex,
  FlexItem,
} from "@patternfly/react-core";
import { css } from "@patternfly/react-styles";
import Icon from "~/components/layout/Icon";
import { _ } from "~/i18n";

export type SidePanelProps = {
  /** Whether the panel is showing. */
  isOpen: boolean;
  /** Closes the panel: its own control, and the Escape key. */
  onClose: () => void;
  /** What the panel is about, read as its heading and as the region's name. */
  title: React.ReactNode;
  /** A line under the title, where the title alone leaves something to say. */
  description?: React.ReactNode;
  /** Offered beside the way out, where the panel as a whole can be acted on. */
  actions?: React.ReactNode;
  /** What the panel is opened over. */
  page: React.ReactNode;
  /** What the panel holds. */
  children?: React.ReactNode;
  /**
   * How many pixels below the top of the scrolling area the panel stays as the
   * page scrolls, to leave room for something the page keeps in sight there.
   * 0 if not given.
   */
  pinnedOffset?: number;
  /**
   * Lets a control that opens this panel point at it with `aria-controls`.
   *
   * It names an element that is always in the page, shut or open, so the
   * reference never points at nothing.
   */
  id?: string;
  /**
   * Where focus goes when the panel closes, looked up at that moment. Without
   * it, or where it finds nothing, focus goes back to what had it when the
   * panel opened.
   */
  returnFocusTo?: () => HTMLElement | null;
  /**
   * What the panel is showing, such as a device name. A change while it is
   * open moves the reader into it, as opening it does, so focus does not go
   * with content that was replaced.
   */
  subjectKey?: string;
};

/**
 * A panel that opens over the page it belongs to, at every width.
 *
 * What that means for a reader who is not looking at the screen is decided
 * here, once:
 *
 * - Opening it moves the reader into it, so what they asked for is what they
 *   are reading, and closing it puts them back on the control they left, or
 *   wherever the caller says the panel's subject lives on the page.
 * - The page underneath is out of reach. A panel
 *   drawn on top of a page does not remove that page from the tab order on its
 *   own, so a reader tabbing out of the panel lands on controls they cannot
 *   see, and a screen reader reads the whole covered page as though it were
 *   available.
 * - Only what it covers is out of reach. Whatever lies outside it, such as the
 *   installer's header or a report placed above it, stays visible and so stays
 *   usable, and Shift+Tab from the panel reaches it. That is on purpose: the
 *   panel is part of the page, not a dialog, so it does not hold the reader
 *   in it. Taking away controls they can still see would only leave them
 *   wondering why those do not answer.
 * - Escape closes it, wherever the focus is inside it.
 * - A click on the backdrop closes it too, for
 *   readers using a mouse or touch. The backdrop stays a decoration, not
 *   a control: whoever uses a keyboard has Escape and the close button, and
 *   one more stop with no clear name would only be noise. A click counts only
 *   where both the press and the release land on the backdrop, so neither
 *   a click in a dialog opened from the panel nor a selection dragged out of
 *   it closes the panel.
 * - It is a named region, so it is one stop on a screen reader's list of
 *   landmarks rather than an unlabelled block of the page.
 *
 * These are correctness rather than convenience, which is why they are built in
 * rather than offered: whoever forgets them does not see what they cost.
 *
 * Motion needs nothing here. The stylesheet's reset already stops every
 * animation and transition where the reader asked for reduced motion.
 *
 * @example
 * <SidePanel
 *   isOpen={isOpen}
 *   onClose={close}
 *   title={device.name}
 *   description={device.description}
 *   page={<DeviceList />}
 * >
 *   <DeviceDetails device={device} />
 * </SidePanel>
 */
/** The nearest ancestor that scrolls, where the page scrolls as a whole. */
function scrollerOf(node: HTMLElement | null): HTMLElement | null {
  for (let at = node?.parentElement; at; at = at.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(at).overflowY)) return at;
  }
  return null;
}

export default function SidePanel({
  isOpen,
  onClose,
  title,
  description,
  actions,
  page,
  children,
  id,
  pinnedOffset = 0,
  returnFocusTo,
  subjectKey,
}: SidePanelProps): React.ReactNode {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const titleId = useId();
  const isPressOnBackdrop = useRef(false);
  const frameId = useId();
  const [pinnedHeight, setPinnedHeight] = useState<number>();

  /* The panel fits what is in view: from where it starts, under what
     the page keeps in sight or lower while the page above has not scrolled
     away yet, down to the bottom of the scrolling area or the end of the page
     beside it, whichever comes first. It is worked out again as the page
     scrolls, so the panel never sticks out of view and never makes the page
     longer, and nothing moves the page on the reader's behalf. */
  useEffect(() => {
    const frame = document.getElementById(frameId);
    const scroller = scrollerOf(frame);
    const content = frame?.querySelector<HTMLElement>(
      ":scope > .pf-v6-c-drawer__main > .pf-v6-c-drawer__content",
    );
    if (!frame || !scroller || !content) return;

    let frameRequest = 0;
    const measure = () => {
      cancelAnimationFrame(frameRequest);
      frameRequest = requestAnimationFrame(() => {
        const view = scroller.getBoundingClientRect();
        const top = Math.max(view.top + pinnedOffset, frame.getBoundingClientRect().top);
        const bottom = Math.min(view.bottom, content.getBoundingClientRect().bottom);
        setPinnedHeight(Math.max(0, Math.round(bottom - top)));
      });
    };

    measure();
    scroller.addEventListener("scroll", measure, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(scroller);
    observer?.observe(content);

    return () => {
      cancelAnimationFrame(frameRequest);
      scroller.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [isOpen, frameId, pinnedOffset]);

  /* Where the reader was when they opened it, so closing it can put them back.
     Without this a reader who closes a panel is dropped at the top of the
     document with nothing to say what they just left. */
  const returnTarget = useRef(returnFocusTo);

  /* Kept from while the panel is open: by the time it closes, the caller may
     have nothing left to point at, such as the subject it was showing. */
  useEffect(() => {
    if (isOpen) returnTarget.current = returnFocusTo;
  });

  useEffect(() => {
    if (!isOpen) return;

    const opener = document.activeElement;

    return () => {
      const target = returnTarget.current?.() || opener;
      if (target instanceof HTMLElement) target.focus();
    };
  }, [isOpen]);

  /* Once it exists, not when it is asked for: the panel is focused through the
     node itself, so this waits for the render that creates it.

     Without scrolling, which is the whole trick. A drawer lays its panel out
     past the edge of the page and brings it into view by moving it, so the
     panel's real position is still outside what can be seen. Focusing it the
     ordinary way makes the browser scroll that box into view, and it scrolls to
     where the panel is laid out rather than to where it was moved: the page
     slides out to one side and takes the panel with it. */
  useEffect(() => {
    if (isOpen && panel) panel.focus({ preventScroll: true });
  }, [isOpen, panel, subjectKey]);

  const region = (
    <div
      ref={setPanel}
      role="region"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="agm-side-panel"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;

        event.stopPropagation();
        onClose();
      }}
    >
      <Flex
        className="agm-side-panel__head"
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        alignItems={{ default: "alignItemsFlexStart" }}
        flexWrap={{ default: "nowrap" }}
        gap={{ default: "gapMd" }}
      >
        <FlexItem>
          <h2 id={titleId} className="agm-side-panel__title">
            {title}
          </h2>
          {description && <div className="agm-row-note">{description}</div>}
        </FlexItem>
        <FlexItem>
          <Flex gap={{ default: "gapXs" }} flexWrap={{ default: "nowrap" }}>
            {actions && <FlexItem>{actions}</FlexItem>}
            <FlexItem>
              <Button
                variant="plain"
                // TRANSLATORS: names the button that shuts the panel opened
                // beside the page and returns the reader to it.
                aria-label={_("Close")}
                onClick={onClose}
              >
                <Icon name="close" />
              </Button>
            </FlexItem>
          </Flex>
        </FlexItem>
      </Flex>
      <div className="agm-side-panel__body">{children}</div>
    </div>
  );

  /* The backdrop is drawn over the drawer's only child, so that is what
     a click on it lands on. Anything else is something on top of it: the
     panel, or a dialog or menu opened from it, whose events reach here too
     because React passes them up through portals. */
  const isBackdrop = (event: React.SyntheticEvent<HTMLElement>) =>
    event.target === event.currentTarget.firstElementChild;

  return (
    <Drawer
      id={frameId}
      style={
        {
          "--agm-side-panel--pinned-offset": `${pinnedOffset}px`,
          "--agm-side-panel--pinned-height": pinnedHeight ? `${pinnedHeight}px` : "auto",
        } as React.CSSProperties
      }
      isExpanded={isOpen}
      position="end"
      className={css("agm-side-panel-frame", isOpen && "agm-side-panel-frame--covered")}
      onPointerDown={(event) => {
        isPressOnBackdrop.current = isOpen && isBackdrop(event);
      }}
      /* A click lands on whatever holds both the press and the release, which
         for a selection dragged out of the panel is the backdrop. */
      onClick={(event) => {
        if (isPressOnBackdrop.current && isBackdrop(event)) onClose();
        isPressOnBackdrop.current = false;
      }}
    >
      <DrawerContent
        panelContent={
          <DrawerPanelContent
            /* On the drawer's panel rather than on the region inside it: the
               panel is always rendered, merely hidden while shut, whereas the
               region exists only while something is open. */
            id={id}
            /* Set as a size rather than through the widths prop, whose steps
               jump from three quarters to the whole width. The panel is what
               the reader is in, so it takes most of the room. */
            defaultSize="75%"
            className="agm-side-panel-frame__side"
          >
            <DrawerPanelBody hasNoPadding>{isOpen && region}</DrawerPanelBody>
          </DrawerPanelContent>
        }
      >
        <DrawerContentBody
          // @ts-expect-error: React 18 types have no `inert`, which the DOM
          // takes as an empty string.
          inert={isOpen ? "" : undefined}
        >
          {page}
        </DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
}
