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
import { Button } from "@patternfly/react-core";
import Interpolate from "~/components/core/Interpolate";
import Statement, { Statements } from "~/components/storage/device-sheet/Statement";
import type { TranslatedString } from "~/i18n";

export type TabNoteProps = {
  /** What the view holds. */
  lead: TranslatedString;
  /**
   * Where what it holds is decided, as a whole sentence with the names of the
   * other views in it as placeholders.
   */
  where?: TranslatedString;
  /** The views named in {@link where}, in placeholder order, and how to reach each. */
  links?: { name: TranslatedString; onGo: () => void }[];
  /**
   * Anything else true about the entry that the view opens with, as further
   * {@link Statement}s. They join the note's own run rather than starting a
   * second one.
   */
  children?: React.ReactNode;
};

/**
 * The sentence a view of the sheet opens with: what it holds, and then where
 * what it holds is decided.
 *
 * Two parts rather than one paragraph. The second is the one a reader acts on,
 * and it is lost at the end of a wrapped sentence.
 *
 * Naming another view is offering the way to it, so each name is a control. The
 * sentence is written whole with the names as placeholders, since splitting it
 * around the controls would leave a translator with pieces rather than a
 * sentence.
 *
 * Whatever else the view opens with is passed in and joins this run. What is
 * said above the content is one block of prose however many facts it holds, and
 * a view that starts its own run under this one rules the same words off twice
 * and pushes the content it is about further down the panel.
 */
export default function TabNote({
  lead,
  where,
  links = [],
  children,
}: TabNoteProps): React.ReactNode {
  return (
    <Statements>
      {/* The mark points into the view rather than describing the device. A
          help circle reads as a control to press for more. */}
      <Statement icon="last_page" heading={lead} isStacked>
        {where && (
          <Interpolate sentence={where}>
            {links.map((link) => () => (
              <Button key={link.name} variant="link" isInline onClick={() => link.onGo()}>
                {link.name}
              </Button>
            ))}
          </Interpolate>
        )}
      </Statement>
      {children}
    </Statements>
  );
}
