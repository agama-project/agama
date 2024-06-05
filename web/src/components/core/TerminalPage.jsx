/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React, { useEffect } from "react";
import { WSClient } from "~/client/http";
import { noop, useCancellablePromise } from "~/utils";
import { Terminal } from "@xterm/xterm";
import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";

/**
 * Simple component that displayes terminal.
 * @component
 * @param {URL} url - URL of the HTTP API.
 */
export default function TerminalPage(url) {
  const { cancellablePromise } = useCancellablePromise();

  useEffect(() => {
    const wsUrl = new URL(url.toString());
    wsUrl.pathname = wsUrl.pathname.concat("api/terminal_socket");
    wsUrl.protocol = (url.protocol === "http:") ? "ws" : "wss";
    const ws = new WSClient(wsUrl);
    const term = new Terminal();
    const attachAddon = new AttachAddon(ws.client);
    // Attach the socket to term
    term.loadAddon(attachAddon);
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();
  }, [url]);

  return (
    <div id="terminal" />
  );
}
