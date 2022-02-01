import { useEffect } from 'react';

import {
  Button,
  Progress,
  Stack,
  StackItem,
  Text,
  TextContent,
  TextVariants
} from '@patternfly/react-core';

import Category from './Category';
import LanguageSelector from './LanguageSelector';
import ProductSelector from './ProductSelector';
import Storage from './Storage';

import {
  EOS_TRANSLATE as LanguagesSelectionIcon,
  EOS_VOLUME as HardDriveIcon,
  EOS_PACKAGES as ProductsIcon,
  EOS_DOWNLOADING as ProgressIcon
} from 'eos-icons-react'

import {
  useInstallerState, useInstallerDispatch, setStatus, setOptions, loadOptions,
  updateProgress, registerSignalHandler, startInstallation
} from './context/installer';

function Overview() {
  const dispatch = useInstallerDispatch();
  const { installation } = useInstallerState();
  const { language, product, disk } = installation.options;

  useEffect(() => {
    loadOptions(dispatch);
    setStatus(dispatch);

    registerSignalHandler('StatusChanged', () => {
      // FIXME: use the status_id from the event
      setStatus(dispatch);
    });

    registerSignalHandler('Progress', (_path, _iface, _signal, args) => {
      const [title, steps, step, substeps, substep] = args;
      const progress = { title, steps, step, substeps, substep };
      updateProgress(dispatch, progress);
    });

  }, []);

  const isInstalling = installation.status !== 0;
  const { progress } = installation;

  return (
    <>
      <Stack hasGutter>
        <StackItem>
          <TextContent>
            <Text component={TextVariants.h1}>Welcome to D-Installer</Text>
          </TextContent>
        </StackItem>

        <StackItem>
          <Category title="Language" icon={LanguagesSelectionIcon}>
            <LanguageSelector
              value={language || "Select language"}
              onChange={(language) => setOptions({ language }, dispatch)}
            />
          </Category>
        </StackItem>

        <StackItem>
          <Category title="Target" icon={HardDriveIcon}>
            <Storage value={disk} onChange={disk => setOptions({ disk }, dispatch)} />
          </Category>
        </StackItem>

        <StackItem>
          <Category title="Product" icon={ProductsIcon}>
            <ProductSelector
              value={product || "Select a product"}
              onChange={(product) => setOptions({ product }, dispatch)}
            />
          </Category>
        </StackItem>

        { isInstalling && progress &&
          <StackItem>
            <Category title="Progress" icon={ProgressIcon} >
              <Progress title="Installing" value={Math.round(progress.step / progress.steps * 100)} />
              <Progress title={progress.title} value={Math.round(progress.substep / progress.substeps * 100)} />
            </Category>
          </StackItem> }

        <StackItem>
          <Button
            isLarge
            variant="primary"
            isDisabled={isInstalling}
            onClick={() => startInstallation(dispatch)}>
            Install
          </Button>
          { isInstalling }
        </StackItem>
      </Stack>
    </>
  );
}

export default Overview;
