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
import { useSoftware } from "./context/software";
import { useNavigate, Navigate } from "react-router-dom";

import { Button, Flex, FlexItem, Text } from "@patternfly/react-core";

import { Title, PageIcon, PageActions, MainActions } from "./Layout";
import Category from "./Category";
import LanguageSelector from "./LanguageSelector";
import Storage from "./Storage";
import Users from "./Users";
import Network from "./Network";
import Popup from "./Popup";

import {
  EOS_SOFTWARE as OverviewIcon,
  EOS_TRANSLATE as LanguagesSelectionIcon,
  EOS_VOLUME as HardDriveIcon,
  EOS_SETTINGS_ETHERNET as NetworkIcon,
  EOS_MANAGE_ACCOUNTS as UsersIcon,
  EOS_MODE_EDIT as ModeEditIcon
} from "eos-icons-react";

const ChangeProductButton = () => {
  const { products } = useSoftware();
  const navigate = useNavigate();

  if (products === undefined || products.length === 1) {
    return "";
  }

  return (
    <Button
      isSmall
      variant="plain"
      icon={<ModeEditIcon />}
      aria-label="Change selected product"
      onClick={() => navigate("/products")}
    />
  );
};

const InstallConfirmationPopup = ({ onAccept, onClose }) => (
  <Popup
    title="Confirm Installation"
    isOpen="true"
  >
    <Text>
      If you continue, partitions on your hard disk will be modified according to the
      installation settings in the previous dialog.
    </Text>
    <Text>
      Please, cancel and check the settings if you are unsure.
    </Text>

    <Popup.Actions>
      <Popup.Confirm onClick={onAccept}>Install</Popup.Confirm>
      <Popup.Cancel onClick={onClose} autoFocus />
    </Popup.Actions>
  </Popup>
);

const CannotInstallPopup = ({ onClose }) => (
  <Popup
    title="Confirm Installation"
    isOpen="true"
  >
    <Text>
      Some problems were detected when trying to start the installation.
      Please, have a look to the reported issues and try again after addressing them.
    </Text>

    <Popup.Actions>
      <Popup.Cancel onClick={onClose} autoFocus />
    </Popup.Actions>
  </Popup>
);

const renderPopup = (error, { onAccept, onClose }) => {
  if (error) {
    return <CannotInstallPopup onClose={onClose} />;
  } else {
    return <InstallConfirmationPopup onClose={onClose} onAccept={onAccept} />;
  }
};

const InstallButton = ({ onClick }) => {
  const client = useInstallerClient();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(false);

  const open = () => {
    onClick();
    client.manager.canInstall().then(ok => {
      setError(!ok);
      setIsOpen(true);
    });
  };
  const close = () => setIsOpen(false);
  const install = () => client.manager.startInstallation();

  return (
    <>
      <Button isLarge variant="primary" onClick={open}>
        Install
      </Button>

      { isOpen && renderPopup(error, { onAccept: install, onClose: close }) }
    </>
  );
};

function Overview() {
  const { selectedProduct } = useSoftware();
  const [showErrors, setShowErrors] = useState(false);

  if (selectedProduct === null) {
    return <Navigate to="/products" />;
  }

  const categories = [
    <Category key="language" title="Language" icon={LanguagesSelectionIcon}>
      <LanguageSelector />
    </Category>,
    <Category key="network" title="Network" icon={NetworkIcon}>
      <Network />
    </Category>,
    <Category key="storage" title="Storage" icon={HardDriveIcon}>
      <Storage showErrors />
    </Category>,
    <Category key="users" title="Users" icon={UsersIcon}>
      <Users showErrors={showErrors} />
    </Category>
  ];

  const renderCategories = () => {
    return categories.map(category => (
      <FlexItem key={category.props.title} className="installation-overview-section">
        {category}
      </FlexItem>
    ));
  };

  return (
    <>
      <Title>{selectedProduct && selectedProduct.name}</Title>
      <PageIcon><OverviewIcon /></PageIcon>
      <PageActions><ChangeProductButton /></PageActions>
      <MainActions><InstallButton onClick={() => setShowErrors(true)} /></MainActions>
      <Flex direction={{ default: "column" }}>{renderCategories()}</Flex>
    </>
  );
}

export default Overview;
