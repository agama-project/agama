import React, { useRef } from "react";

import createLayoutSlot from "./slot";

const Slot = createLayoutSlot();

export function SectionTitlePlaceholder({ children, ...props }) {
  const slotRef = useRef();
  return (
    <Slot.Placeholder ref={slotRef} {...props}>
      {children}
    </Slot.Placeholder>
  );
}

export function SectionTitle({ children }) {
  return <Slot.Content>{children}</Slot.Content>;
}
