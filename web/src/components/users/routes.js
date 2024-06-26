/*
 * Copyright (c) [2024] SUSE LLC
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
import { Page } from "~/components/core";
import UsersPage from "./UsersPage";
import FirstUserForm from "./FirstUserForm";
import { N_ } from "~/i18n";

const routes = {
  path: "/users",
  element: <Page />,
  handle: {
    name: N_("Users"),
    icon: "manage_accounts"
  },
  children: [
    { index: true, element: <UsersPage /> },
    {
      path: "first",
      element: <FirstUserForm />
    },
    {
      path: "first/edit",
      element: <FirstUserForm />
    }
  ]
};

export default routes;
