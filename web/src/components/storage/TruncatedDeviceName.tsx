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
import VisualTooltip from "~/components/core/VisualTooltip";
import { deviceBaseName } from "~/components/storage/utils";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";

import type { Storage } from "~/model/system";

/** Props for {@link TruncatedDeviceName}. */
type TruncatedDeviceNameProps = {
  /** The device to render the name of. */
  device: Storage.Device;
  /**
   * Maximum characters to show before truncating. Set it to match the width of
   * the container (e.g. a table column) so the name fits. Defaults to the shared
   * device-name length when omitted.
   */
  maxLength?: number;
};

/**
 * Renders a device's base name, truncated to fit narrow containers.
 *
 * When the name is too long to fit, it is shortened with an ellipsis in the
 * middle and the full name becomes the element's accessible name (via a
 * visually-hidden span), so screen reader users get it without needing to
 * interact with anything, sidestepping WCAG 1.4.13 (Content on Hover or
 * Focus) for them entirely. A tooltip mirrors it visually for mouse users on
 * hover; PF's Tooltip already satisfies 1.4.13's own dismissible, hoverable
 * and persistent requirements for that part. Neither adds a tab stop: each
 * row already has a selection checkbox or radio to tab through, and a second
 * stop per row just to reveal a name would get in the way of reaching it.
 *
 * Known gap: a sighted keyboard-only user with no mouse and no screen reader
 * has no way to reveal the full name. Closing it would mean attaching the
 * tooltip to the row's own selection control instead, so it rides that
 * control's existing tab stop rather than adding a new one.
 *
 * Names that already fit render as plain text, with no tooltip.
 */
export default function TruncatedDeviceName({ device, maxLength }: TruncatedDeviceNameProps) {
  const name = deviceBaseName(device);
  const truncatedName = deviceBaseName(device, { truncate: true, maxLength });

  if (truncatedName === name) return name;

  return (
    <VisualTooltip content={name}>
      <span>
        <span aria-hidden>{truncatedName}</span>
        <span className={a11yStyles.screenReader}>{name}</span>
      </span>
    </VisualTooltip>
  );
}
