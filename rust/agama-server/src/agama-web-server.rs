use agama_lib::connection_to;
use agama_server::{
    l10n::helpers,
    web::{self, run_monitor},
};
use axum::{
    http::{Request, Response},
    Router,
};
use clap::{Args, Parser, Subcommand};
use futures_util::pin_mut;
use hyper::body::Incoming;
use hyper_util::rt::{TokioExecutor, TokioIo};
use hyper_util::server::conn::auto::Builder;
use openssl::ssl::{Ssl, SslAcceptor, SslFiletype, SslMethod};
use std::process::{ExitCode, Termination};
use std::{path::PathBuf, pin::Pin};
use tokio::sync::broadcast::channel;
use tokio_openssl::SslStream;
use tower::Service;
use tracing_subscriber::prelude::*;
use utoipa::OpenApi;

#[derive(Subcommand, Debug)]
enum Commands {
    /// Start the API server.
    Serve(ServeArgs),
    /// Display the API documentation in OpenAPI format.
    Openapi,
}

#[derive(Parser, Debug)]
#[command(
    version,
    about = "Starts the Agama web-based API.",
    long_about = None)]
struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Args, Debug)]
struct ServeArgs {
    // Address/port to listen on (":::3000" listens for both IPv6 and IPv4
    // connections unless manually disabled in /proc/sys/net/ipv6/bindv6only)
    #[arg(long, default_value = ":::3000", help = "Primary address to listen on")]
    address: String,
    #[arg(
        long,
        default_value = "",
        help = "Optional secondary address to listen on"
    )]
    address2: String,
    #[arg(
        long,
        default_value = "",
        help = "Path to the SSL private key file in PEM format"
    )]
    key: String,
    #[arg(
        long,
        default_value = "",
        help = "Path to the SSL certificate file in PEM format"
    )]
    cert: String,
    // Agama D-Bus address
    #[arg(long, default_value = "unix:path=/run/agama/bus")]
    dbus_address: String,
}

impl ServeArgs {
    /// Builds an SSL acceptor using a provided SSL certificate or generates a self-signed one
    fn ssl_acceptor(&self) -> Result<SslAcceptor, openssl::error::ErrorStack> {
        let mut tls_builder = SslAcceptor::mozilla_modern_v5(SslMethod::tls_server())?;

        if self.cert.is_empty() && self.key.is_empty() {
            let (cert, key) = agama_server::cert::create_certificate()?;

            tls_builder.set_private_key(&key)?;
            tls_builder.set_certificate(&cert)?;

            // for debugging you might dump the certificate to a file:
            // use std::io::Write;
            // let mut cert_file = std::fs::File::create("agama_cert.pem").unwrap();
            // let mut key_file = std::fs::File::create("agama_key.pem").unwrap();
            // cert_file.write_all(cert.to_pem().unwrap().as_ref()).unwrap();
            // key_file.write_all(key.private_key_to_pem_pkcs8().unwrap().as_ref()).unwrap();
        } else {
            tracing::info!("Loading PEM certificate: {}", self.cert);
            tls_builder.set_certificate_file(PathBuf::from(self.cert.clone()), SslFiletype::PEM)?;

            tracing::info!("Loading PEM key: {}", self.key);
            tls_builder.set_private_key_file(PathBuf::from(self.key.clone()), SslFiletype::PEM)?;
        }

        // check that the key belongs to the certificate
        tls_builder.check_private_key()?;

        Ok(tls_builder.build())
    }
}

