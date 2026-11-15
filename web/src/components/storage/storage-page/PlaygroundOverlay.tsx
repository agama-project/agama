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

/* eslint-disable i18next/no-literal-string --
   a developer's tool on the playground, never shown to whoever installs. */

/*
 * PLAYGROUND: every console switch of the storage page in an overlay, to try
 * them without the browser console. Hidden until switched on from it:
 *
 *   agamaPlayground(true)   // show the overlay's button
 *   agamaPlayground(false)  // hide it again (default)
 *
 * To be dropped with the switches once the design is settled.
 */

import React from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Flex,
  ToggleGroup,
  ToggleGroupItem,
} from "@patternfly/react-core";
import { playgroundSwitches } from "~/components/storage/storage-page/playground-switches";

const KEY = "agama.storage.playground";
const EVENT = "agamaPlayground-changed";

declare global {
  interface Window {
    agamaPlayground?: (value: boolean) => void;
  }
}

/** The local mock's own console functions, present only where it is loaded. */
const mock = () =>
  window as unknown as {
    agamaStorageScenario?: (value: string) => void;
    agamaMockProposalSwap?: () => void;
  };

const readEnabled = () => {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
};

window.agamaPlayground = (value) => {
  try {
    localStorage.setItem(KEY, value ? "on" : "off");
  } catch {
    console.warn("Cannot keep agamaPlayground: no local storage");
  }
  window.dispatchEvent(new Event(EVENT));
};

const subscribeEnabled = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};

/** "agamaExistingDataWording" read as "Existing data wording". */
const labelOf = (name: string) =>
  name
    .replace(/^agama/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/ ([A-Z])/g, (_m, c: string) => ` ${c.toLowerCase()}`);

/** Re-renders whenever any switch changes. */
function useAllSwitches() {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const offs = playgroundSwitches.map((s) => s.subscribe(bump));
    return () => offs.forEach((off) => off());
  }, []);
  return playgroundSwitches;
}

function Choices({
  label,
  values,
  current,
  onChoose,
}: {
  label: string;
  values: string[];
  current: string;
  onChoose: (value: string) => void;
}) {
  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapXs" }}>
      <span>{label}</span>
      <ToggleGroup isCompact aria-label={label}>
        {values.map((value) => (
          <ToggleGroupItem
            key={value}
            text={value}
            isSelected={value === current}
            onChange={() => onChoose(value)}
          />
        ))}
      </ToggleGroup>
    </Flex>
  );
}

const SCENARIOS = ["loss", "safe", "failed", "none"];

/** The overlay: a button at the bottom right opening every switch in a card. */
export default function PlaygroundOverlay() {
  const isEnabled = React.useSyncExternalStore(subscribeEnabled, readEnabled);
  const [isOpen, setIsOpen] = React.useState(false);
  const switches = useAllSwitches();

  if (!isEnabled) return null;

  const hasMocks = typeof mock().agamaStorageScenario === "function";
  const scenario = (() => {
    try {
      return localStorage.getItem("agama.mock.storageScenario") || "loss";
    } catch {
      return "loss";
    }
  })();

  return (
    <div className="agm-playground-overlay">
      {isOpen && (
        <Card isCompact className="agm-playground-overlay__card">
          <CardHeader
            actions={{
              actions: (
                <Button variant="plain" onClick={() => setIsOpen(false)}>
                  Close
                </Button>
              ),
              hasNoOffset: true,
            }}
          >
            <CardTitle component="h2">Playground settings</CardTitle>
          </CardHeader>
          <CardBody>
            <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
              {switches.map((s) => (
                <Choices
                  key={s.name}
                  label={labelOf(s.name)}
                  values={s.values}
                  current={s.read()}
                  onChoose={(value) => s.write(value)}
                />
              ))}
              {hasMocks && (
                <>
                  <Choices
                    label="Mocked machine (reloads)"
                    values={SCENARIOS}
                    current={scenario}
                    onChoose={(value) => mock().agamaStorageScenario?.(value)}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => mock().agamaMockProposalSwap?.()}
                  >
                    New proposal (shows the updated dot)
                  </Button>
                </>
              )}
            </Flex>
          </CardBody>
        </Card>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        Playground
      </Button>
    </div>
  );
}
