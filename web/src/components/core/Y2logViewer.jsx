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

import React, { useState, useEffect, useRef } from "react";
import { Popup } from "~/components/core";
import { Alert, Button, Flex, FlexItem, FormGroup } from "@patternfly/react-core";
import { LoadingEnvironment } from "~/components/layout";
import LogLevelFilter from "./LogLevelFilter";
import PropertyFilter from "./PropertyFilter";
import ComponentFilter from "./ComponentFilter";

import cockpit from "../../lib/cockpit";
import y2logparser from "../../lib/y2logparser";

// render a single line from y2log
const renderLine = (item, key, filter) => {
  if (!filter.levels[item.level] || !filter.components[item.group]) return null;

  const props = filter.properties;

  return (
    <div className={`logline loglevel-${item.level}`} key={`log-line-${key}`}>
      { props.date && <span>{item.date}{" "}</span> }
      { props.time && <span>{item.time}{" "}</span> }
      { props.level && <span>{"<"}{item.level}{"> "}</span> }
      { props.host && <span>{item.host}{" "}</span> }
      { props.pid && <span>{"("}{item.pid}{") "}</span> }
      { props.component && <span>{"["}{item.component}{"] "}</span> }
      { props.location && <span>{item.location}{" "}</span> }
      { props.message && <span className="log-message">{item.message}{" "}</span> }
    </div>
  );
};

// render complete y2log content
const renderLines = (lines, filter) => {
  const ret = [];

  while (lines.length > 0) {
    const line = lines.shift();

    const startGroup = line.message.match(/^::group::(\d+\.\d+)::(.*)/);
    if (startGroup) {
      ret.push(
        <details key={`group-start-${lines.length}`}>
          <summary className={`loglevel-${line.level}`}>{startGroup[2]}</summary>
          {renderLine(line, lines.length, filter)}
          {renderLines(lines, filter)}
        </details>
      );
    } else {
      ret.push(renderLine(line, lines.length, filter));
    }

    const endGroup = line.message.match(/^::endgroup::(\d+\.\d+)::(.*)/);
    if (endGroup) {
      return ret;
    }
  }

  return ret;
};

// default displayed log properties
const defaultProperties = {
  date: false,
  time: true,
  level: false,
  host: false,
  pid: false,
  component: true,
  location: true,
  message: true
};

// convert component set to visibility mapping (component name => boolean)
const defaultComponents = (components) => {
  const ret = {};
  components.forEach((component) => { ret[component] = true });
  return ret;
};

// which log levels should be displayed by default, a list for levels 0..5
const defaultLogLevels = [true, true, true, true, true, true];

const file = "/var/log/YaST2/y2log";

export default function Y2logViewer({ onCloseCallback }) {
  // the popup is visible
  const [isOpen, setIsOpen] = useState(true);
  // error message for failed load
  const [error, setError] = useState(null);
  // the parsed log file
  const [content, setContent] = useState("");
  // current state
  const [state, setState] = useState("loading");

  const [levels, setLogLevels] = useState(defaultLogLevels);
  const [properties, setProperties] = useState(defaultProperties);
  const [components, setComponents] = useState([]);

  const endLogRef = useRef(null);

  useEffect(() => {
    // NOTE: reading non-existing files in cockpit does not fail, the result is null
    // see https://cockpit-project.org/guide/latest/cockpit-file
    cockpit.file(file).read()
      .then((data) => {
        setState("ready");
        const parsed = y2logparser(data);
        setComponents(defaultComponents(parsed.components));
        setContent(parsed.lines);
        // scroll to the end of the log
        endLogRef.current.scrollIntoView();
      })
      .catch((data) => {
        setState("ready");
        setError(data.message);
      });
  }, []);

  const close = () => {
    setIsOpen(false);
    if (onCloseCallback) onCloseCallback();
  };

  // current display filter settings
  const filter = { levels, properties, components };
  const lines = renderLines([...content], filter);

  const footer = (
    // FIXME: use <Flex> instead of this workaround
    <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", width: "100%" }}>
      <FormGroup role="group" label="Filters">
        <Flex>
          <FlexItem spacer={{ default: "spacerSm" }}>
            <LogLevelFilter levels={levels} onChangeCallback={(l) => setLogLevels(l)} />
          </FlexItem>
          <FlexItem spacer={{ default: "spacerSm" }}>
            <PropertyFilter properties={properties} onChangeCallback={(p) => setProperties(p)} />
          </FlexItem>
          <FlexItem spacer={{ default: "spacerSm" }}>
            <ComponentFilter components={components} onChangeCallback={(c) => setComponents(c)} />
          </FlexItem>
        </Flex>
      </FormGroup>
      <Button onClick={close}>
        Close
      </Button>
    </div>
  );

  return (
    <Popup
      isOpen={isOpen}
      title="YaST Log"
      variant="large"
      className="tallest"
      footer={footer}
    >
      { state === "loading" && <LoadingEnvironment text="Reading log file..." /> }
      { (content === null || error) &&
        <Alert
          isInline
          isPlain
          variant="warning"
          title="Cannot read the file"
        >
          {error}
        </Alert> }

      <div className="logview">
        {lines}
        <div ref={endLogRef} />
      </div>
    </Popup>
  );
}