/// Checks whether the connection uses SSL or not
/// `stream`: the TCP stream containing a request from client
async fn is_ssl_stream(stream: &tokio::net::TcpStream) -> bool {
    // a buffer for reading the first byte from the TCP connection
    let mut buf = [0u8; 1];

    // peek() receives the data without removing it from the stream,
    // the data is not consumed, it will be read from the stream again later
    stream
        .peek(&mut buf)
        .await
        // SSL3.0/TLS1.x starts with byte 0x16
        // SSL2 starts with 0x80 (but should not be used as it is considered insecure)
        // see https://stackoverflow.com/q/3897883
        // otherwise consider the stream as a plain HTTP stream possibly starting with
        // "GET ... HTTP/1.1" or "POST ... HTTP/1.1" or a similar line
        .is_ok_and(|_| buf[0] == 0x16u8 || buf[0] == 0x80u8)
}

/// Builds a response for the HTTP -> HTTPS redirection
/// returns (HTTP response status code) 308 permanent redirect
fn redirect_https(host: &str, uri: &hyper::Uri) -> Response<String> {
    let builder = Response::builder()
        // build the redirection target URL
        .header("Location", format!("https://{}{}", host, uri))
        .status(hyper::StatusCode::PERMANENT_REDIRECT);

    // according to documentation this can fail only if builder was previosly fed with data
    // which failed to parse into an internal representation (e.g. invalid header)
    builder
        .body(String::from(""))
        .expect("Failed to create redirection request")
}

/// Builds an error response for the HTTP -> HTTPS redirection when we cannot build
/// the redirect response from the original request
/// returns error 400
fn redirect_error() -> Response<String> {
    let builder = Response::builder().status(hyper::StatusCode::BAD_REQUEST);

    let msg = "HTTP protocol is not allowed for external requests, please use HTTPS.\n";
    // according to documentation this can fail only if builder was previosly fed with data
    // which failed to parse into an internal representation (e.g. invalid header)
    builder
        .body(String::from(msg))
        .expect("Failed to create an error response")
}

/// Builds a router for the HTTP -> HTTPS redirection
/// if the redirection URL cannot be built from the original request it returns error 400
/// instead of the redirection
fn https_redirect() -> Router {
    // see https://docs.rs/axum/latest/axum/routing/struct.Router.html#example
    let redirect_service = tower::service_fn(|req: axum::extract::Request| async move {
        if let Some(host) = req.headers().get("host").and_then(|h| h.to_str().ok()) {
            Ok(redirect_https(host, req.uri()))
        } else {
            Ok(redirect_error())
        }
    });

    Router::new()
        // the wildcard path below does not match an empty path, we need to match it explicitly
        .route_service("/", redirect_service)
        .route_service("/*path", redirect_service)
}

/// handle the HTTPS connection
async fn handle_https_stream(
    tls_acceptor: SslAcceptor,
    addr: std::net::SocketAddr,
    tcp_stream: tokio::net::TcpStream,
    service: axum::Router,
) {
    // handle HTTPS connection
    let ssl = Ssl::new(tls_acceptor.context()).unwrap();
    let mut tls_stream = SslStream::new(ssl, tcp_stream).unwrap();
    if let Err(err) = SslStream::accept(Pin::new(&mut tls_stream)).await {
        tracing::error!("Error during TSL handshake from {}: {}", addr, err);
    }

    let stream = TokioIo::new(tls_stream);
    let hyper_service =
        hyper::service::service_fn(move |request: Request<Incoming>| service.clone().call(request));

    let ret = Builder::new(TokioExecutor::new())
        .serve_connection_with_upgrades(stream, hyper_service)
        .await;

    if let Err(err) = ret {
        tracing::error!("Error serving connection from {}: {}", addr, err);
    }
}

/// handle the HTTP connection
async fn handle_http_stream(
    addr: std::net::SocketAddr,
    tcp_stream: tokio::net::TcpStream,
    service: axum::Router,
    redirector_service: axum::Router,
) {
    let stream = TokioIo::new(tcp_stream);
    let hyper_service = hyper::service::service_fn(move |request: Request<Incoming>| {
        // check if it is local connection or external
        // the to_canonical() converts IPv4-mapped IPv6 addresses
        // to plain IPv4, then is_loopback() works correctly for the IPv4 connections
        if addr.ip().to_canonical().is_loopback() {
            // accept plain HTTP on the local connection
            service.clone().call(request)
        } else {
            // redirect external connections to HTTPS
            redirector_service.clone().call(request)
        }
    });

    let ret = Builder::new(TokioExecutor::new())
        .serve_connection_with_upgrades(stream, hyper_service)
        .await;

    if let Err(err) = ret {
        tracing::error!("Error serving connection from {}: {}", addr, err);
    }
}

