/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { Link, useLocation } from "react-router-dom";
import { useSoftware } from "~/context/software";
import { Icon } from "~/components/layout";

export default function ChangeProductLink() {
  const { products } = useSoftware();
  const { pathname } = useLocation();
  const multiProduct = products?.length > 1;

  if (!multiProduct || pathname === "/products") {
    return null;
  }

  return (
    <Link to="/products">
      <Icon name="edit_square" size="24" />
      Change selected product
    </Link>
  );
}
