/**
 * Based on the original BrowserWindow docusaurus component,
 * https://github.com/facebook/docusaurus/blob/main/website/src/components/BrowserWindow/index.tsx,
 */

import React, { type CSSProperties, type ReactNode } from "react";
import clsx from "clsx";

import styles from "./styles.module.css";

interface Props {
  children: ReactNode;
  minHeight?: number;
  url?: string;
  hideAddressBar?: boolean;
  hideMenu?: boolean;
  hideDots?: boolean;
  paddingLess?: boolean;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}

export default function BrowserWindow({
  children,
  minHeight,
  url = "http://localhost:3000",
  hideAddressBar = false,
  hideMenu = false,
  hideDots = false,
  paddingLess = false,
  style,
  bodyStyle,
}: Props): JSX.Element {
  return (
    <div
      className={clsx(styles.browserWindow, paddingLess && styles.paddingLess)}
      style={{ ...style, minHeight }}
    >
      <div className={styles.browserWindowHeader}>
        {!hideDots && (
          <div className={styles.buttons}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}
        {!hideAddressBar && (
          <div
            className={clsx(styles.browserWindowAddressBar, "text--truncate")}
          >
            {url}
          </div>
        )}
        {!hideMenu && (
          <div className={styles.browserWindowMenuIcon}>
            <div>
              <span className={styles.bar} />
              <span className={styles.bar} />
              <span className={styles.bar} />
            </div>
          </div>
        )}
      </div>

      <div className={styles.browserWindowBody} style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}
