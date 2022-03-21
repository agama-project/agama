/*
 * Copyright (c) [2022] SUSE LLC
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
import { useInstallerClient } from "./context/installer";

import { Button, Flex, FlexItem } from "@patternfly/react-core";

import Category from "./Category";
import LanguageSelector from "./LanguageSelector";
import ProductSelector from "./ProductSelector";
import Storage from "./Storage";
import { SectionTitle } from "./layout/SectionTitle";

import {
  EOS_FACT_CHECK as OverviewIcon,
  EOS_TRANSLATE as LanguagesSelectionIcon,
  EOS_VOLUME as HardDriveIcon,
  EOS_PACKAGES as ProductsIcon
} from "eos-icons-react";

function Overview() {
  const client = useInstallerClient();

  const categories = [
    <Category title="Language" icon={LanguagesSelectionIcon}>
      <LanguageSelector />
    </Category>,
    <Category title="Product" icon={ProductsIcon}>
      <ProductSelector />
    </Category>,
    <Category title="Target" icon={HardDriveIcon}>
      <Storage />
    </Category>
  ];

  const InstallButton = () => {
    return (
      <>
        <Button isLarge variant="primary" onClick={() => client.manager.startInstallation()}>
          Install
        </Button>
      </>
    );
  };

  const renderCategories = () => {
    return categories.map(category => (
      <FlexItem key={category.props.title} className="installation-overview-section">
        {category}
      </FlexItem>
    ));
  };

  return (
    <>
      <SectionTitle>Installation Summary</SectionTitle>
      <Flex direction={{ default: "column" }}>{renderCategories()}</Flex>
    </>
  );
}

export default Overview;
