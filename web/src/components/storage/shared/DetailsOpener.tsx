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
import { useDeviceDetails, DETAILS_PANEL_ID } from "~/components/storage/shared/use-device-details";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";

export type DetailsOpenerProps = {
  /** What the panel shows once this is followed. */
  subject: DetailsSubject;
  /** What the control says, which has to name where it goes on its own. */
  children: React.ReactNode;
};

/**
 * The way into the storage page's panel, wherever it is offered.
 *
 * The page offers it from several places, and they are one control rather than
 * several: a real link to the same page showing a different thing. So it is an
 * anchor with an address a reader can copy, open in a second tab, or come back
 * to after a reload, and never a button that says it goes somewhere.
 *
 * It carries no chrome of its own. What opens the panel sits inside a sentence
 * or a table row, and a button's box drawn around it would break the line it is
 * being read as part of.
 *
 * @example
 * <DetailsOpener subject={{ collection: "drives", index: 0 }}>{name}</DetailsOpener>
 */
export default function DetailsOpener({ subject, children }: DetailsOpenerProps): React.ReactNode {
  const { addressOf } = useDeviceDetails();

  return (
    <Link
      to={addressOf(subject)}
      replace
      variant="link"
      isInline
      aria-controls={DETAILS_PANEL_ID}
      /* So the list around it can walk its entries with the arrow keys without
         knowing how any of them is drawn. */
      data-entry-name=""
    >
      {children}
    </Link>
  );
}
