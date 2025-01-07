/*
 * Copyright (c) [2023-2024] SUSE LLC
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
import { useLocation } from "react-router-dom";
import { Link } from "~/components/core";
import { useProduct, useRegistration } from "~/queries/software";
import { REGISTRATION, SUPPORTIVE_PATHS } from "~/routes/paths";
import { isEmpty } from "~/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

const LinkToRegistration = () => {
  const location = useLocation();

  if (location.pathname === REGISTRATION.root) return;

  return (
    <Link to={REGISTRATION.root} variant="primary">
      {_("Register it now")}
    </Link>
  );
};

export default function ProductRegistrationAlert() {
  const location = useLocation();
  const { selectedProduct: product } = useProduct();
  const registration = useRegistration();

  // NOTE: it shouldn't be mounted in these paths, but let's prevent rendering
  // if so just in case.
  if (SUPPORTIVE_PATHS.includes(location.pathname)) return;
  if (["no", undefined].includes(product.registration) || !isEmpty(registration.key)) return;

  return (
    <Alert isInline variant="warning" title={sprintf(_("%s must be registered."), product.name)}>
      <LinkToRegistration />
    </Alert>
  );
}
