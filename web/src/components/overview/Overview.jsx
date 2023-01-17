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
import { useSoftware } from "@context/software";
import { Navigate } from "react-router-dom";

import { Icon, Title, PageIcon, MainActions } from "@components/layout";
import { Section, InstallButton } from "@components/core";
import { LanguageSelector } from "@components/language";
import { SoftwareSection, StorageSection } from "@components/overview";
import { Users } from "@components/users";
import { Network } from "@components/network";

function Overview() {
  const { selectedProduct } = useSoftware();
  const [showErrors, setShowErrors] = useState(false);

  if (selectedProduct === null) {
    return <Navigate to="/products" />;
  }

  return (
    <>
      <Title>{selectedProduct && selectedProduct.name}</Title>
      <PageIcon><Icon name="inventory_2" /></PageIcon>
      <MainActions>
        <InstallButton onClick={() => setShowErrors(true)} />
      </MainActions>
      <Section key="language" title="Language" iconName="translate">
        <LanguageSelector />
      </Section>
      <Section key="network" title="Network" iconName="settings_ethernet">
        <Network />
      </Section>
      <StorageSection key="storage" showErrors />
      <SoftwareSection key="software" showErrors />
      <Users key="users" showErrors={showErrors} />
    </>
  );
}

export default Overview;
