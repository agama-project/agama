/*
 * Copyright (c) [2023] SUSE LLC
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

import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Text,
  EmptyState, EmptyStateBody, EmptyStateFooter, EmptyStateHeader, EmptyStateIcon
} from "@patternfly/react-core";
import { Center, Icon, Loading } from "~/components/layout";

// path to any internal Cockpit component to force displaying the login dialog
const loginPath = "/cockpit/@localhost/system/terminal.html";
// id of the password field in the login dialog
const loginId = "login-password-input";

const ErrorIcon = () => <Icon name="error" className="icon-big" />;

/**
 * This is a helper wrapper used in the development server only. It displays
 * the Cockpit login page if the user is not authenticated. After successful
 * authentication the Agama page is displayed.
 *
 * @param {React.ReactNode} [props.children] - content to display within the wrapper
 *
*/
export default function DevServerWrapper({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isError, setIsError] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!isLoading) return;

    // get the current login state by querying the "/cockpit/login" path
    const xhr = new XMLHttpRequest();
    xhr.ontimeout = () => {
      setIsError(true);
      setIsLoading(false);
    };
    xhr.onloadend = () => {
      // 200 = OK
      if (xhr.status === 200)
        setIsAuthenticated(true);
      // 401 = Authentication failed
      else if (xhr.status === 401)
        setIsAuthenticated(false);
      else
        setIsError(true);

      setIsLoading(false);
    };
    xhr.timeout = 5000;
    xhr.open("GET", "/cockpit/login");
    xhr.send();
  }, [isLoading]);

  if (isLoading) return <Loading />;

  if (isError) {
    return (
      <Center>
        <EmptyState variant="xl">
          <EmptyStateHeader
            titleText="Cannot connect to the Cockpit server"
            headingLevel="h2"
            icon={<EmptyStateIcon icon={ErrorIcon} />}
          />
          <EmptyStateBody>
            <Text>
              The server at { " " }
              <Button isInline variant="link" component="a" href={ COCKPIT_TARGET_URL } target="_blank">
                { COCKPIT_TARGET_URL }
              </Button>
              { " " } is not reachable.
            </Text>
          </EmptyStateBody>
          <EmptyStateFooter>
            <Button variant="primary" onClick={() => { setIsLoading(true); setIsError(false) }}>
              Try Again
            </Button>
          </EmptyStateFooter>
        </EmptyState>
      </Center>
    );
  }

  if (isAuthenticated) {
    // just display the wrapped content
    return children;
  } else {
    // handle updating the iframe with the login form
    const onFrameLoad = () => {
      const passwordInput = iframeRef.current.contentWindow.document.getElementById(loginId);
      // if there is no password field displayed then the user has authenticated successfully
      if (!passwordInput) setIsAuthenticated(true);
    };

    return <iframe ref={iframeRef} onLoad={onFrameLoad} src={loginPath} className="full-size" />;
  }
}
