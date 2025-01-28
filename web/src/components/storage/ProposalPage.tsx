/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { Alert, Content, Grid, GridItem, SplitItem } from "@patternfly/react-core";
import { Page } from "~/components/core/";
import { Loading } from "~/components/layout";
import EncryptionField from "~/components/storage/EncryptionField";
import ProposalResultSection from "./ProposalResultSection";
import ProposalTransactionalInfo from "./ProposalTransactionalInfo";
import ConfigEditor from "./ConfigEditor";
import ConfigEditorMenu from "./ConfigEditorMenu";
import { toValidationError } from "~/utils";
import { useIssues } from "~/queries/issues";
import { IssueSeverity } from "~/types/issues";
import { useDeprecated, useDeprecatedChanges, useReprobeMutation } from "~/queries/storage";
import { _ } from "~/i18n";

export default function ProposalPage() {
  const isDeprecated = useDeprecated();
  const { mutateAsync: reprobe } = useReprobeMutation();

  useDeprecatedChanges();

  React.useEffect(() => {
    if (isDeprecated) reprobe().catch(console.log);
  }, [isDeprecated, reprobe]);

  const errors = useIssues("storage")
    .filter((s) => s.severity === IssueSeverity.Error)
    .map(toValidationError);

  const validProposal = errors.length === 0;

  if (isDeprecated) {
    return (
      <Page>
        <Page.Header>
          <Content component="h2">{_("Storage")}</Content>
        </Page.Header>

        <Page.Content>
          <Loading text={_("Reloading data, please wait...")} />
        </Page.Content>
      </Page>
    );
  }

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Storage")}</Content>
      </Page.Header>

      <Page.Content>
        <Grid hasGutter>
          <ProposalTransactionalInfo />
          {!validProposal && (
            <Alert variant="warning" title={_("Storage proposal not possible")}>
              {errors.map((e, i) => (
                <div key={i}>{e.message}</div>
              ))}
            </Alert>
          )}

          <GridItem sm={12} xl={8}>
            <Page.Section
              title={_("Installation Devices")}
              description={_(
                "Structure of the new system, including disks to use and additional devices like LVM volume groups.",
              )}
              actions={
                <>
                  <SplitItem isFilled> </SplitItem>
                  <SplitItem>
                    <ConfigEditorMenu />
                  </SplitItem>
                </>
              }
            >
              <ConfigEditor />
            </Page.Section>
          </GridItem>
          <GridItem sm={12} xl={4}>
            <EncryptionField password={""} isLoading={false} />
          </GridItem>
          {validProposal && <ProposalResultSection isLoading={false} />}
        </Grid>
      </Page.Content>
    </Page>
  );
}
