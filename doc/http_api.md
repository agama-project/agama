---
## HTTP API: An Overview

This document outlines the **public HTTP API**. It provides an alternative way to interact with the system, complementing the Command Line Interface (CLI) and web user interface. It's important to note that both the CLI and web UI also leverage this HTTP API for their operations.

---
### API Documentation

Agama uses **OpenAPI** to document its HTTP API. You can generate the documentation using the following commands:

```shell
(cd rust; cargo xtask openapi)
cat rust/out/openapi/*.json
```

---
### Request and Response Body

The Agama HTTP API uses **JSON** as its request and response body format. The schema for this JSON is thoroughly documented within the OpenAPI specification.

---
### Configuration-Based API

For automated installations, the system provides two primary API endpoints for managing configurations across various modules:

* **GET `/api/${module}/config`**: Use this endpoint to **export** the current system configuration for a specific module.
* **PUT `/api/${module}/config`**: Use this endpoint to **load** an unattended installation profile for a specific module. In some cases, the loaded configuration is also immediately applied; further details are available below.

---
### Future Enhancements: PATCH `/api/${module}/config` for Targeted Modifications

Following internal discussions, we plan to introduce a **PATCH `/api/${module}/config`** endpoint. This new endpoint will enable more granular modifications and applications of configurations, and it will replace the existing HTTP API methods used for modifications. While not strictly required, the structure of the PATCH request will likely mirror the configuration's existing layout.

This enhancement will allow you to modify specific parts of the configuration. In some cases, these changes can be applied immediately without needing a full installation. This is especially useful for technologies that require configuration to be applied *before* an installation begins, such as:

* Network settings
* System registration
* iSCSI
* DASD
* zFCP

The key advantage of this PATCH approach is its ability to minimize **race conditions** and to more easily keep the configuration manipulation API closely aligned with the core configuration API. By only modifying the necessary parts of the configuration, it reduces conflicts, which is particularly helpful in scenarios like rapid clicks within the web user interface.
