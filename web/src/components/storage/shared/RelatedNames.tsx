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
import SheetOpener from "~/components/storage/shared/SheetOpener";
import { formatListToParts } from "~/i18n";
import type { Related } from "~/components/storage/shared/users";

export type RelatedNamesProps = {
  items: Related[];
};

/**
 * Other entries of the plan, named in a sentence, each a way to itself.
 *
 * Naming something a reader can go to without offering the way there leaves
 * them to find it by hand in a list they may have to close this panel to see.
 *
 * The separators and the conjunction belong to the language, so the list is
 * punctuated by `Intl.ListFormat` and its pieces are put back around the names
 * rather than joined with a comma of ours.
 */
export default function RelatedNames({ items }: RelatedNamesProps): React.ReactNode {
  const parts = formatListToParts(items.map((item) => item.name));
  /* Matched by position rather than by name, since two entries may share one. */
  let at = -1;

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "literal")
          return <React.Fragment key={index}>{part.value}</React.Fragment>;

        at += 1;
        const item = items[at];

        return (
          <SheetOpener key={index} subject={item.subject}>
            {item.name}
          </SheetOpener>
        );
      })}
    </>
  );
}
