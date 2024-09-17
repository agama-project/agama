import clsx from "clsx";
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
    img: "img/webui_on_laptop_and_mobile.png",
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
    img: "img/cli.png",
    description: (
      <>
        Drive the installation with its easy, yet powerful, out of the box
        command line tool.
      </>
    ),
  },
  {
    title: "Fully unattended",
    img: "img/profile.png",
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
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <img className="feature-image" src={img} aria-hidden />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
