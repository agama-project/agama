import { useEffect, useReducer } from 'react';
import { useInstallerClient } from './context/installer';

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
import actionTypes from './context/actionTypes';

import {
  EOS_TRANSLATE as LanguagesSelectionIcon,
  EOS_VOLUME as HardDriveIcon,
  EOS_PACKAGES as ProductsIcon,
} from 'eos-icons-react'

import {
  useInstallerState, setStatus, registerSignalHandler, startInstallation
} from './context/installer';

const reducer = (state, action) => {
  switch (action.type) {
    case actionTypes.SET_OPTIONS: {
      return { ...state, ...action.payload };
    }
    default: {
      return state;
    }
  }
}

function Overview() {
  const [state, dispatch] = useReducer(reducer, {});
  const { language, product, disk } = state;
  const installation = useInstallerState();
  const client = useInstallerClient();

  const loadOptions = () => {
    client.getOptions().then(options => {
      dispatch({ type: actionTypes.SET_OPTIONS, payload: options });
    }).catch(console.error);
  };

  const setOptions = (options) => {
    client.setOptions(options).then(() => {
      dispatch({ type: actionTypes.SET_OPTIONS, payload: options });
    });
  };

  useEffect(() => {
    loadOptions();
    setStatus(dispatch);

    registerSignalHandler('StatusChanged', () => {
      // FIXME: use the status_id from the event
      setStatus(dispatch);
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
              onChange={(language) => setOptions({ language })}
            />
          </Category>
        </StackItem>

        <StackItem>
          <Category title="Target" icon={HardDriveIcon}>
            <Storage value={disk} onChange={disk => setOptions({ disk })} />
          </Category>
        </StackItem>

        <StackItem>
          <Category title="Product" icon={ProductsIcon}>
            <ProductSelector
              value={product || "Select a product"}
              onChange={(product) => setOptions({ product })}
            />
          </Category>
        </StackItem>

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
