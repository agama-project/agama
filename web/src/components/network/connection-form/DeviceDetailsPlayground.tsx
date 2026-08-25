/*
 * SCRATCH FILE - DO NOT COMMIT.
 *
 * Manual playground to explore how much a network device picker can show
 * without the dialog becoming a wall of wrapped text.
 *
 * Three arrangements of the same data, chosen from the page before opening the
 * dialog:
 *
 *   - "Slim table": five columns, the rest opt-in from a Columns menu.
 *   - "Dense table": every column at once, values trimmed with tooltips.
 *   - "Plain table": what the pull request ships, plus the identify action in
 *     its own column instead of behind a kebab. No filter, no column chooser.
 *
 * The chooser on the page is a playground control, not part of any proposal.
 *
 * Values are shortened the same way in both: "1 Gb/s" instead of
 * "1000 Mb/s", "Port 1" instead of the full PCI path, extra addresses folded
 * into "+N more". Long values are what makes the columns fight for width, so
 * trimming them is worth doing whichever layout wins.
 *
 * Every property and action here is invented and local to this file: no
 * backend supports them yet. Properties that are not picking criteria (MTU,
 * driver, firmware, duplex) stay in the data but earn no place on screen.
 *
 * Reach it at #/device-picker-playground while the temporary route in
 * router.tsx is present.
 */

/* eslint-disable i18next/no-literal-string */

import React, { useId, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  Flex,
  HelperText,
  HelperTextItem,
  Label,
  MenuToggle,
  Radio,
  SearchInput,
  Split,
  SplitItem,
  Stack,
  Tooltip,
} from "@patternfly/react-core";
import IdentifyIcon from "@icons/backlight_low.svg?component";
import Page from "~/components/core/Page";
import { Popup } from "~/components/core/Popup";
import SelectableDataTable from "~/components/core/SelectableDataTable";
import Text from "~/components/core/Text";
import { useAppForm } from "~/hooks/form";
import { sortCollection } from "~/utils";

import type { SelectableDataTableColumn, SortedBy } from "~/components/core/SelectableDataTable";
import type { TranslatedString } from "~/i18n";

/**
 * Marks a literal as translated. Playground text never reaches the catalogs,
 * but the components still ask for translated strings.
 */
const t = (text: string) => text as TranslatedString;

/** A network device plus the invented properties this playground explores. */
type FakeDevice = {
  name: string;
  macAddress: string;
  type: string;
  state: string;
  addresses: string[];
  /** Negotiated link speed, in Mb/s. Zero when there is no carrier. */
  speed: number;
  /** Duplex mode of the negotiated link. */
  duplex: "full" | "half" | "unknown";
  mtu: number;
  driver: string;
  /** Absent on devices with no hardware behind them, such as a bond. */
  firmware?: string;
  /** Full bus address, as reported by the system. */
  slot?: string;
  /** Short label of the socket, as printed on the chassis. */
  port?: string;
  vendor?: string;
  model?: string;
  /** What a virtual device is made of. Absent on real hardware. */
  madeOf?: string;
  /** Whether a cable is plugged in and the link is up. */
  carrier: boolean;
  /** Whether the hardware can light its port LED on demand. */
  canBlink: boolean;
};

const DEVICES: FakeDevice[] = [
  {
    name: "enp1s0",
    macAddress: "00:11:22:33:44:55",
    type: "Ethernet",
    state: "Connected",
    addresses: ["192.168.1.10/24", "fe80::211:22ff:fe33:4455/64"],
    speed: 1000,
    duplex: "full",
    mtu: 1500,
    driver: "e1000e",
    firmware: "0.9-4",
    slot: "PCI 0000:01:00.0",
    port: "Port 1",
    vendor: "Intel",
    model: "I219-LM Gigabit",
    carrier: true,
    canBlink: true,
  },
  {
    name: "enp2s0",
    macAddress: "00:11:22:33:44:66",
    type: "Ethernet",
    state: "Disconnected",
    addresses: [],
    speed: 0,
    duplex: "unknown",
    mtu: 1500,
    driver: "e1000e",
    firmware: "0.9-4",
    slot: "PCI 0000:02:00.0",
    port: "Port 2",
    vendor: "Intel",
    model: "I219-LM Gigabit",
    carrier: false,
    canBlink: true,
  },
  {
    name: "enp3s0f0",
    macAddress: "AA:BB:CC:DD:EE:01",
    type: "Ethernet",
    state: "Connected",
    addresses: ["10.0.0.5/16"],
    speed: 10000,
    duplex: "full",
    mtu: 9000,
    driver: "mlx5_core",
    firmware: "16.35.2000",
    slot: "PCI 0000:03:00.0",
    port: "Port A",
    vendor: "Mellanox",
    model: "ConnectX-5 25GbE",
    carrier: true,
    canBlink: true,
  },
  {
    name: "enp3s0f1",
    macAddress: "AA:BB:CC:DD:EE:02",
    type: "Ethernet",
    state: "Unavailable",
    addresses: [],
    speed: 0,
    duplex: "unknown",
    mtu: 9000,
    driver: "mlx5_core",
    firmware: "16.35.2000",
    slot: "PCI 0000:03:00.1",
    port: "Port B",
    vendor: "Mellanox",
    model: "ConnectX-5 25GbE",
    carrier: false,
    canBlink: true,
  },
  {
    name: "wlan0",
    macAddress: "11:22:33:44:55:66",
    type: "Wi-Fi",
    state: "Disconnected",
    addresses: [],
    speed: 0,
    duplex: "unknown",
    mtu: 1500,
    driver: "iwlwifi",
    firmware: "77.2df3e3e5.0",
    slot: "PCI 0000:04:00.0",
    vendor: "Intel",
    model: "AX200 Wi-Fi 6",
    carrier: false,
    canBlink: false,
  },
  {
    name: "bond0",
    macAddress: "00:11:22:33:44:55",
    type: "Bond",
    state: "Connected",
    addresses: ["172.16.4.20/24"],
    speed: 2000,
    duplex: "full",
    mtu: 1500,
    driver: "bonding",
    madeOf: "802.3ad over enp1s0, enp2s0",
    carrier: true,
    canBlink: false,
  },
];

