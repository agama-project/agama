import { useReducer, useEffect } from 'react';
import { useInstallerClient } from './context/installer';

import {
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalVariant
} from "@patternfly/react-core"

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD": {
      return { ...state, ...action.payload };
    }
    case "ACCEPT": {
      return { ...state, isFormOpen: false };
    }

    case "CANCEL": {
      return { ...state, isFormOpen: false, current: state.initial };
    }

    case "CHANGE": {
      return { ...state, current: action.payload };
    }

    case "OPEN": {
      return { ...state, isFormOpen: true };
    }

    default: {
        return state;
    }
  }
}

const initialState = {
  targets: [], initial: null, current: null, isFormOpen: false
};

export default function TargetSelector() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { current: target, targets, isFormOpen } = state;

  useEffect(async () => {
    const targets = await client.getDisks();
    const current = await client.getOption("Disk");
    dispatch({ type: "LOAD", payload: { targets, current, initial: current }});
  }, []);

  const open = () => dispatch({ type: "OPEN" });

  const cancel = () => {
    dispatch({ type: "CANCEL" });
  }

  const accept = async () => {
    // TODO: handle errors
    await client.setOption("Disk", target);
    dispatch({ type: "ACCEPT" });
  }

  const buildSelector = () => {
    const selectorOptions = targets.map(target => {
      const { name } = target

      return <FormSelectOption key={name} value={name} label={name} />
    });

    return (
      <FormSelect
        value={target}
        onChange={v => dispatch({ type: "CHANGE", payload: v })}
        aria-label="target"
      >
        {selectorOptions}
      </FormSelect>
    );
  };

  return (
    <>
      <Button variant="link" onClick={open}>
        {target}
      </Button>

      <Modal
        isOpen={isFormOpen}
        showClose={false}
        variant={ModalVariant.small}
        title="Target Selector"
        actions={[
          <Button key="confirm" variant="primary" onClick={accept}>
            Confirm
          </Button>,
          <Button key="cancel" variant="link" onClick={cancel}>
            Cancel
          </Button>
        ]}
      >
        <Form>
          <FormGroup
            fieldId="target"
            label="Select target"
            helperText="Product will be installed in selected target"
          >
            { buildSelector() }
          </FormGroup>
        </Form>
      </Modal>
    </>
  )
}
