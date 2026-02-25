/*
 * Copyright (c) [2026] SUSE LLC
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
import Summary from "~/components/core/Summary";
import Link from "~/components/core/Link";
import Text from "~/components/core/Text";
import { useProductInfo } from "~/hooks/model/config/product";
import { REGISTRATION } from "~/routes/paths";
import { _ } from "~/i18n";
import { useSystem } from "~/hooks/model/system/software";
import { useIssues } from "~/hooks/model/issue";

const RegistrationMessage = ({ code }: { code?: string }) => {
  if (!code) {
    return <>{_("Registered without a code")}</>;
  }

  // TRANSLATORS: Brief summary about the product registration.
  // %s will be replaced with the last 4 digits of the registration code.
  const [descriptionStart, descriptionEnd] = _("Using code ending in %s").split("%s");

  return (
    <>
      {descriptionStart}{" "}
      <Text isBold>
        <small>{code.slice(-4)}</small>
      </Text>{" "}
      {descriptionEnd}
    </>
  );
};

/**
 * Internal component that renders the registration summary content.
 *
 * Separated from the parent to avoid unnecessary hook calls when the product
 * doesn't support registration.
 *
 */
const Content = () => {
  const { registration } = useSystem();
  const issues = useIssues("software");
  const hasIssues = issues.find((i) => i.class === "software.missing_registration") !== undefined;

  return (
    <Summary
      hasIssues={hasIssues}
      icon="app_registration"
      title={
        <Link to={REGISTRATION.root} variant="link" isInline>
          {_("Registration")}
        </Link>
      }
      value={registration ? _("Registered") : _("Not registered yet")}
      description={registration && <RegistrationMessage code={registration.code} />}
    />
  );
};

/**
 * Renders a summary of product registration status.
 *
 * Only renders if the product supports registration.
 */
export default function RegistrationSummary() {
  const product = useProductInfo();

  if (!product || !product.registration) return null;

  return <Content />;
}
