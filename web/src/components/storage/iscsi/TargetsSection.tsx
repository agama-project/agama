/*
 * Copyright (c) [2023-2024] SUSE LLC
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

import React, { useState } from "react";
import { Button, Toolbar, ToolbarItem, ToolbarContent, Stack } from "@patternfly/react-core";
import { Section } from "~/components/core";
import { NodesPresenter, DiscoverForm } from "~/components/storage/iscsi";
import { _ } from "~/i18n";
import { useNodes, useNodesChanges } from "~/queries/storage/iscsi";
import { discover } from "~/api/storage/iscsi";

export default function TargetsSection() {
  const [isDiscoverFormOpen, setIsDiscoverFormOpen] = useState<boolean>(false);
  const nodes = useNodes();
  useNodesChanges();

  const openDiscoverForm = () => setIsDiscoverFormOpen(true);
  const closeDiscoverForm = () => setIsDiscoverFormOpen(false);

  const submitDiscoverForm = async (data) => {
    const { username, password, reverseUsername, reversePassword } = data;
    const success = await discover(data.address, parseInt(data.port), {
      username,
      password,
      reverseUsername,
      reversePassword,
    });

    if (success) closeDiscoverForm();

    return success;
  };

  const SectionContent = () => {
    if (nodes.length === 0) {
      return (
        <Stack hasGutter>
          <div>{_("No iSCSI targets found.")}</div>
          <div>
            {_("Please, perform an iSCSI discovery in order to find available iSCSI targets.")}
          </div>
          {/* TRANSLATORS: button label, starts iSCSI discovery */}
          <Button variant="primary" onClick={openDiscoverForm}>
            {_("Discover iSCSI targets")}
          </Button>
        </Stack>
      );
    }

    return (
      <>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem align={{ default: "alignRight" }}>
              {/* TRANSLATORS: button label, starts iSCSI discovery */}
              <Button onClick={openDiscoverForm}>{_("Discover")}</Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
        <NodesPresenter nodes={nodes} />
      </>
    );
  };

  return (
    // TRANSLATORS: iSCSI targets section title
    <Section title={_("Targets")}>
      <SectionContent />
      {isDiscoverFormOpen && (
        <DiscoverForm onSubmit={submitDiscoverForm} onCancel={closeDiscoverForm} />
      )}
    </Section>
  );
}
