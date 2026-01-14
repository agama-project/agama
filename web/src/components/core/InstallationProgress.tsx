/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { Flex, Grid, GridItem, HelperText, HelperTextItem, Title } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import ProgressReport from "~/components/core/ProgressReport";
import Icon from "~/components/layout/Icon";
import ProductLogo from "../product/ProductLogo";
import { useProductInfo } from "~/hooks/model/config/product";
import { _ } from "~/i18n";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import alignmentStyles from "@patternfly/react-styles/css/utilities/Alignment/alignment";

export default function InstallationProgress() {
  const product = useProductInfo();

  return (
    <Page showInstallerOptions={false} hideProgressMonitor>
      <Page.Content>
        <Grid hasGutter style={{ height: "100%", placeContent: "center" }}>
          <GridItem sm={12} md={5} style={{ alignSelf: "center" }}>
            <Flex
              direction={{ default: "column" }}
              alignItems={{ default: "alignItemsCenter", md: "alignItemsFlexEnd" }}
              alignContent={{ default: "alignContentCenter", md: "alignContentFlexEnd" }}
              alignSelf={{ default: "alignSelfCenter" }}
            >
              <Icon name="deployed_code_update" width="3rem" height="3rem" />
              <Title
                headingLevel="h1"
                style={{ textWrap: "balance" }}
                className={[textStyles.fontSize_3xl, alignmentStyles.textAlignEndOnMd].join(" ")}
              >
                <ProductLogo product={product} width="1.25em" /> {product?.name}
              </Title>

              <HelperText>
                <HelperTextItem>{_("Installation in progress")}</HelperTextItem>
              </HelperText>
            </Flex>
          </GridItem>
          <GridItem sm={12} md={7}>
            <Flex
              gap={{ default: "gapMd" }}
              alignItems={{ default: "alignItemsCenter" }}
              style={{
                minBlockSize: "30dvh",
                boxShadow: "-1px 0 0 var(--pf-t--global--border--color--default)",
                paddingInlineStart: "var(--pf-t--global--spacer--md)",
                marginBlockStart: "var(--pf-t--global--spacer--xl)",
              }}
            >
              <ProgressReport />
            </Flex>
          </GridItem>
        </Grid>
      </Page.Content>
    </Page>
  );
}
