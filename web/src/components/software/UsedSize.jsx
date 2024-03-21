/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import { Em } from "~/components/core";
import { _ } from "~/i18n";

export default function UsedSize({ size }) {
  if (size === undefined || size === "" || size === "0 B") return null;

  // TRANSLATORS: %s will be replaced by the estimated installation size,
  // example: "728.8 MiB"
  const [msg1, msg2] = _("Installation will take %s").split("%s");
  return (
    <>
      {msg1}
      <Em>{size}</Em>
      {msg2}
    </>
  );
}
