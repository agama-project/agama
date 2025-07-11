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
import {
  Card,
  CardBody,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Truncate,
  Stack,
} from "@patternfly/react-core";
import { Link, Page } from "~/components/core";
import PasswordCheck from "~/components/users/PasswordCheck";
import { useRootUser, useRootUserChanges } from "~/queries/users";
import { USER } from "~/routes/paths";
import { isEmpty } from "radashi";
import { _ } from "~/i18n";

const SSHKeyLabel = ({ sshKey }) => {
  const trailingChars = Math.min(sshKey.length - sshKey.lastIndexOf(" "), 30);

  return <Truncate content={sshKey} trailingNumChars={trailingChars} position="middle" />;
};

export default function RootUser() {
  const { password, sshPublicKey } = useRootUser();
  useRootUserChanges();

  return (
    <Page.Section
      title={_("Root user")}
      description={_(
        "Alongside defining the first user, authentication methods for the root user can be configured.",
      )}
      actions={<Link to={USER.rootUser.edit}>{_("Edit")}</Link>}
    >
      <Card isCompact isPlain>
        <CardBody>
          <Stack hasGutter>
            <DescriptionList isHorizontal isFluid displaySize="lg" isCompact>
              <DescriptionListGroup>
                <DescriptionListTerm>{_("Password")}</DescriptionListTerm>
                <DescriptionListDescription>
                  {password ? _("Defined (hidden)") : _("Not defined")}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>{_("Public SSH Key")}</DescriptionListTerm>
                <DescriptionListDescription>
                  {isEmpty(sshPublicKey) ? _("Not defined") : <SSHKeyLabel sshKey={sshPublicKey} />}
                </DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
            {password && <PasswordCheck password={password} />}
          </Stack>
        </CardBody>
      </Card>
    </Page.Section>
  );
}
