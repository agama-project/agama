/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { useProductInfo } from "~/hooks/model/config/product";
import { PRODUCT } from "~/routes/paths";
import { useDestructiveActions } from "~/hooks/use-destructive-actions";
import { _ } from "~/i18n";

export default function ConfirmPage() {
  const product = useProductInfo();
  const { actions } = useDestructiveActions();
  const hasDestructiveActions = actions.length > 0;

  if (!product) {
    return <Navigate to={PRODUCT.root} />;
  }

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
          <Content component="h1">{product.name}</Content>
          <Content component="p" isEditorial>
            {
              // TRANSLATORS: Introductory text shown in the overview page
              // either, after selecting a product or before starting the
              // installation.
              _(
                "Review installation settings below and adjust them as needed before starting the installation process.",
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
          </Split>
        </Flex>
      </Page.Content>
    </Page>
  );
}
