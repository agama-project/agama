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
import { Terminal as Term } from "@xterm/xterm";
import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";

/**
 * Simple component that displayes terminal.
 * @component
 * @param {object} props
 * @param {Location} props.url url of websocket answering terminal
 */
export class Terminal extends React.Component {
  constructor({ url = window.location }) {
    super({});
    this.terminalRef = React.createRef();
    const wsUrl = new URL(url.toString());
    wsUrl.hash = "";
    wsUrl.pathname = wsUrl.pathname.concat("api/terminal");
    wsUrl.protocol = (url.protocol === "http:") ? "ws" : "wss";
    console.info(wsUrl);
    this.ws = new WSClient(wsUrl, false);
    this.term = new Term({
      rows: 22,
      cols: 100,
      title: "Agama terminal",
      theme: {
        background: "#ffffff",
        foreground: "#000000",
        cursor: "#000000",
      },
    });
    const attachAddon = new AttachAddon(this.ws.client);
    // Attach the socket to term
    this.term.loadAddon(attachAddon);
    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
  };

  componentDidMount() {
    this.term.open(this.terminalRef.current);
    this.term.clear();
    this.term.writeln("Welcome to agama shell\n");
    this.fitAddon.fit();
    this.ws.connect();
    this.term.input("agetty --show-issue");
    this.term.focus();
  }

  render () {
    return (
      <div
        ref={this.terminalRef}
      />
    );
  }
}
