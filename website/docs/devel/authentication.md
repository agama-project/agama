---
sidebar_position: 2
---

# Authentication

Each client needs to authenticate in order to interact with the server[^ping] using `root`'s user
password. Agama relies on [PAM](https://en.wikipedia.org/wiki/Linux_PAM) to perform the authentication.

On successful authentication, the server generates a [JSON Web Token (RFC 7519)][jwt] that the client
will include in the subsequent requests. The web client stores the token in an HTTP-only
cookie[^http-only] and the CLI uses a file with restricted permissions.

:::tip
If you are implementing your own client, remember to send the token on each request.
:::

[^ping]: There is an `/ping` endpoint that does not need authentication.

[^http-only]: HTTP-only cookies cannot be accessed by client-side JavaScript.

## JSON Web Tokens

Agama's JSON Web Token carries just a single claim: the expiration date. The token's lifetime is
currently set to just one day[^lifetime]. To generate the token, Agama requires a secret key that
can be specified using the `jwt_secret` configuration option in `/etc/agama.d/server.yml`. If no key
is specified, Agama will generate a random 30 characters string as key[^rand].

:::tip
The disadvantage of not setting a secret key is that, if you restart Agama, all previously generated
tokens become invalid. So if you are doing some development work, you might be interested on setting
a key.
:::

[^lifetime]: Token's lifetime might be configurable in the future.

[^rand]: [rand](https://crates.io/crates/rand): Random number generators and other randomness functionality.

## Skipping the authentication

When using Agama locally (e.g., in the installation medium), it would be unpleasant to ask for a
password. For that reason, Agama creates and stores a token on the file system (`/run/agama/token`)
that any client can use for authentication. Obviously, the file is protected and it is readable only
for the `root` user.

Therefore, the command-line interface, when ran as `root`, can use that token to authenticate each request.

However, the web interface does not have access to the token, so it needs some magic to inject the
token into the browser. Agama's HTTP server implements an end-point that allows to authenticate
using a valid token[^login-from-token]. So Agama's [startup
script](https://github.com/openSUSE/agama/blob/1ca19ace4ae918029bbecb3c1956bccfcb8626ce/live/root/root/.icewm/startup#L8)
injects the URL, including the token, as `browser.startup.homepage` in [Firefox's
preferences](https://github.com/openSUSE/agama/blob/1ca19ace4ae918029bbecb3c1956bccfcb8626ce/live/root/.mozilla/firefox/profile/user.js.template#L10).

[jwt]: https://jwt.io

[^login-from-token]:
    The `/login?token=$TOKEN` is a helper URL that allows importing the token into
    the browser.
