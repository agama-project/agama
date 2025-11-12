## Profiling

This document intention is to provide some useful collection of tips and links how to measure and improve performance of Agama.
The order of techniques goes from top to bottom. So to measure first the web UI/CLI and then go down throught layers.

### Web UI

Here for measure it is recommended to use devtools and network tool, which should how long response take. E.g. Firefox marked by turtle all resources that takes to long to load.
TODO: add tower middleware to automatically log slow responses.

### Rust Code

When checking either web-server, cli or dbus-server part written in rust, it is recommended to use debug output ( or at least modify release target to include debugging symbols ).
Then it is possible to use e.g. `perf` or `valgrind --tool callgrind` to get hot places where the most time is spend. For viewing result, it is usually useful to use annotated list like `callgrind_annotate <file>`.

But often majority of time is waiting for dbus answers, so see next section.

### DBus

To find which methods in dbus takes the most time I do not find reliable tool. I tried busctl monitor, dbus-monitor profile and also dbus-monitor pcap. And in all cases it start to be quite messy
when there are more calls. For pcap even wireshard does not help ( at least for me ).
TODO: write script that takes JSON from `busctl -j monitor` and writes sorted list of the methods response times.

### Ruby

Just use ruby profiler attached to dbus service that is written in ruby.
