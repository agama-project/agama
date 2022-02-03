/*
 * Copyright (c) [2022] SUSE LLC
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
  }, []);

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
            <LanguageSelector />
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
            onClick={() => client.startInstallation()}>
            Install
          </Button>
        </StackItem>
      </Stack>
    </>
  );
}

export default Overview;
