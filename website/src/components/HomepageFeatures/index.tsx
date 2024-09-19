import Heading from "@theme/Heading";
import BrowserWindow from "@site/src/components/BrowserWindow";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  description: JSX.Element;
  asset?: React.ReactNode;
};

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
      <BrowserWindow url="https://agama.local" paddingLess>
        <img
          src={require("@site/static/img/storage.png").default}
          aria-hidden
        />
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
      <img
        src={require("@site/static/img/agama_cli.png").default}
        aria-hidden
      />
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
      <img
        src={require("@site/static/img/agama_profile.png").default}
        aria-hidden
      />
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
