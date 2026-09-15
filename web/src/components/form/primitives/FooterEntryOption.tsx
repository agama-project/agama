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
import { Divider, SelectOption } from "@patternfly/react-core";
import Text from "~/components/core/Text";
import { _ } from "~/i18n";

import type { TranslatedString } from "~/i18n";

/**
 * The last entry of the list, offering something other than a value.
 *
 * Activating it closes the list and leaves the field untouched. What it does
 * from there is up to `onSelect`: open a dialog, go to another page, start
 * creating something the list cannot offer yet.
 *
 * ## Why it lives in the list, not beside the field
 *
 * A second control beside the field would do one job with two elements, and
 * put a tab stop in everyone's path for help that is not always needed. An
 * entry inside the list costs nothing to whoever does not open it, and sits
 * where the user already is when the values on offer turn out not to be
 * enough. Give the route a control of its own only when most users are
 * expected to take it.
 *
 * ## Why not PatternFly's MenuFooter
 *
 * That footer renders outside the list, so whatever it holds is not an option:
 * it falls out of the arrow key sequence and of what a screen reader
 * announces. This entry is a real option, reached like any other.
 *
 * ## Saying that it leads somewhere
 *
 * ARIA does not allow `aria-haspopup` on an option, and there is nowhere else
 * to put it: the list admits only options, and a control outside the list is
 * unreachable with PatternFly's key handling.
 *
 * The label does that work. Keep it to two or three words ending in an
 * ellipsis, the usual sign that more follows rather than a value being set.
 *
 * An ellipsis is silent when read aloud. Set `opensDialog` and screen reader
 * users hear "Opens a dialog" after the label. Set `hint` to have them hear
 * something else.
 */
type FooterEntry = {
  /** Text shown in the entry. */
  label: React.ReactNode;
  /** Called when the user activates the entry. */
  onSelect: () => void;
  /**
   * Whether activating the entry opens a dialog, the most common case. It adds
   * a standard hint after the label for screen reader users, which ARIA cannot
   * express on an option through `aria-haspopup`.
   */
  opensDialog?: boolean;
  /**
   * Replaces that hint for an entry doing something else. Wins over
   * {@link opensDialog}, and works on its own.
   */
  hint?: TranslatedString;
};

/**
 * Value carried by the footer entry.
 *
 * A select reports every activation through a single callback that hands back
 * only the value of what was activated, so the footer entry needs a value of
 * its own to be told apart from the real options. It is never committed to the
 * field, and no realistic field value looks like it.
 */
const FOOTER_ENTRY_VALUE = "form-field/footer-entry";

/** What a screen reader hears after the label, when the entry asks for a hint. */
function footerEntryHint(entry: FooterEntry): TranslatedString | undefined {
  if (entry.hint) return entry.hint;
  // TRANSLATORS: told to screen reader users about an entry that opens a
  // dialog, since the ellipsis ending its text says nothing when read aloud.
  if (entry.opensDialog) return _("Opens a dialog");
  return undefined;
}

type FooterEntryOptionProps = {
  entry: FooterEntry;
  /** Whether a separator is drawn above, to set the entry apart from the values. */
  hasDivider?: boolean;
  /** DOM id, for a field pointing at the entry through `aria-activedescendant`. */
  id?: string;
  /** Whether the entry currently carries the list highlight. */
  isFocused?: boolean;
  /** Extra classes for the entry, for a list that pins it in place. */
  className?: string;
};

/**
 * Renders a {@link FooterEntry} as the last option of a list, after a
 * separator.
 *
 * Belongs inside the list of a field offering options, as the final child, so
 * arrow keys reach it and screen readers count it among the options.
 */
export default function FooterEntryOption({
  entry,
  hasDivider = true,
  id,
  isFocused,
  className,
}: FooterEntryOptionProps) {
  const hint = footerEntryHint(entry);

  return (
    <>
      {hasDivider && <Divider component="li" />}
      <SelectOption id={id} value={FOOTER_ENTRY_VALUE} isFocused={isFocused} className={className}>
        {entry.label}
        {hint && <Text srOnly>{hint}</Text>}
      </SelectOption>
    </>
  );
}

export { FOOTER_ENTRY_VALUE };
export type { FooterEntry, FooterEntryOptionProps };
