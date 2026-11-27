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
  /** The entry the panel opens on. */
  subject: DetailsSubject;
  /** The link text, which must name the entry on its own. */
  children: React.ReactNode;
};

/**
 * A link opening the storage page panel on an entry. A real link, so it can be
 * copied, opened in another tab or reloaded, and inline, since it sits inside
 * sentences and table rows.
 *
 * @example
 * <DetailsOpener subject={{ collection: "drives", index: 0 }}>{name}</DetailsOpener>
 */
export default function DetailsOpener({ subject, children }: DetailsOpenerProps): React.ReactNode {
  const { addressOf } = useDeviceDetails();

  return (
    <Link to={addressOf(subject)} replace variant="link" isInline aria-controls={DETAILS_PANEL_ID}>
      {children}
    </Link>
  );
}
