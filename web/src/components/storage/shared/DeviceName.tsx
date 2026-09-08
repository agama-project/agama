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
import { deviceSize } from "~/components/storage/utils";

export type DeviceNameProps = {
  /** What it is called, as the page shows names: `vdd`, not `/dev/vdd`. */
  name: React.ReactNode;
  /** How big it is, in bytes, where the page has a size to give. */
  size?: number;
};

/**
 * A device named inside a sentence: what it is called, and how big it is.
 *
 * The name is set as a value and the size follows it in brackets, both smaller
 * and lighter than the sentence around them. At a heading's own weight a
 * monospaced name reads as something to press; smaller and at body weight it
 * reads as what it is, a value quoted inside the words about it, without a
 * border or a colour doing the work.
 *
 * The size is one node with the name rather than a placeholder of its own,
 * since the brackets are punctuation around a value rather than part of the
 * sentence, and a translator has no decision to make about them. It is left out
 * where there is no size to show, which is how a volume group being defined is
 * named.
 *
 * @example
 * <Interpolate sentence={_("Use disk %s as installation device")}>
 *   {() => <DeviceName name="vdd" size={21474836480} />}
 * </Interpolate>
 */
export default function DeviceName({ name, size }: DeviceNameProps) {
  return (
    <>
      <code className="agm-device-name">{name}</code>
      {size !== undefined && <span className="agm-device-name__size"> ({deviceSize(size)})</span>}
    </>
  );
}