/** How long the port light blinks after asking a device to identify itself. */
const BLINK_SECONDS = 30;

/** Placeholder for a fact a device does not have. */
const NONE = "-";

/** Link speed in the largest unit that keeps it short. */
const linkSpeed = (device: FakeDevice): string => {
  if (device.speed === 0) return "No link";
  if (device.speed >= 1000) return `${device.speed / 1000} Gb/s`;
  return `${device.speed} Mb/s`;
};

/** Socket label when the chassis prints one, bus address otherwise. */
const location = (device: FakeDevice): string => device.port || device.slot || NONE;

/** Vendor and model, or what a virtual device is made of. */
const hardware = (device: FakeDevice): string =>
  [device.vendor, device.model].filter(Boolean).join(" ") || device.madeOf || NONE;

const searchableText = (device: FakeDevice): string =>
  [
    device.name,
    device.macAddress,
    device.type,
    device.state,
    device.vendor,
    device.model,
    device.madeOf,
    device.slot,
    device.port,
    device.addresses.join(" "),
  ]
    .join(" ")
    .toLowerCase();

/**
 * Shows the row icon inside a sentence that already reads without it.
 *
 * The whole group is hidden from screen readers, brackets included: someone who
 * cannot see the icon gains nothing from hearing empty parentheses, and the
 * sentence around it names the action anyway.
 */
const IdentifyGlyph = () => (
  <Label isCompact>
    <IdentifyIcon />
  </Label>
);

/** Supporting line under the main value of a cell. */
const Secondary = ({ children }: React.PropsWithChildren) => (
  <Text textStyle={["textColorSubtle", "fontSizeXs"]}>{children}</Text>
);

/**
 * First address plus a count of the rest, so a device with an IPv6 address
 * does not force the column twice as wide as the others.
 */
const Addresses = ({ device }: { device: FakeDevice }) => {
  const [first, ...rest] = device.addresses;

  if (!first) return <span>{NONE}</span>;

  return (
    <Stack>
      <span>{first}</span>
      {rest.length > 0 && <Secondary>+{rest.length} more</Secondary>}
    </Stack>
  );
};

/** The layouts this playground compares. */
type Layout = "slim" | "dense" | "plain";

/** Columns the slim table can show. Device is always there. */
type ColumnKey = "location" | "link" | "addresses" | "hardware" | "state";

const OPTIONAL_COLUMNS: ColumnKey[] = ["location", "link", "addresses", "hardware", "state"];
const SLIM_COLUMNS: ColumnKey[] = ["location", "link", "addresses", "state"];
const PLAIN_COLUMNS: ColumnKey[] = ["location", "link", "addresses", "hardware", "state"];

/** Columns a layout fixes for itself; "slim" leaves them to the Columns menu. */
const COLUMNS_FOR: Partial<Record<Layout, ColumnKey[]>> = {
  dense: OPTIONAL_COLUMNS,
  plain: PLAIN_COLUMNS,
};

const COLUMN_LABELS: Record<ColumnKey, string> = {
  location: "Location",
  link: "Link",
  addresses: "Addresses",
  hardware: "Hardware",
  state: "State",
};

