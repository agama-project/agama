/*
 * Copyright (c) [2024] SUSE LLC
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

import { RouteObject } from "react-router-dom";

type RouteHandle = {
  /** Text to be used as label when building a link from route information */
  name: string;
  /** Text to be shown in the layour header as an h1 */
  title?: string;
  /** Icon for representing the route in some places, like a menu entry */
  icon?: string;
};

type Route = RouteObject & { handle?: RouteHandle };

export type { Route };
