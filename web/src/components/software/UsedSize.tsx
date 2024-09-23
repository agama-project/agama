/*
 * Copyright (c) [2023] SUSE LLC
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
import { EmptyState } from "~/components/core";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

export default function UsedSize({ size }: { size?: string }) {
  if (size === undefined || size === "" || size === "0 B") return null;

  // TRANSLATORS: %s will be replaced by the estimated installation size,
  // example: "728.8 MiB"
  const message = sprintf(_("Installation will take %s."), size);

  return (
    <EmptyState title={message} icon="info" color="success-color-100">
      <p>{_("This space includes the base system and the selected software patterns, if any.")}</p>
    </EmptyState>
  );
}
