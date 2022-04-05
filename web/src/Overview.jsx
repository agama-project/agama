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

import React, { useState } from "react";
import { useInstallerClient } from "./context/installer";

import { Button, Modal, ModalVariant, Flex, FlexItem, Text } from "@patternfly/react-core";

import Layout from "./Layout";
import Category from "./Category";
import LanguageSelector from "./LanguageSelector";
import ProductSelector from "./ProductSelector";
import Storage from "./Storage";
import Users from "./Users";

import {
  EOS_FACT_CHECK as OverviewIcon,
  EOS_TRANSLATE as LanguagesSelectionIcon,
  EOS_VOLUME as HardDriveIcon,
  EOS_PACKAGES as ProductsIcon,
  EOS_MANAGE_ACCOUNTS as UsersIcon
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
    </Category>,
    <Category title="Users" icon={UsersIcon}>
      <Users />
    </Category>
  ];

  const InstallButton = () => {
    const [isOpen, setIsOpen] = useState(false);

    const open = () => setIsOpen(true);
    const close = () => setIsOpen(false);
    const install = () => client.manager.startInstallation();

    return (
      <>
        <Button isLarge variant="primary" onClick={open}>
          Install
        </Button>

        <Modal
          title="Confirm Installation"
          isOpen={isOpen}
          showClose={false}
          variant={ModalVariant.small}
          actions={[
            <Button key="accept" variant="primary" onClick={install}>
              Install
            </Button>,
            <Button key="back" variant="primary" onClick={close} autoFocus>
              Back
            </Button>
          ]}
        >
          <Text>
            If you continue, partitions on your hard disk will be modified according to the
            installation settings in the previous dialog.
          </Text>
          <Text>
            Go back and check the settings if you are unsure.
          </Text>
        </Modal>
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
    <Layout
      sectionTitle="Installation Summary"
      SectionIcon={OverviewIcon}
      FooterActions={InstallButton}
    >
      <Flex direction={{ default: "column" }}>{renderCategories()}</Flex>
    </Layout>
  );
}

export default Overview;