/// Starts the web server
async fn start_server(address: String, service: Router, ssl_acceptor: SslAcceptor) {
    tracing::info!("Starting Agama web server at {}", address);

    // see https://github.com/tokio-rs/axum/blob/main/examples/low-level-openssl/src/main.rs
    // how to use axum with openSSL
    let listener = tokio::net::TcpListener::bind(&address)
        .await
        .unwrap_or_else(|error| {
            let msg = format!("Error: could not listen on {}: {}", &address, error);
            tracing::error!(msg);
            panic!("{}", msg)
        });

    pin_mut!(listener);

    let redirector = https_redirect();

    loop {
        let tower_service = service.clone();
        let redirector_service = redirector.clone();
        let tls_acceptor = ssl_acceptor.clone();

        // Wait for a new tcp connection; if it fails we cannot do much, so print an error and die
        let (tcp_stream, addr) = listener
            .accept()
            .await
            .expect("Failed to open port for listening");

        tokio::spawn(async move {
            if is_ssl_stream(&tcp_stream).await {
                // handle HTTPS connection
                handle_https_stream(tls_acceptor, addr, tcp_stream, tower_service).await;
            } else {
                // handle HTTP connection
                handle_http_stream(addr, tcp_stream, tower_service, redirector_service).await;
            }
        });
    }
}

/// Start serving the API.
/// `options`: command-line arguments.
async fn serve_command(args: ServeArgs) -> anyhow::Result<()> {
    let journald = tracing_journald::layer().expect("could not connect to journald");
    tracing_subscriber::registry().with(journald).init();

    let (tx, _) = channel(16);
    run_monitor(tx.clone()).await?;

    let config = web::ServiceConfig::load()?;
    let dbus = connection_to(&args.dbus_address).await?;
    let service = web::service(config, tx, dbus).await?;

    let ssl_acceptor = if let Ok(ssl_acceptor) = args.ssl_acceptor() {
        ssl_acceptor
    } else {
        return Err(anyhow::anyhow!("SSL initialization failed"));
    };

    let mut addresses = vec![args.address];

    if !args.address2.is_empty() {
        addresses.push(args.address2);
    }

    let servers: Vec<_> = addresses
        .iter()
        .map(|a| {
            tokio::spawn(start_server(
                a.clone(),
                service.clone(),
                ssl_acceptor.clone(),
            ))
        })
        .collect();

    futures_util::future::join_all(servers).await;

    Ok(())
}

/// Display the API documentation in OpenAPI format.
fn openapi_command() -> anyhow::Result<()> {
    println!("{}", web::ApiDoc::openapi().to_pretty_json().unwrap());
    Ok(())
}

async fn run_command(cli: Cli) -> anyhow::Result<()> {
    match cli.command {
        Commands::Serve(options) => serve_command(options).await,
        Commands::Openapi => openapi_command(),
    }
}

/// Represents the result of execution.
pub enum CliResult {
    /// Successful execution.
    Ok = 0,
    /// Something went wrong.
    Error = 1,
}

impl Termination for CliResult {
    fn report(self) -> ExitCode {
        ExitCode::from(self as u8)
    }
}

#[tokio::main]
async fn main() -> CliResult {
    let cli = Cli::parse();
    _ = helpers::init_locale();

    if let Err(error) = run_command(cli).await {
        eprintln!("{:?}", error);
        return CliResult::Error;
    }

    CliResult::Ok
}
