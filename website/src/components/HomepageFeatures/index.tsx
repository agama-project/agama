import Heading from "@theme/Heading";
import CodeBlock from "@theme/CodeBlock";
import BrowserWindow from "@site/src/components/BrowserWindow";
import clsx from "clsx";
import profile from "!!raw-loader!@site/static/profiles/tw.json";

import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  description: JSX.Element;
  asset?: React.ReactNode;
};

const TerminalWindow = ({ children, ...props }): JSX.Element => (
  <BrowserWindow aria-hidden paddingLess hideAddressBar hideMenu {...props}>
    {children}
  </BrowserWindow>
);

const FeatureList: FeatureItem[] = [
  {
    title: "Modern web-based UI",
    description: (
      <>
        Interact with the installer either, locally on the computer where the
        system will be installed or remotely from another device running a web
        browser.
      </>
    ),
    asset: (
      <BrowserWindow aria-hidden url="https://agama.local" paddingLess>
        <img src={require("@site/static/img/storage.png").default} />
      </BrowserWindow>
    ),
  },
  {
    title: "Powerful CLI",
    description: (
      <>
        Drive the installation with its easy, yet powerful, out of the box
        command line tool.
      </>
    ),
    asset: (
      <TerminalWindow>
        <video controls autoPlay>
          <source
            src={require("@site/static/video/agama-cli.webm").default}
            type="video/webm"
          />
          <source
            src={require("@site/static/video/agama-cli.ogv").default}
            type="video/ogg"
          />
          <source
            src={require("@site/static/video/agama-cli.mp4").default}
            type="video/mp4"
          />
        </video>
      </TerminalWindow>
    ),
  },
  {
    title: "Fully unattended",
    description: (
      <>
        Let Agama handle the installation without requiring any other input
        other than an installation profile.
      </>
    ),
    asset: (
      <CodeBlock
        aria-hidden
        showLineNumbers
        language="json"
        title="profile.json"
        className={clsx(styles.codeBlock, "shadow--tl")}
      >
        {profile}
      </CodeBlock>
    ),
  },
];

function Feature({ title, asset, description }: FeatureItem) {
  return (
    <li>
      {asset}
      <div>
        <Heading as="h2">{title}</Heading>
        <p>{description}</p>
      </div>
    </li>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className="container padding-top--lg">
      <ul className={styles.features} aria-label="Agama key features">
        {FeatureList.map((props, idx) => (
          <Feature key={idx} {...props} />
        ))}
      </ul>
    </section>
  );
}
