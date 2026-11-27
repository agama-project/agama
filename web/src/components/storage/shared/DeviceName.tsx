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
  /** The device name without `/dev/`, such as `vdd`. */
  name: React.ReactNode;
  /** The device size in bytes, if known. */
  size?: number;
};

/**
 * A device name inside a sentence, with its size in brackets when known. Both
 * are smaller and lighter than the sentence, so the name reads as a quoted
 * value rather than as something to press.
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