/** Menu for choosing which columns the slim table shows. */
function ColumnsMenu({
  visible,
  onToggle,
}: {
  visible: ColumnKey[];
  onToggle: (column: ColumnKey) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      shouldFocusToggleOnSelect
      toggle={(toggleRef) => (
        <MenuToggle ref={toggleRef} onClick={() => setIsOpen(!isOpen)} isExpanded={isOpen}>
          Columns
        </MenuToggle>
      )}
    >
      <DropdownList>
        {OPTIONAL_COLUMNS.map((column) => (
          <DropdownItem
            key={column}
            hasCheckbox
            isSelected={visible.includes(column)}
            onClick={() => onToggle(column)}
          >
            {COLUMN_LABELS[column]}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
}

/** Table layout, either with the chosen columns or with all of them. */
function DeviceTable({
  devices,
  visibleColumns,
  selected,
  onSelect,
  emptyState,
  actionStyle = "menu",
}: {
  devices: FakeDevice[];
  visibleColumns: ColumnKey[];
  selected?: FakeDevice;
  onSelect: (device?: FakeDevice) => void;
  emptyState: React.ReactNode;
  /** Where the per-device action sits: behind a kebab, or plainly in its own column. */
  actionStyle?: "menu" | "inline";
}) {
  const [sortedBy, setSortedBy] = useState<SortedBy>({ index: 0, direction: "asc" });

  const definitions: Record<ColumnKey, SelectableDataTableColumn> = {
    location: {
      name: t("Location"),
      value: (device: FakeDevice) => <span title={device.slot}>{location(device)}</span>,
      sortingKey: "name",
    },
    link: {
      name: t("Link"),
      value: linkSpeed,
      sortingKey: "speed",
    },
    addresses: {
      name: t("Addresses"),
      value: (device: FakeDevice) => <Addresses device={device} />,
    },
    hardware: {
      name: t("Hardware"),
      value: hardware,
      sortingKey: "model",
    },
    state: {
      name: t("State"),
      value: (device: FakeDevice) => device.state,
      sortingKey: "state",
    },
  };

  // A device with no port light gets an empty cell rather than a dead button:
  // an action that can never run is noise on every row that carries it.
  const identifyColumn: SelectableDataTableColumn = {
    name: t("Actions"),
    value: (device: FakeDevice) =>
      device.canBlink && (
        // The icon carries no words, so the button states which device it acts
        // on, and the tooltip says what happens. A native title would say it
        // only on hover, never to someone arriving with the keyboard.
        <Tooltip content={`Blinks the port light for ${BLINK_SECONDS} seconds`}>
          <Button variant="plain" aria-label={`Identify ${device.name}`} onClick={() => undefined}>
            <IdentifyIcon />
          </Button>
        </Tooltip>
      ),
  };

  const columns: SelectableDataTableColumn[] = [
    {
      name: t("Device"),
      value: (device: FakeDevice) => (
        <Stack>
          <span>{device.name}</span>
          <Secondary>{device.macAddress}</Secondary>
        </Stack>
      ),
      sortingKey: "name",
    },
    ...visibleColumns.map((key) => definitions[key]),
    ...(actionStyle === "inline" ? [identifyColumn] : []),
  ];

  const sortingKey = columns[sortedBy.index]?.sortingKey;
  const sortedDevices = sortCollection(devices, sortedBy.direction, sortingKey);

  return (
    <SelectableDataTable
      columns={columns}
      items={sortedDevices}
      itemIdKey="name"
      itemsSelected={selected ? [selected] : []}
      onSelectionChange={(items: FakeDevice[]) => onSelect(items[0])}
      selectionMode="single"
      sortedBy={sortedBy}
      updateSorting={setSortedBy}
      aria-label="Available network devices"
      itemActionsLabel={(device: FakeDevice) => t(`Actions for ${device.name}`)}
      itemActions={
        actionStyle === "menu"
          ? (device: FakeDevice) =>
              device.canBlink
                ? [
                    {
                      title: "Identify device",
                      description: `Blinks the port light for ${BLINK_SECONDS} seconds`,
                      onClick: () => undefined,
                    },
                  ]
                : []
          : undefined
      }
      emptyState={emptyState}
    />
  );
}

/** Dialog offering the devices in the layout under evaluation. */
function DevicePickerDialog({
  selected: initialSelection,
  layout,
  onConfirm,
  onCancel,
}: {
  selected?: FakeDevice;
  layout: Layout;
  onConfirm: (device: FakeDevice) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(SLIM_COLUMNS);
  const confirmHintId = useId();
  const [selected, setSelected] = useState<FakeDevice | undefined>(initialSelection ?? DEVICES[0]);

  const toggleColumn = (column: ColumnKey) =>
    setVisibleColumns((current) =>
      current.includes(column)
        ? current.filter((key) => key !== column)
        : OPTIONAL_COLUMNS.filter((key) => key === column || current.includes(key)),
    );

  const showFilter = layout !== "plain";
  const term = showFilter ? search.trim().toLowerCase() : "";
  const devices =
    term === "" ? DEVICES : DEVICES.filter((device) => searchableText(device).includes(term));

  const emptyState = (
    <EmptyState headingLevel="h4" titleText="No devices match the filter" variant="sm">
      <EmptyStateBody>
        <Button variant="link" onClick={() => setSearch("")}>
          Clear filter
        </Button>
      </EmptyStateBody>
    </EmptyState>
  );

  const actions = (
    <Stack hasGutter>
      {!selected && (
        <HelperText id={confirmHintId} isLiveRegion>
          <HelperTextItem>Select a device</HelperTextItem>
        </HelperText>
      )}
      <Flex>
        <Popup.Confirm
          onClick={() => onConfirm(selected)}
          isDisabled={!selected}
          aria-describedby={confirmHintId}
        >
          {selected ? `Use ${selected.name}` : "Select"}
        </Popup.Confirm>
        <Popup.Cancel onClick={onCancel} asLink />
      </Flex>
    </Stack>
  );

  return (
    <Popup
      isOpen
      variant="large"
      title="Select a network device"
      onClose={onCancel}
      actions={actions}
    >
      <Stack hasGutter>
        <Content component="p">
          Each device is listed with what identifies it physically. A device that can light its port
          offers an action <IdentifyGlyph /> that makes that light blink for {BLINK_SECONDS}{" "}
          seconds.
        </Content>
        {showFilter && (
          <Split hasGutter>
            <SplitItem isFilled>
              <SearchInput
                placeholder="Filter by name, location, model or address"
                aria-label="Filter by name, location, model or address"
                value={search}
                onChange={(_event, value) => setSearch(value)}
                onClear={() => setSearch("")}
              />
            </SplitItem>
            {layout === "slim" && (
              <SplitItem>
                <ColumnsMenu visible={visibleColumns} onToggle={toggleColumn} />
              </SplitItem>
            )}
          </Split>
        )}
        <DeviceTable
          devices={devices}
          visibleColumns={COLUMNS_FOR[layout] ?? visibleColumns}
          selected={selected}
          onSelect={setSelected}
          emptyState={emptyState}
          actionStyle={layout === "plain" ? "inline" : "menu"}
        />
      </Stack>
    </Popup>
  );
}

export default function DeviceDetailsPlayground() {
  const [isOpen, setIsOpen] = useState(false);
  const [layout, setLayout] = useState<Layout>("slim");
  const form = useAppForm({ defaultValues: { device: DEVICES[0].name } });
  const options = DEVICES.map((device) => ({
    value: device.name,
    label: device.name,
    description: <Secondary>{device.macAddress}</Secondary>,
  }));

  return (
    <Page>
      <Page.Content>
        <Stack hasGutter>
          <Content component="h1">Network device picker</Content>
          <Content component="p">
            Invented data, to judge how much detail the picker should carry and how to lay it out.
            Pick a layout below, then open the dialog.
          </Content>
          <Card>
            <CardTitle>Connection device</CardTitle>
            <CardBody>
              <form.AppField name="device">
                {(field) => (
                  <>
                    <field.DropdownField
                      label={t("Device name")}
                      options={options}
                      footerEntry={{
                        label: "Browse with details...",
                        onSelect: () => setIsOpen(true),
                        opensDialog: true,
                      }}
                    />
                    {isOpen && (
                      <DevicePickerDialog
                        selected={DEVICES.find((device) => device.name === field.state.value)}
                        layout={layout}
                        onConfirm={(device) => {
                          field.handleChange(device.name);
                          setIsOpen(false);
                        }}
                        onCancel={() => setIsOpen(false)}
                      />
                    )}
                  </>
                )}
              </form.AppField>
            </CardBody>
          </Card>
          <Card>
            <CardTitle>Layout under evaluation</CardTitle>
            <CardBody>
              <Stack hasGutter>
                <Radio
                  id="layout-slim"
                  name="layout"
                  label="Slim table"
                  description="Device, Location, Link, Addresses and State. Hardware is opt-in from the Columns menu in the dialog."
                  isChecked={layout === "slim"}
                  onChange={() => setLayout("slim")}
                />
                <Radio
                  id="layout-dense"
                  name="layout"
                  label="Dense table"
                  description="Every column at once, to see whether trimming the values was enough on its own."
                  isChecked={layout === "dense"}
                  onChange={() => setLayout("dense")}
                />
                <Radio
                  id="layout-plain"
                  name="layout"
                  label="Plain table"
                  description="What the pull request ships, plus the identify action: no filter, no column chooser, and the action in its own column rather than behind a kebab."
                  isChecked={layout === "plain"}
                  onChange={() => setLayout("plain")}
                />
              </Stack>
            </CardBody>
          </Card>
        </Stack>
      </Page.Content>
    </Page>
  );
}
