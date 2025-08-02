# Run-time Configuration

noCTF supports **run-time configuration** via the admin panel, allowing administrators to update
key system settings without modifying environment variables or restarting the application.

This feature provides dynamic control over system behaviour, but should be handled with care. Some
configuration namespaces contain **sensitive data** such as secrets or tokens.


## Permissions Required
- `admin.config.get`: Required to **view** configuration
- `admin.config.update`: Required to **update** configuration


## Configuration Interface

The configuration interface in the admin panel is **auto-generated from JSON Schemas**. This enables
a structured, dynamic UI while still allowing direct edits to the underlying JSON configuration.

This design is especially useful for plugin developers, as it allows the extension of configuration
without manual UI updates.

Users can choose to:

* Use the visual form-based UI.
* Directly edit the raw JSON. This is validated both in the frontend and backend.


## Core Configuration Namespaces

Each configuration area is grouped by a **namespace**. Below are the core namespaces supported by
noCTF:

### `core.file`
* Defines file upload providers and settings for file link generation in challenges.
* Configure storage backends (e.g., local, S3 compatible)
* Set file access URLs and policies

### `core.score`
* Allows organisers to define custom dynamic scoring rules.
* Expressions are evaluated using [expr-eval](https://www.npmjs.com/package/expr-eval)
* Enables flexible scoring systems beyond static point values


### `core.team`
* Controls team management policies.
* Configure the maximum number of members per team


### `core.notification`

* Manages outbound notification delivery.
* Supports:
  * Raw webhook delivery
  * Styled Discord notifications (via Discord webhooks)
* Discord messages can be customised using Handlebars templates


### `core.email`

* Controls email delivery settings for account verification and password reset flows.
* Default provider is `dummy`, which logs emails to the console
* Can be configured to use SMTP or other email delivery services


### `core.setup`

* Manages overall CTF lifecycle configuration.
* Start and end times for the CTF
* Immediate activation and deactivation of the CTF
* Default division for new teams
* Enable late submissions
* Configure divisions exposed to the live CTFtime scoreboard endpoint


### `core.auth`

* Controls user authentication behaviour.
* Enable or disable:
  * Email-based registration
  * Login via password
* Enable OAuth Login (if configured)
* Restrict registrations to specific email domains


### `core.captcha`
* Configures CAPTCHA protection for frontend API routes.
* Currently only supports Cloudflare Turnstile.
* Captcha is attached automatically to relevant frontend API requests.


### `core.tickets` *(Experimental)*
> Note: Most settings under this namespace are not yet functional. Expect changes and incomplete
behaviour.
Intended for the future ticketing system integration.



## Important Notes

* Configuration is applied immediately after being saved. No restart required.
* Treat configuration changes as sensitive operations, especially when editing JSON directly.
* Plugin developers can define new namespaces via schema extensions.
