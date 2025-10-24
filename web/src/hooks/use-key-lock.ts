// Borrowed from https://pietrobondioli.com.br/articles/how-to-get-keylock-state-on-react
import { useCallback, useEffect, useState } from "react";

type KeyLock = "CapsLock" | "NumLock" | "ScrollLock";

export const useKeyLock = (targetKey: KeyLock) => {
  const [isKeyLocked, setIsKeyLocked] = useState(false);

  const checkKeyState = useCallback(
    (event: KeyboardEvent) => {
      if (!event.getModifierState) return;

      if (event.getModifierState && event.key !== targetKey) {
        setIsKeyLocked(event.getModifierState(targetKey));
        return;
      }

      setIsKeyLocked(!isKeyLocked);
    },
    [targetKey, isKeyLocked],
  );

  useEffect(() => {
    window.addEventListener("keydown", checkKeyState);

    return () => {
      window.removeEventListener("keydown", checkKeyState);
    };
  }, [targetKey, checkKeyState]);

  return isKeyLocked;
};
