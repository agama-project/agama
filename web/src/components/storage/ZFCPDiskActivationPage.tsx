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

// cspell:ignore wwpns npiv

import React, { useState } from "react";
import { Grid, GridItem, Stack } from "@patternfly/react-core";
import { Page } from "~/components/core";
import { ZFCPDiskForm } from "~/components/storage";
import { _ } from "~/i18n";
import { useCancellablePromise } from "~/utils";
import { LUNInfo } from "~/types/zfcp";
import { activateZFCPDisk } from "~/api/zfcp";
import { PATHS } from "~/routes/storage";
import { useNavigate } from "react-router-dom";

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
        <h2>{_("ZFCP Disk Activation")}</h2>
      </Page.Header>
      <Page.MainContent>
        <Grid hasGutter>
          <GridItem sm={12} xl={12}>
            <Page.CardSection isFullHeight>
              <Stack hasGutter>
                <ZFCPDiskForm id={formId} onSubmit={onSubmit} onLoading={onLoading} />
              </Stack>
            </Page.CardSection>
          </GridItem>
        </Grid>
      </Page.MainContent>
      <Page.NextActions>
        <Page.CancelAction navigateTo={PATHS.zfcp.root}>{_("Close")}</Page.CancelAction>
        <Page.Action form={formId} type="submit" disabled={isAcceptDisabled}>
          {_("Accept")}
        </Page.Action>
      </Page.NextActions>
    </Page>
  );
}
