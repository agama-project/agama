---
## HTTP API: An Overview

This document outlines the **public HTTP API**. It offers an alternative way to interact with the system, complementing the Command Line Interface (CLI) and web user interface. Importantly, both the CLI and web UI also leverage this HTTP API for their operations.

---
### Configuration-Based API

For automated installations, the system provides two primary API endpoints for managing configurations across various modules:

* **GET `/config`**: Use this endpoint to **export** the current system configuration.
* **PUT `/config`**: Use this endpoint to **load** an unattended installation profile. In some cases, the loaded configuration is also immediately applied; more details on this below.

---
### Future Enhancements: PATCH `/config` for Targeted Modifications

Following internal discussions, we plan to introduce a **PATCH `/config`** endpoint. This new endpoint will enable more granular modifications and applications of configurations, and it will replace the existing HTTP API methods used for modifications. While not strictly required, the structure of the PATCH request will likely mirror the configuration's existing layout.

This enhancement will let you modify specific parts of the configuration. In some cases, these changes can be applied immediately without needing a full installation. This is especially useful for technologies that need configuration applied *before* an installation begins, such as:

* Network settings
* System registration
* iSCSI
* DASD
* zFCP

The key advantage of this PATCH approach is its ability to minimize **race conditions** and to more easily keep the configuration manipulation API closely aligned with the core configuration API. By only modifying the necessary parts of the configuration, it reduces conflicts, which is particularly helpful in scenarios like rapid clicks within the web user interface.
