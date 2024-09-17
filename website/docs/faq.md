# Frequently Asked Questions

## Why a New Installer

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
