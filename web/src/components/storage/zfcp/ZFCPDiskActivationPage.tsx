/*
 * Copyright (c) [2024-2025] SUSE LLC
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

import React, { useState } from "react";
import { Content, Grid, GridItem } from "@patternfly/react-core";
import { Page } from "~/components/core";
import { _ } from "~/i18n";
import { useCancellablePromise } from "~/hooks/use-cancellable-promise";
import { LUNInfo } from "~/types/zfcp";
import { activateZFCPDisk } from "~/api/storage/zfcp";
import { PATHS } from "~/routes/storage";
import { useNavigate } from "react-router-dom";
import ZFCPDiskForm from "./ZFCPDiskForm";
import { useZFCPControllersChanges, useZFCPDisksChanges } from "~/queries/storage/zfcp";

export default function ZFCPDiskActivationPage() {
  useZFCPControllersChanges();
  useZFCPDisksChanges();
  const [isAcceptDisabled, setIsAcceptDisabled] = useState(false);
  const { cancellablePromise } = useCancellablePromise();
  const navigate = useNavigate();

  const onSubmit = async (formData: LUNInfo & { id: string }) => {
    setIsAcceptDisabled(true);
    const result = (await cancellablePromise(
      activateZFCPDisk(formData.id, formData.wwpn, formData.lun),
    )) as Awaited<ReturnType<typeof activateZFCPDisk>>;
    if (result.status === 200) navigate(PATHS.zfcp.root);

    setIsAcceptDisabled(false);
    return result;
  };

  const onLoading = (isLoading: boolean) => {
    setIsAcceptDisabled(isLoading);
  };

  const formId = "ZFCPDiskForm";

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("zFCP Disk Activation")}</Content>
      </Page.Header>

      <Page.Content>
        <Grid hasGutter>
          <GridItem sm={12} xl={12}>
            <ZFCPDiskForm id={formId} onSubmit={onSubmit} onLoading={onLoading} />
          </GridItem>
        </Grid>
      </Page.Content>

      <Page.Actions>
        <Page.Submit form={formId} disabled={isAcceptDisabled} />
        <Page.Cancel navigateTo={PATHS.zfcp.root} />
      </Page.Actions>
    </Page>
  );
}
