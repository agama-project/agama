// Borrowed from https://pietrobondioli.com.br/articles/how-to-get-keylock-state-on-react
import { useCallback, useEffect, useState } from "react";

type KeyLock = "CapsLock" | "NumLock" | "ScrollLock";

export const useKeyLock = (targetKey: KeyLock) => {
  const [isKeyLocked, setIsKeyLocked] = useState(false);

  const checkKeyState = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== targetKey) {
        setIsKeyLocked(event.getModifierState(targetKey));
        return;
      }

      setIsKeyLocked(!event.getModifierState(targetKey));
    },
    [targetKey],
  );

  useEffect(() => {
    window.addEventListener("keydown", checkKeyState);

    return () => {
      window.removeEventListener("keydown", checkKeyState);
    };
  }, [targetKey, checkKeyState]);

  return isKeyLocked;
};
