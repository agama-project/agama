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

## How is Agama different from YaST?

TBD.

## Will Agama replace YaST as the main installer for SUSE Linux or openSUSE distributions?

TBD.

## What can I configure with Agama?

In principle Agama gives you the chance to configure every aspect that it is important at
installation time, namely partitioning, network set up and software installation. After all, you can
do any additional configuration using any other tool once the system is installed.

However, that's not 100% true and Agama allows configuring other aspects of the system at
installation time, like system localization.

## Where is the NCURSES interface?

Agama features a powerful web-based interface that you can connect to from any device which has a
browser. We consider this interface as the best alternative for most of the use cases, replacing the
use of VNC or a text-based interface over SSH.

However, it might happen that you need a text-based interface at some point. For those use cases,
[Agama's command-line interface](docs/user/cli) is your best option.

## Can I use my existing AutoYaST profiles and infrastructure?

Yes, but with some caveats. Bear in mind that Agama is focused on the installation and it delegates
further configuration to other tools. Therefore it includes less features and there are many
sections you can find in an AutoYaST profile that are ignored by Agama.

However, it has support for the most used AutoYaST features, including [dynamic
profiles](https://documentation.suse.com/sles/15-SP5/html/SLES-all/part-dynamic-profiles.html) and
the most used AutoYaST sections (e.g., `partitioning`).

You can find further details in the [AutoYaST support section](http://localhost:3000/docs/user/autoyast).
