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

/** How a sheet and the page it belongs to divide the window between them. */
export type SheetPlacement =
  /** The sheet is all there is room for, and the page waits behind it. */
  | "replace"
  /** The sheet comes over the page, which is left visible and out of reach. */
  | "overlay"
  /** The two stand side by side, and the page keeps working. */
  | "share";

export type SheetProps = {
  /** Whether the sheet is showing. */
  isOpen: boolean;
  /** How much of the window the sheet takes, and what the page does about it. */
  placement: SheetPlacement;
  /** Closes the sheet: its own control, and the Escape key. */
  onClose: () => void;
  /** What the sheet is about, read as its heading and as the region's name. */
  title: React.ReactNode;
  /** A line under the title, where the title alone leaves something to say. */
  description?: React.ReactNode;
  /** Offered beside the way out, where the sheet as a whole can be acted on. */
  actions?: React.ReactNode;
  /** What the sheet is opened over. */
  page: React.ReactNode;
  /** What the sheet holds. */
  children?: React.ReactNode;
  /** Lets a control that opens this sheet point at it with `aria-controls`. */
  id?: string;
};

/**
 * A panel that opens beside, over, or in place of the page it belongs to.
 *
 * The caller decides which of the three applies, since how much room there is
 * and how much the page needs are facts about the page. What each one means for
 * a reader who is not looking at the screen is decided here, once:
 *
 * - Opening it moves the reader into it, so what they asked for is what they
 *   are reading, and closing it puts them back on the control they left.
 * - Where it comes over the page, the page underneath is out of reach. A panel
 *   drawn on top of a page does not remove that page from the tab order on its
 *   own, so a reader tabbing out of the sheet lands on controls they cannot
 *   see, and a screen reader reads the whole covered page as though it were
 *   available.
 * - Escape closes it, wherever the focus is inside it.
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
 * <Sheet
 *   isOpen={isOpen}
 *   placement="overlay"
 *   onClose={close}
 *   title={_("Result")}
 *   description={_("What the installer will do")}
 *   page={<StoragePageBody />}
 * >
 *   <ResultTabs />
 * </Sheet>
 */
export default function Sheet({
  isOpen,
  placement,
  onClose,
  title,
  description,
  actions,
  page,
  children,
  id,
}: SheetProps): React.ReactNode {
  const [panel, setPanel] = React.useState<HTMLDivElement | null>(null);
  const titleId = React.useId();

  /* Where the reader was when they opened it, so closing it can put them back.
     Without this a reader who closes a sheet is dropped at the top of the
     document with nothing to say what they just left. */
  React.useEffect(() => {
    if (!isOpen) return;

    const opener = document.activeElement;

    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [isOpen]);

  /* Once it exists, not when it is asked for: the panel is focused through the
     node itself, so this waits for the render that creates it. */
  React.useEffect(() => {
    if (isOpen && panel) panel.focus();
  }, [isOpen, panel]);

  const sheet = (
    <div
      id={id}
      ref={setPanel}
      role="region"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="agm-sheet"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;

        event.stopPropagation();
        onClose();
      }}
    >
      <Flex
        className="agm-sheet__head"
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        alignItems={{ default: "alignItemsFlexStart" }}
        flexWrap={{ default: "nowrap" }}
        gap={{ default: "gapMd" }}
      >
        <FlexItem>
          <h2 id={titleId} className="agm-sheet__title">
            {title}
          </h2>
          {description && <div className="agm-sheet__description">{description}</div>}
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
      <div className="agm-sheet__body">{children}</div>
    </div>
  );

  /* Nothing to arrange: whichever of the two is wanted takes the whole frame.
     A panel laid over a page this narrow covers all of it anyway, so covering
     it is what is done instead of drawing both. */
  if (placement === "replace") return <>{isOpen ? sheet : page}</>;

  return (
    <Drawer isExpanded={isOpen} isInline={placement === "share"} position="end">
      <DrawerContent
        panelContent={
          <DrawerPanelContent
            /* Set as a size rather than through the widths prop, whose steps
               jump from three quarters to the whole width. Over the page the
               sheet is what the reader is in, so it takes most of the room;
               beside it both halves are being read, so they take half each. */
            defaultSize={placement === "share" ? "50%" : "70%"}
            className={`agm-sheet__panel agm-sheet__panel--${placement}`}
          >
            <DrawerPanelBody hasNoPadding>{isOpen && sheet}</DrawerPanelBody>
          </DrawerPanelContent>
        }
      >
        <DrawerContentBody
          // @ts-expect-error: React 18 types have no `inert`, which the DOM
          // takes as an empty string.
          inert={placement === "overlay" && isOpen ? "" : undefined}
        >
          {page}
        </DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
}
