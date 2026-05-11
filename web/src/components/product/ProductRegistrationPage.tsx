/*
 * Copyright (c) [2023-2026] SUSE LLC
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

import React, { useCallback, useState } from "react";
import { sprintf } from "sprintf-js";
import { isEmpty } from "radashi";
import {
  Alert,
  Button,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  Divider,
  Title,
} from "@patternfly/react-core";
import { IssuesAlert, Link, NestedContent, Page } from "~/components/core";
import Interpolate from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import RegistrationExtension from "~/components/product/RegistrationExtension";
import ProductRegistrationForm from "~/components/product/ProductRegistrationForm";
import { useProposal } from "~/hooks/model/proposal";
import { useSystem } from "~/hooks/model/system/software";
import { useProductInfo } from "~/hooks/model/config/product";
import { useIssues } from "~/hooks/model/issue";
import { useConfig } from "~/hooks/model/config";
import { SYSTEM } from "~/routes/paths";
import { patchConfig } from "~/api";
import { mask } from "~/utils";
import { _ } from "~/i18n";

import type { Addon } from "~/model/config/product";

import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";

const RegisteredProductSection = () => {
  const product = useProductInfo();
  const { registration } = useSystem();
  const [showCode, setShowCode] = useState(false);
  const toggleCodeVisibility = () => setShowCode(!showCode);

  if (!product) return null;

  return (
    <>
      <Content isEditorial>
        {sprintf(_("%s has been registered with below information."), product.name)}
      </Content>
      <DescriptionList>
        <DescriptionListGroup>
          {!isEmpty(registration.url) && (
            <>
              <DescriptionListTerm>{_("Registration server")}</DescriptionListTerm>
              <DescriptionListDescription>{registration.url}</DescriptionListDescription>
            </>
          )}
          {!isEmpty(registration.code) && (
            <>
              <DescriptionListTerm>{_("Registration code")}</DescriptionListTerm>
              <DescriptionListDescription>
                <Flex gap={{ default: "gapSm" }}>
                  {showCode ? registration.code : mask(registration.code)}
                  <Button variant="link" isInline onClick={toggleCodeVisibility}>
                    {showCode ? _("Hide") : _("Show")}
                  </Button>
                </Flex>
              </DescriptionListDescription>
            </>
          )}
          {!isEmpty(registration.email) && (
            <>
              <DescriptionListTerm>{_("Email")}</DescriptionListTerm>
              <DescriptionListDescription>{registration.email}</DescriptionListDescription>
            </>
          )}
        </DescriptionListGroup>
      </DescriptionList>
    </>
  );
};

const HostnameAlert = () => {
  const { hostname: hostnameProposal } = useProposal();
  const { hostname: transientHostname, static: staticHostname } = hostnameProposal;
  const hostname = isEmpty(staticHostname) ? transientHostname : staticHostname;

  const title = _("Hostname cannot be changed after registration");

  return (
    <Alert isInline title={title} variant="custom">
      {!isEmpty(hostname) && (
        <Content isEditorial className={spacingStyles.mbXs}>
          <Interpolate
            sentence={
              // TRANSLATORS: %s will be replaced with the hostname value
              _("Configured as %s.")
            }
          >
            {() => <Text isBold>{hostname}</Text>}
          </Interpolate>
        </Content>
      )}
      <Content component="small">
        <Interpolate
          sentence={
            // TRANSLATORS: text in square brackets is the section name and will be
            // rendered as a link. Keep the brackets
            _("To change it, visit the [hostname] section before registering.")
          }
        >
          {(section) => (
            <Link variant="link" to={SYSTEM.root} isInline>
              {section}
            </Link>
          )}
        </Interpolate>
      </Content>
    </Alert>
  );
};

const Extensions = () => {
  const { registration } = useSystem();
  const { product } = useConfig();
  const extensions = registration?.addons;
  const issues = useIssues("product");

  const registrationCallback = useCallback(
    (addon: Addon) => {
      const updatedAddons = [addon];

      const addons: Addon[] = product?.addons || [];
      for (const a of addons) {
        if (a.id !== addon.id) {
          updatedAddons.push(addon);
        }
      }

      const updatedProduct = {
        ...product,
        addons: updatedAddons,
      };

      return patchConfig({ product: updatedProduct });
    },
    [product],
  );

  const noRegistrationCallback = useCallback(
    (id: string) => {
      const addons = product?.addons || [];
      const updatedAddons = addons.filter((a) => a.id !== id);
      return patchConfig({
        product: {
          ...product,
          addons: updatedAddons,
        },
      });
    },
    [product],
  );

  if (!extensions || extensions.length === 0) return null;

  const extensionComponents = extensions.map((ext) => {
    const issue = issues.find((i) => i.class === `addon_registration_failed[${ext.id}]`);
    const config = (product?.addons || []).find((c) => c.id === ext.id);

    return (
      <RegistrationExtension
        key={`extension-${ext.id}-${ext.version}`}
        extension={ext}
        config={config}
        issue={issue}
        isUnique={extensions.filter((e) => e.id === ext.id).length === 1}
        registrationCallback={registrationCallback}
        noRegistrationCallback={noRegistrationCallback}
      />
    );
  });

  return (
    <>
      <Divider />
      <Title headingLevel="h3">{_("Extensions")}</Title>
      <NestedContent>
        <Flex gap={{ default: "gap2xl" }} direction={{ default: "column" }}>
          {extensionComponents}
        </Flex>
      </NestedContent>
    </>
  );
};

export default function ProductRegistrationPage() {
  const { registration } = useSystem();
  const issues = useIssues("product");
  const registrationIssue = issues.find((i) => i.class === "system_registration_failed");
  const nonRegistrationIssues = issues.filter((i) => i.class !== "system_registration_failed");
  // Avoid repeating the alert after registration attempt
  const showHostnameAlert = !registration && !registrationIssue;

  return (
    <Page breadcrumbs={[{ label: _("Registration") }]}>
      <Page.Content>
        {showHostnameAlert && <HostnameAlert />}
        {!registration && <IssuesAlert issues={nonRegistrationIssues} />}
        {!registration ? <ProductRegistrationForm /> : <RegisteredProductSection />}
        {registration && <Extensions />}
      </Page.Content>
    </Page>
  );
}
