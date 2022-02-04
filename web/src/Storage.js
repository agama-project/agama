import { useReducer, useEffect } from 'react';
import { useInstallerClient } from './context/installer';

import TargetSelector from './TargetSelector';
import Proposal from './Proposal';

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOAD': {
      const { targets, target, proposal } = action.payload;
      return { ...state, targets, target, proposal };
    }

    case 'CHANGE_TARGET': {
      return { ...state, target: action.payload };
    }

    case 'UPDATE_PROPOSAL': {
      return { ...state, proposal: action.payload };
    }

    default: {
      return state;
    }
  }
}

export default function Storage() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, { targets: [], target: "", proposal: [] });
  const { target, targets, proposal } = state;

  const onAccept = (selected) =>
    client.setOption("Disk", selected).then(() =>
      dispatch({type: "CHANGE_TARGET", payload: selected})
    );

  useEffect(async () => {
    const proposal = await client.getStorage();
    const disk = await client.getOption("Disk");
    const disks = await client.getDisks();
    dispatch({ type: "LOAD", payload: { target: disk, targets: disks, proposal } });
  }, []);

  useEffect(() => {
    // TODO: abstract D-Bus details
    return client.onPropertyChanged((_path, _iface, _signal, args) => {
      const [_, changes] = args;
      if (Object.keys(changes).includes("Disk")) {
        client.getStorage().then(proposal => 
          dispatch({ type: 'UPDATE_PROPOSAL', payload: proposal })
        );
      }
    });
  }, []);

  return (
    <div>
      <TargetSelector
        target={target || "Select target"}
        targets={targets}
        onAccept={onAccept} />
      <Proposal data={proposal}/>
    </div>
  );
}
