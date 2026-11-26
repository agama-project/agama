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
import DetailsOpener from "~/components/storage/shared/DetailsOpener";
import { formatListToParts } from "~/i18n";
import type { Related } from "~/components/storage/shared/users";

export type RelatedNamesProps = {
  /** The entries to name, in order. */
  items: Related[];
};

/**
 * A list of related storage entries inside a sentence, such as the disks a
 * volume group takes room from. Each name links to its panel when the entry is
 * in the configuration, and stays plain text otherwise. The separators come
 * from the language (`Intl.ListFormat`).
 *
 * @example
 * // "LVM physical volumes will be added as partitions on vdb and vdc.",
 * // with "vdb" linking to its panel and "vdc" plain text.
 * <Interpolate sentence={_("LVM physical volumes will be added as partitions on %s.")}>
 *   {() => (
 *     <RelatedNames
 *       items={[{ name: "vdb", subject: { collection: "drives", index: 0 } }, { name: "vdc" }]}
 *     />
 *   )}
 * </Interpolate>
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

        /* Plain text when there is no panel to open. */
        if (!item.subject) return <React.Fragment key={index}>{item.name}</React.Fragment>;

        return (
          <DetailsOpener key={index} subject={item.subject}>
            {item.name}
          </DetailsOpener>
        );
      })}
    </>
  );
}
