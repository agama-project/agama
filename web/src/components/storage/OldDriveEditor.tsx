function DriveEditor({ drive, driveDevice }: DriveEditorProps) {
  const DriveHeader = () => {
    // TRANSLATORS: Header a so-called drive at the storage configuration. %s is the drive identifier
    // like 'vdb' or any alias set by the user
    const text = sprintf(_("Disk %s"), driveUtils.label(drive));

    return <h4>{text}</h4>;
  };

  // FIXME: do this i18n friendly, responsive and all that
  const DeviceDescription = () => {
    const data = [
      driveDevice.name,
      deviceSize(driveDevice.size),
      typeDescription(driveDevice),
      driveDevice.model
    ];
    const usefulData = [...new Set(data)].filter((d) => d && d !== "");

    return <span>{usefulData.join(" ")}</span>;
  };

  const ContentDescription = () => {
    const content = contentDescription(driveDevice);

    return content && <span>{content}</span>;
    // <FilesystemLabel item={driveDevice} />
  };

  const SpacePolicy = () => {
    const currentPolicy = driveUtils.spacePolicyEntry(drive);
    const [isOpen, setIsOpen] = useState(false);
    const onToggleClick = () => {
      setIsOpen(!isOpen);
    };

    const PolicyItem = ({policy}) => {
      return (
        <DropdownItem
          isSelected={policy.id === currentPolicy.id}
          description={policy.description}
        >
          {policy.label}
        </DropdownItem>
      );
    };

    return (
      <span>
        {driveUtils.oldContentActionsDescription(drive)}
        <Dropdown
          shouldFocusToggleOnSelect
          isOpen={isOpen}
          onOpenChange={(isOpen: boolean) => setIsOpen(isOpen)}
          toggle={(toggleRef: React.Ref<MenuToggleElemet>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={onToggleClick}
              isExpanded={isOpen}
              variant="plain"
            >
              {_("Change")}
            </MenuToggle>
          )}
        >
          <DropdownList>
            {SPACE_POLICIES.map((policy) => <PolicyItem policy={policy} />)}
          </DropdownList>
        </Dropdown>
      </span>
    );
  };

  return (
    <ListItem>
      <Stack>
        <StackItem>
          <DriveHeader />
        </StackItem>
        <StackItem>
          <DescriptionList isHorizontal isCompact horizontalTermWidthModifier={{ default: '14ch'}}>
            <DescriptionListGroup>
              <DescriptionListTerm>{_("Device")}</DescriptionListTerm>
              <DescriptionListDescription>
                <DeviceDescription />
                <Button variant="link">Change device</Button>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>{_("Current Content")}</DescriptionListTerm>
              <DescriptionListDescription>
                <Stack>
                  <StackItem>
                    <ContentDescription />
                    {driveDevice.systems.map((s) => <Label isCompact>{s}</Label>)}
                  </StackItem>
                  <StackItem>
                    <SpacePolicy />
                  </StackItem>
                </Stack>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>{_("New content")}</DescriptionListTerm>
              <DescriptionListDescription>
                <Partitions drive={drive} />
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </StackItem>
      </Stack>
    </ListItem>
  );
};


