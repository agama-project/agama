import React, { forwardRef, useState, useImperativeHandle, useEffect } from "react";

/**
 * Function for creating a layout slot.
 *
 */
export default function createLayoutSlot() {
  const slot = { ref: null, defaultContent: null, previousContent: null };

  const Placeholder = forwardRef(({ as: SlotContainer = "div", children, ...props }, ref) => {
    console.log("props", props, "children", children);
    const [content, setContent] = useState(children);
    console.log("Rendering slot with default", children, "and content", content);
    slot.defaultContent = children;

    useImperativeHandle(ref, () => ({
      changeContent: newContent => {
        console.info("Saving previous slot content ", content);
        slot.previousContent = content;
        console.info("Changing the slot content to", newContent);
        setContent(newContent);
      }
    }));

    slot.ref = ref;

    return (
      <SlotContainer ref={ref} {...props}>
        {content}
      </SlotContainer>
    );
  });

  const Content = ({ children }) => {
    const container = slot.ref;
    console.log("rendering Slot Content", children, container);

    useEffect(() => {
      // Set the new content, only if the container is available
      if (container.current) {
        console.log("calling #ChangeContent of ", container.current);

        container.current.changeContent(children);
      }

      return () => {
        if (!container) return;
        // FIXME: this is tricky because usually defaultContent became previousContent
        // Maybe defaultContent does not make sense
        const contentToRestore = slot.previousContent ? slot.previousContent: slot.defaultContent;

        // Restore previous or initial content
        if (contentToRestore) {
          container.current.changeContent(contentToRestore);
          slot.previousContent = null;
        }
      };
    }, [children]);

    // Always return null, as it is changing the content of the slot;
    return null;
  };

  Placeholder.displayName = "Layout Slot Placeholder";
  Content.displayName = "Layout Slot Content";

  return { Placeholder, Content };
}
