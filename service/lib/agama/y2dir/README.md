This directory contains some redefinitions of YaST modules in order to avoid executing the actual code of some YaST modules.

# Why is this needed?

Agama relies on YaST code but some parts of YaST have been replaced by rust code. We need to prevent calling to the YaST code that has been replaced. Otherwise, Agama will not work as expected.

# How to replace a YaST module

The code replacement of the YaST modules is done by means of the *Y2DIR* mechanism of YaST. When a
service is started (check *agamactl* script), the YaST modules redefined by the service (under
*lib/agama/y2dir/*) are added to the *Y2DIR* environment variable. YaST takes precedence of the
paths at *Y2DIR*, so these files will be loaded instead of the files originally delivered by YaST.
