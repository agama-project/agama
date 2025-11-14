/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { Alert } from "@patternfly/react-core";
import { useLocation } from "react-router";
import { Link } from "~/components/core";
import { REGISTRATION, SIDE_PATHS } from "~/routes/paths";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { useScopeIssues, useSelectedProduct } from "~/hooks/api";

const LinkToRegistration = ({ text }: { text: string }) => {
  const location = useLocation();

  if (location.pathname === REGISTRATION.root) return text;

  return (
    <Link to={REGISTRATION.root} variant="link" isInline>
      {text}
    </Link>
  );
};

export default function ProductRegistrationAlert() {
  const location = useLocation();
  const product = useSelectedProduct();
  // FIXME: what scope reports these issues with the new API?
  const issues = useScopeIssues("product");
  const registrationRequired = issues?.find((i) => i.kind === "missing_registration");

  // NOTE: it shouldn't be mounted in these paths, but let's prevent rendering
  // if so just in case.
  if (SIDE_PATHS.includes(location.pathname)) return;
  if (!registrationRequired) return;

  const [textStart, text, textEnd] = sprintf(_("%s [must be registered]."), product.name).split(
    /[[\]]/,
  );

  return (
    <Alert
      variant="warning"
      title={
        <>
          {textStart}
          <LinkToRegistration text={text} />
          {textEnd}
        </>
      }
    />
  );
}
