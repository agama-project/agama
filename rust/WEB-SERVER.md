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

The web sever will use PAM for authentication. For some reason, you might want to
copy the `share/agama.pam` file to `/usr/lib/pam.d/agama`

```
cp share/agama.pam /usr/lib/pam.d/agama
```

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

You can add a `--listen` flag if you want to use a different port:

```
$ sudo ./target/debug/agama-web-server serve --listen 0.0.0.0:5678
```

## Trying the server

You can check whether the server is up and running by just performing a ping:

```
$ curl http://localhost:3000/ping
```

### Authentication

The web server uses a bearer token for HTTP authentication. You can get the token by providing your
password to the `/authenticate` endpoint.

```
$ curl http://localhost:3000/authenticate \
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
```
