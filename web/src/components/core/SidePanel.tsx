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
import Icon from "~/components/layout/Icon";
import { _ } from "~/i18n";

/** How a panel and the page it belongs to divide the window between them. */
export type SidePanelPlacement =
  /** The panel comes over the page, which is left visible and out of reach. */
  | "overlay"
  /** The two stand side by side, and the page keeps working. */
  | "share";

export type SidePanelProps = {
  /** Whether the panel is showing. */
  isOpen: boolean;
  /** How much of the window the panel takes, and what the page does about it. */
  placement: SidePanelPlacement;
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
  /**
   * What the panel's side of the page holds while nothing is open, where it stands beside
   * the page. Given one, that side is kept from the start, so opening the
   * panel moves nothing the reader was looking at.
   */
  placeholder?: React.ReactNode;
  /** What the panel holds. */
  children?: React.ReactNode;
  /** Lets a control that opens this panel point at it with `aria-controls`. */
  id?: string;
};

/**
 * A panel that opens beside or over the page it belongs to.
 *
 * The caller decides which of the two applies, since how much room there is and
 * how much the page needs are facts about the page. What each one means for
 * a reader who is not looking at the screen is decided here, once:
 *
 * - Opening it moves the reader into it, so what they asked for is what they
 *   are reading, and closing it puts them back on the control they left.
 * - Where it comes over the page, the page underneath is out of reach. A panel
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
 * - Where it comes over the page, a click on the backdrop closes it too, for
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
 *   placement="overlay"
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
  placement,
  onClose,
  title,
  description,
  actions,
  page,
  placeholder,
  children,
  id,
}: SidePanelProps): React.ReactNode {
  const [panel, setPanel] = React.useState<HTMLDivElement | null>(null);
  const titleId = React.useId();
  const isPressOnBackdrop = React.useRef(false);

  /* Where the reader was when they opened it, so closing it can put them back.
     Without this a reader who closes a panel is dropped at the top of the
     document with nothing to say what they just left. */
  React.useEffect(() => {
    if (!isOpen) return;

    const opener = document.activeElement;

    return () => {
      if (opener instanceof HTMLElement) opener.focus();
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
  React.useEffect(() => {
    if (isOpen && panel) panel.focus({ preventScroll: true });
  }, [isOpen, panel]);

  const region = (
    <div
      id={id}
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
          {description && <div className="agm-side-panel__description">{description}</div>}
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

  const isBeside = placement === "share";
  /* Kept from the start where there is room for it and something to say in it,
     so that opening the panel does not slide the sentence the reader is reading
     out from under them. */
  const reserves = isBeside && placeholder !== undefined;
  const isCovered = placement === "overlay" && isOpen;

  /* The backdrop is drawn over the drawer's only child, so that is what
     a click on it lands on. Anything else is something on top of it: the
     panel, or a dialog or menu opened from it, whose events reach here too
     because React passes them up through portals. */
  const isBackdrop = (event: React.SyntheticEvent<HTMLElement>) =>
    event.target === event.currentTarget.firstElementChild;

  return (
    <Drawer
      isExpanded={isOpen || reserves}
      isInline={isBeside}
      position="end"
      className={
        isCovered ? "agm-side-panel-frame agm-side-panel-frame--covered" : "agm-side-panel-frame"
      }
      onPointerDown={(event) => {
        isPressOnBackdrop.current = isCovered && isBackdrop(event);
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
            /* Set as a size rather than through the widths prop, whose steps
               jump from three quarters to the whole width. Over the page the
               panel is what the reader is in, so it takes most of the room;
               beside it both halves are being read, so they take half each. */
            defaultSize={isBeside ? "50%" : "75%"}
            className={`agm-side-panel-frame__side agm-side-panel-frame__side--${placement}`}
          >
            <DrawerPanelBody hasNoPadding>
              {isOpen ? region : reserves && <div className="agm-side-panel">{placeholder}</div>}
            </DrawerPanelBody>
          </DrawerPanelContent>
        }
      >
        <DrawerContentBody
          // @ts-expect-error: React 18 types have no `inert`, which the DOM
          // takes as an empty string.
          inert={isCovered ? "" : undefined}
        >
          {page}
        </DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
}
