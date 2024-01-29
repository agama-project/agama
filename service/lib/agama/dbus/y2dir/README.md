This directory contains some redefinitions of YaST modules in order to call to D-Bus methods instead
of executing the actual code of the module.

# Why is this needed?

Agama relies on YaST code and YaST usually works as a single process. By contrast, Agama works as a
set of different processes (software service, storage service, etc), and each service runs its own
YaST instance.

Having different YaST instances implies that the information is scattered in different processes.
For example, only the YaST instance in the software service has the information about the software
configuration. This means that other YaST instances need to ask to the software YaST instance for
the information.

# How to communicate among YaST instances

A YaST instance can get information from other instance by doing a D-Bus call to the service running
such an instance. For example, the YaST instance in the storage service has to call to the D-Bus API
of the software service instead of directly calling to the software module code. To achieve that,
the storage service replaces the implementation of the YaST software module by its own
implementation which uses D-Bus calls.

# How to replace a YaST module

The code replacement of the YaST modules is done by means of the *Y2DIR* mechanism of YaST. When a
service is started (check *agamactl* script), the YaST modules redefined by the service (under
*lib/agama/dbus/y2dir/*) are added to the *Y2DIR* environment variable. YaST takes precedence of the
paths at *Y2DIR*, so these files will be loaded instead of the files originally delivered by YaST.
