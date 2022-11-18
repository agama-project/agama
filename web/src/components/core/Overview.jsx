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
import { useSoftware } from "./context/software";
import { useNavigate, Navigate } from "react-router-dom";

import { Button, Flex, FlexItem } from "@patternfly/react-core";

import { Title, PageIcon, PageActions, MainActions } from "./Layout";
import Category from "./Category";
import LanguageSelector from "./LanguageSelector";
import Storage from "./Storage";
import Users from "./Users";
import Network from "./Network";
import InstallButton from "./InstallButton";

import {
  EOS_SOFTWARE as OverviewIcon,
  EOS_TRANSLATE as LanguagesSelectionIcon,
  EOS_SETTINGS_ETHERNET as NetworkIcon,
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
    <Storage key="storage" showErrors />,
    <Users key="users" showErrors={showErrors} />
  ];

  const renderCategories = () => {
    return categories.map((category, i) => (
      <FlexItem key={i} className="installation-overview-section">
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
