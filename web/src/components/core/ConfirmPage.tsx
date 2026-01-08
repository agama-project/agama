/*
 * Copyright (c) [2025] SUSE LLC
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
import { Navigate } from "react-router";
import { Button, Content, Flex, Split } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import Text from "~/components/core/Text";
import Details from "~/components/core/Details";
import HostnameDetailsItem from "~/components/system/HostnameDetailsItem";
import L10nDetailsItem from "~/components/l10n/L10nDetailsItem";
import StorageDetailsItem from "~/components/storage/StorageDetailsItem";
import NetworkDetailsItem from "~/components/network/NetworkDetailsItem";
import SoftwareDetailsItem from "~/components/software/SoftwareDetailsItem";
import PotentialDataLossAlert from "~/components/storage/PotentialDataLossAlert";
import { startInstallation } from "~/model/manager";
import { useProduct } from "~/hooks/model/config";
import { PRODUCT } from "~/routes/paths";
import { useDestructiveActions } from "~/hooks/use-destructive-actions";
import { _ } from "~/i18n";

export default function ConfirmPage() {
  const product = useProduct();
  const { actions } = useDestructiveActions();
  const hasDestructiveActions = actions.length > 0;

  if (!product) {
    return <Navigate to={PRODUCT.root} />;
  }

  // TRANSLATORS: title shown in the confirmation page before
  // starting the installation. %s will be replaced with the product name.
  const [titleStart, titleEnd] = _("Start %s installation?").split("%s");

  return (
    <Page>
      <Page.Content>
        <Flex
          direction={{ default: "column" }}
          gap={{ default: "gapMd" }}
          alignContent={{ default: "alignContentCenter" }}
          alignItems={{ default: "alignItemsFlexStart" }}
          justifyContent={{ default: "justifyContentCenter" }}
        >
          <Content component="h1">
            {titleStart} <span className="in-quotes">{product.name}</span> {titleEnd}
          </Content>
          <Content component="p" isEditorial>
            {
              // TRANSLATORS: Part of the introductory text shown in the confirmation page before
              // starting the installation.
              _(
                "Review the summary below. If anything seems incorrect or you have doubts, go back and adjust the settings before proceeding.",
              )
            }
          </Content>
          <PotentialDataLossAlert />
          <Details isHorizontal isCompact>
            <HostnameDetailsItem withoutLink />
            <L10nDetailsItem withoutLink />
            <StorageDetailsItem withoutLink />
            <NetworkDetailsItem withoutLink />
            <SoftwareDetailsItem withoutLink />
          </Details>

          <Split hasGutter style={{ marginBlock: "2rem" }}>
            <Button
              size="lg"
              variant={hasDestructiveActions ? "danger" : "primary"}
              onClick={startInstallation}
            >
              <Text isBold>
                {hasDestructiveActions
                  ? _("Install now with potential data loss")
                  : _("Install now")}
              </Text>
            </Button>
            <Page.Back size="lg">{_("Go back")}</Page.Back>
          </Split>
        </Flex>
      </Page.Content>
    </Page>
  );
}
