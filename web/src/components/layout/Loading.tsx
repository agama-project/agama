/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { Bullseye, EmptyState, Spinner } from "@patternfly/react-core";
import { PlainLayout } from "~/components/layout";
import { LayoutProps } from "~/components/layout/Layout";
import { _ } from "~/i18n";

const LoadingIcon = () => <Spinner size="xl" />;
const Layout = (props: LayoutProps) => (
  <PlainLayout mountHeader={false} mountSidebar={false} {...props} />
);

function Loading({
  text = _("Loading installation environment, please wait."),
  useLayout = false,
}) {
  const Wrapper = useLayout ? Layout : React.Fragment;
  return (
    <Wrapper>
      <Bullseye>
        <EmptyState variant="xl" titleText={text} headingLevel="h1" icon={LoadingIcon} />
      </Bullseye>
    </Wrapper>
  );
}

export default Loading;
