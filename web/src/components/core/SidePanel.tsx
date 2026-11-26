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
  /** Whether the panel is open. */
  isOpen: boolean;
  /** Called when the user closes the panel. */
  onClose: () => void;
  /** The panel heading, which also names the panel for assistive technologies. */
  title: React.ReactNode;
  /** An optional line under the title. */
  description?: React.ReactNode;
  /** Controls shown next to the close button, such as a menu of actions. */
  actions?: React.ReactNode;
  /** The content the panel opens over. */
  page: React.ReactNode;
  /** The panel content. */
  children?: React.ReactNode;
  /**
   * Distance in pixels between the top of the scrolling area and the panel as
   * the page scrolls, to keep the panel below content that stays in view.
   * Defaults to 0.
   */
  pinnedOffset?: number;
  /**
   * Id of the panel, for the `aria-controls` of the controls opening it. The
   * element is rendered whether the panel is open or not.
   */
  id?: string;
  /**
   * Returns the element to focus when the panel closes. Without it, or when it
   * returns null, focus goes back to the element focused before opening.
   */
  returnFocusTo?: () => HTMLElement | null;
  /**
   * Identifies what the panel shows, such as a device name. Changing it while
   * the panel is open moves focus into the panel again.
   */
  subjectKey?: string;
};

/** The nearest ancestor that scrolls, where the page scrolls as a whole. */
function scrollerOf(node: HTMLElement | null): HTMLElement | null {
  for (let at = node?.parentElement; at; at = at.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(at).overflowY)) return at;
  }
  return null;
}

/**
 * A panel with the details of an item, opened over the page it belongs to.
 *
 * It takes care of the accessibility of the pattern:
 *
 * - Opening it moves focus into it, and closing it returns focus to the
 *   element that opened it, or to the one given by `returnFocusTo`.
 * - The page it covers is inert: out of the tab order and hidden from screen
 *   readers. Content outside it, such as the header or a sticky section above
 *   it, stays usable, since the panel is part of the page and not a dialog.
 * - Escape closes it from anywhere inside.
 * - A click on the backdrop closes it, but only when both the press and the
 *   release land there, so neither a text selection dragged out of the panel
 *   nor a click in a dialog opened from it closes the panel. The backdrop is
 *   not a Tab stop: keyboard users have Escape and the close button.
 * - It is a landmark named after its title.
 *
 * It stays in view while the page scrolls, `pinnedOffset` pixels below the top,
 * and scrolls its own content.
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
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const isPressOnBackdrop = useRef(false);
  const frameId = useId();
  const [pinnedHeight, setPinnedHeight] = useState<number>();

  /* Sizes the panel to what is in view, from its top down to the bottom of
     the scrolling area or the end of the page, whichever comes first, and
     again on every scroll and resize. */
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

  /* Where focus goes on close, read while the panel is open: by the time it
     closes, the element it points at may be gone. */
  const returnTarget = useRef(returnFocusTo);

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

  /* Without scrolling: the drawer lays its panel out off screen and slides it
     into view, so a regular focus would scroll the page sideways to the
     panel's layout position. */
  useEffect(() => {
    if (isOpen && panel) panel.focus({ preventScroll: true });
  }, [isOpen, panel, subjectKey]);

  const region = (
    <section
      ref={setPanel}
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
        component="header"
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
          {description && <p className="agm-row-note">{description}</p>}
        </FlexItem>
        <FlexItem>
          <Flex gap={{ default: "gapXs" }} flexWrap={{ default: "nowrap" }}>
            {actions && <FlexItem>{actions}</FlexItem>}
            <FlexItem>
              <Button
                variant="plain"
                // TRANSLATORS: closes the panel opened beside the page
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
    </section>
  );

  /* The backdrop covers the drawer's only child, so a click on it targets
     that child. Events from the panel, or from dialogs and menus opened from
     it, reach here too through React portals. */
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
      /* A drag ending outside the panel fires its click on the backdrop. */
      onClick={(event) => {
        if (isPressOnBackdrop.current && isBackdrop(event)) onClose();
        isPressOnBackdrop.current = false;
      }}
    >
      <DrawerContent
        panelContent={
          <DrawerPanelContent
            /* On the drawer panel, which is always rendered, so the id never
               points at nothing. */
            id={id}
            /* PatternFly widths jump from 75% to 100%. */
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
