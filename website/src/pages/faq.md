# Frequently Asked Questions

## What is Agama?

Short answer - a Linux installer intended as the evolution of YaST. For a longer answer, check
the [About](/about) section.

## Why a new installer?

This new project follows two main motivations: to overcome some of the limitations of YaST and to
serve as installer for new projects, like those based on SUSE Linux Framework One.

YaST is a mature installer and control center for SUSE and openSUSE operating systems. With more
than 20 years behind it, YaST is a competent and flexible installer able to cover uncountable use
cases. But time goes by, and the good old YaST is starting to show its age in some aspects:

- The architecture of YaST is complex and its code-base has too much technical debt.
- Designing and building rich and modern user interfaces is a real challenge.
- Sharing logic with other tools like Salt or Ansible is very difficult.
- Some in-house solutions like [libyui](https://github.com/libyui/libyui) make more difficult to
  contribute to the project.

## What can I configure with Agama?

In principle Agama gives you the chance to configure every aspect that it is important at
installation time, namely partitioning, network set up and software installation. After all, you can
do any additional configuration using any other tool once the system is installed.

However, that's not 100% true and Agama allows configuring other aspects of the system at
installation time, like system localization.

## How does Agama look like?

Agama features a powerful web-based interface that can be used for local graphical installation and
can also be accessed from any device which has a browser.

Unlike the YaST wizard, which forces the user to go through some sequential steps to configure every
aspect of the system, the Agama interface offers a simpler workflow that is described at the
[interactive installation guide](docs/user/interactive) (screenshots included!).

We consider this interface as the best alternative for most of the use cases, replacing the
use of VNC or a text-based interface over SSH.

## Where is the NCURSES text-mode interface?

The approach to text-mode (console) installation is also different from YaST. Instead of offering a
pseudo-graphical interface that mimics the graphical one, Agama features a powerful
[command-line interface](docs/user/cli) that allows to drive and monitor the installation process
in many convenient and flexible ways.

## Where is the Expert Partitioner?

There is currently no direct replacement for the YaST Expert Partitioner. All the capabilities are
still there and can be used from the unattended installation, but we have still not decided how to
expose them in the interactive interface.

## What about unattended installation?

The installation process can be partially or totally automated and driven by:

  - A set of scripts based on Agama's command-line interface.
  - A profile in JSON format (actually [Jsonnet](https://jsonnet.org/)), similar to AutoYaST.
  - Any third party tool like [Uyuni](https://www.uyuni-project.org/) through the HTTP interface.
  - Any combination of the three previous methods.

For more information see the [unattended installation guide](docs/user/unattended).

## Can I use my existing AutoYaST profiles and infrastructure?

Yes, Agama can fetch and process AutoYaST profiles. It supports the most used AutoYaST features
like [dynamic profiles](https://documentation.suse.com/sles/15-SP5/html/SLES-all/part-dynamic-profiles.html)
and the most used AutoYaST sections like `partitioning`, `networking`, `software`, `scripts`, etc.

But there are also some caveats. Bear in mind that Agama is focused on the installation and it delegates
further configuration to other tools. Therefore it includes less features and there are some
sections you can find in an AutoYaST profile that are ignored by Agama.

You can find further details in the [AutoYaST support section](http://localhost:3000/docs/user/autoyast).

## Will Agama replace YaST as the main installer for SUSE Linux?

Although nothing is set in stone, that is the plan for SUSE Linux Enterprise Server 16. 

## Will Agama replace YaST as the main installer for openSUSE distributions?

There are no concrete plans in that regard.

The YaST Team works in close collaboration with several openSUSE contributors to make sure Agama can
install openSUSE Tumbleweed, openSUSE MicroOS and the first prototypes of Leap 16.0. But there is
no concrete roadmap for the adoption of Agama as an endorsed installer for those distributions.

