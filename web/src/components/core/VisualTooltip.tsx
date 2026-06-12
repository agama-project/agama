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
import { Tooltip, TooltipProps } from "@patternfly/react-core";

export type VisualTooltipProps = {
  /** Text shown in the tooltip. */
  content: TooltipProps["content"];
  /** Placement relative to the trigger. Defaults to "bottom-end". */
  position?: TooltipProps["position"];
  /** The already-labelled control the tooltip describes. */
  children: React.ReactElement;
};

/**
 * A purely visual tooltip for controls that are already labelled.
 *
 * ## Why it exists
 *
 * Icon-only controls (a settings button, a menu toggle...) are clear to screen
 * reader users through their `aria-label`, but not to sighted users, who only
 * see a glyph. A tooltip closes that gap by surfacing the same text on hover or
 * focus.
 *
 * PatternFly's `Tooltip` defaults to `aria="describedby"`, which wires the
 * tooltip text onto the trigger as an accessible description, *in addition to*
 * its accessible name. When both carry the same text (the common case here),
 * screen readers announce it twice. This component sets `aria="none"` so the
 * tooltip stays out of the accessibility tree: it is shown only to sighted
 * users, and the trigger's own accessible name is left untouched.
 *
 * ## Proper usage
 *
 * The wrapped control **must provide its own accessible name** (e.g. an
 * `aria-label`, or visible text). This component does **not** label anything;
 * it only mirrors an existing label visually. Never use it as the sole label
 * of a control, otherwise screen reader users get an unnamed control.
 *
 * It can wrap a plain control or one managed by an overlay (a `Dropdown` menu
 * toggle, a `Popover` button...): the wrapped element keeps its own `ref`, so
 * the overlay's positioning keeps working.
 *
 * @example
 * <VisualTooltip content={_("Appearance")}>
 *   <Button aria-label={_("Appearance")}>
 *     <Icon name="routine" />
 *   </Button>
 * </VisualTooltip>
 */
export default function VisualTooltip({
  content,
  position = "bottom-end",
  children,
}: VisualTooltipProps) {
  return (
    <Tooltip content={content} aria="none" position={position}>
      {children}
    </Tooltip>
  );
}
