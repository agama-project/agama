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
import Link from "~/components/core/Link";
import { useSheet, SHEET_ID } from "~/components/storage/shared/use-sheet";
import type { SheetSubject } from "~/components/storage/shared/use-sheet";

export type SheetOpenerProps = {
  /** What the sheet shows once this is followed. */
  subject: SheetSubject;
  tab?: string;
  /**
   * How it is drawn: as a link within the text around it (the default), or as
   * a button where it stands apart from any text, such as among an alert's
   * actions. Either way it is a link.
   */
  variant?: "inline" | "button";
  /** What the control says, which has to name where it goes on its own. */
  children: React.ReactNode;
};

/**
 * The way into the storage page's sheet, wherever it is offered.
 *
 * The page offers it from several places, and they are one control rather than
 * several: a real link to the same page showing a different thing. So it is an
 * anchor with an address a reader can copy, open in a second tab, or come back
 * to after a reload, and never a button that says it goes somewhere.
 *
 * By default it carries no chrome of its own. What opens the sheet usually sits
 * inside a sentence or a table row, and a button's box drawn around it would
 * break the line it is being read as part of. Where it stands apart from any
 * text, it can be drawn as a button, and it is still a link.
 *
 * @example
 * <SheetOpener subject="result">{_("View all 5 needed actions")}</SheetOpener>
 *
 * @example
 * <SheetOpener subject="result" variant="button">{_("Check actions")}</SheetOpener>
 */
export default function SheetOpener({
  subject,
  tab,
  variant = "inline",
  children,
}: SheetOpenerProps): React.ReactNode {
  const { addressOf } = useSheet();
  const isButton = variant === "button";

  return (
    <Link
      to={addressOf(subject, tab)}
      replace
      variant={isButton ? "tertiary" : "link"}
      size={isButton ? "sm" : undefined}
      isInline={!isButton}
      aria-controls={SHEET_ID}
      /* So the list around it can walk its entries with the arrow keys without
         knowing how any of them is drawn. */
      data-entry-name=""
    >
      {children}
    </Link>
  );
}
