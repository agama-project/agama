import clsx from "clsx";
import Link from "@docusaurus/Link";
import Heading from "@theme/Heading";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  img: React.ComponentProps<"img">["src"];
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Modern web-based UI",
    img: "img/agama_web_ui.png",
    description: (
      <>
        Interact with the installer either, locally on the computer where the
        system will be installed or remotely from another device running a web
        browser.
      </>
    ),
  },
  {
    title: "Powerful CLI",
    img: "img/agama_cli.png",
    description: (
      <>
        Drive the installation with its easy, yet powerful, out of the box
        command line tool.
      </>
    ),
  },
  {
    title: "Fully unattended",
    img: "img/agama_profile.png",
    description: (
      <>
        Let Agama handle the installation without requiring any other input
        other than an installation profile.
      </>
    ),
  },
];

function Feature({ title, img, description }: FeatureItem) {
  return (
    <li>
      <img src={img} aria-hidden />
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
