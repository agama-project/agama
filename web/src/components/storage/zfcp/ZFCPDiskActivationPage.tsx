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

import React, { useState } from "react";
import { Grid, GridItem } from "@patternfly/react-core";
import { Page } from "~/components/core";
import { _ } from "~/i18n";
import { useCancellablePromise } from "~/utils";
import { LUNInfo } from "~/types/zfcp";
import { activateZFCPDisk } from "~/api/zfcp";
import { PATHS } from "~/routes/storage";
import { useNavigate } from "react-router-dom";
import ZFCPDiskForm from "./ZFCPDiskForm";

export default function ZFCPDiskActivationPage() {
  const [isAcceptDisabled, setIsAcceptDisabled] = useState(false);
  const { cancellablePromise } = useCancellablePromise();
  const navigate = useNavigate();

  const onSubmit = async (formData: LUNInfo & { id: string }) => {
    setIsAcceptDisabled(true);
    const result = await cancellablePromise(
      activateZFCPDisk(formData.id, formData.wwpn, formData.lun),
    );
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
        <h2>{_("zFCP Disk Activation")}</h2>
      </Page.Header>

      <Page.Content>
        <Grid hasGutter>
          <GridItem sm={12} xl={12}>
            <ZFCPDiskForm id={formId} onSubmit={onSubmit} onLoading={onLoading} />
          </GridItem>
        </Grid>
      </Page.Content>

      <Page.Actions>
        <Page.Cancel navigateTo={PATHS.zfcp.root} />
        <Page.Submit form={formId} disabled={isAcceptDisabled} />
      </Page.Actions>
    </Page>
  );
}
