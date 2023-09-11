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
import { useNavigate } from "react-router-dom";
import { Button } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { Title as PageTitle, MainActions } from "~/components/layout";
import { InitiatorSection, TargetsSection } from "~/components/storage/iscsi";

export default function ISCSIPage() {
  const navigate = useNavigate();

  return (
    <>
      {/* TRANSLATORS: page title for iSCSI configuration */}
      <PageTitle>{_("Storage iSCSI")}</PageTitle>
      <MainActions>
        <Button size="lg" variant="secondary" form="storage-config" onClick={() => navigate("/storage")}>
          {_("Back")}
        </Button>
      </MainActions>

      <InitiatorSection />
      <TargetsSection />
    </>
  );
}
