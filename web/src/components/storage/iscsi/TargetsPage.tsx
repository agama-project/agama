/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { Page } from "~/components/core";
import { DiscoverForm } from "~/components/storage/iscsi";
import { _ } from "~/i18n";
import { discover } from "~/model/storage/iscsi";
import { STORAGE } from "~/routes/paths";

export default function TargetsPage() {
  const onSubmit = async (data) => {
    const { username, password, reverseUsername, reversePassword } = data;
    const success = await discover(data.address, parseInt(data.port), {
      username,
      password,
      reverseUsername,
      reversePassword,
    });

    // FIXME, success is not to be returned
    return success;
  };
  return (
    <Page
      breadcrumbs={[
        { label: _("Storage"), path: STORAGE.root },
        { label: _("iSCSI"), path: STORAGE.iscsi.root },
        { label: _("Discover targets") },
      ]}
    >
      <Page.Content>
        <DiscoverForm onSubmit={onSubmit} onCancel={() => {}} />
      </Page.Content>
    </Page>
  );
}
