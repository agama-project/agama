# Web server development notes

This document includes some notes about the usage and development of the new Agama web server.

## Installing Rust and related tools

It is recommended to use Rustup to install Rust and related tools. In openSUSE distributions, rustup
is available as a package. After rustup is installed, you can proceed to install the toolchain:

```
zypper --non-interactive in rustup
rustup install stable
```

In addition to the Rust compiler, the previous command would install some additionall components
like `cargo`, `clippy`, `rustfmt`, documentation, etc.

Another interesting addition might be
[cargo-binstall](https://github.com/cargo-bins/cargo-binstall), which allows to install Rust
binaries. If you are fine with this approach, just run:

```
cargo install cargo-binstall
```

## Setting up PAM

The web sever will use [Pluggable Authentication Modules
(PAM)](https://github.com/linux-pam/linux-pam) for authentication. For that
reason, you need to copy the `agama` service definition for PAM to `/usr/lib/pam.d`. Otherwise, PAM
would not know how to authenticate the service:

```
cp share/agama.pam /usr/lib/pam.d/agama
```

For further information, see [Authenticating with PAM](https://doc.opensuse.org/documentation/leap/security/single-html/book-security/index.html#cha-pam).

## Running the server

> [!NOTE]
> The web server needs to connect to Agama's D-Bus daemon. So you can either start the Agama service
> or just start the D-Bus daemon (`sudo bundle exec bin/agamactl -f` from the `service/` directory).

You need to run the server as `root`, so you cannot use `cargo run` directly. Instead, just do:

```
$ cargo build
$ sudo ./target/debug/agama-web-server serve
```

If it fails to compile, please check whether `clang-devel` and `pam-devel` are installed.

By default the server uses port 3000 and listens on all network interfaces. You
can use the `--address` option if you want to use a different port or a specific
network interface:

```
$ sudo ./target/debug/agama-web-server serve --address :::5678
```

Some more examples:

- Both IPv6 and IPv4, all interfaces: `--address :::5678`
- Both IPv6 and IPv4, only local loopback : `--address ::1:5678`
- IPv4 only, all interfaces: `--address 0.0.0.0:5678`
- IPv4 only, only local loopback : `--address 127.0.0.1:5678`
- IPv4, only specific interface: `--address 192.168.1.2:5678` (use the IP
  address of that interface)

The server can optionally listen on a secondary address, use the `--address2`
option for that.

## Trying the server

You can check whether the server is up and running by just performing a ping:

```
$ curl http://localhost:3000/ping
```

### Authentication

The web server uses a bearer token for HTTP authentication. You can get the token by providing your
password to the `/auth` endpoint.

```
$ curl http://localhost:3000/api/auth \
    -H "Content-Type: application/json" \
    -d '{"password": "your-password"}' 
{"token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3MDg1MTA5MzB9.3HmKAC5u4H_FigMqEa9e74OFAq40UldjlaExrOGqE0U"}⏎
```

Now you can access protected routes by including the token in the header:

```
$ curl -X GET http://localhost:3000/protected \
    -H "Accept: application/json" \
    -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3MDg1MTA5MzB9.3HmKAC5u4H_FigMqEa9e74OFAq40UldjlaExrOGqE0U"
```

### Connecting to the websocket

You can use `websocat` to connect to the websocket. To install the tool, just run:

```
$ cargo binstall websocat
```

If you did not install `cargo-binstall`, you can do:

```
$ cargo install websocat
```

Now, you can use the following command to connect:

```
$ websocat ws://localhost:3000/ws
    -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3MDg1MTA5MzB9.3HmKAC5u4H_FigMqEa9e74OFAq40UldjlaExrOGqE0U"
```

## SSL/TLS (HTTPS) Support

The web server supports encrypted communication using the HTTPS protocol.

The SSL certificate used by the server can be specified by the `--cert` and
`--key` command line options which should point to the PEM files:

```
$ sudo ./target/debug/agama-web-server serve --cert certificate.pem --key key.pem
```
The certificate is expected in the PEM format, if you have a certificate in
another format you can convert it using the openSSL tools.

If a SSL certificate is not specified via command line then the server generates
a self-signed certificate. Currently it is only kept in memory and generated
again at each start.

The HTTPS protocol is required for external connections, the HTTP connections
are automatically redirected to HTTPS. *But it still means that the original
HTTP communication can be intercepted by an attacker, do not rely on this
redirection!*

For internal connections coming from the same machine (via the
`http://localhost` URL) the unencrypted HTTP communication is allowed.
