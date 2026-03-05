use agama_proxy::model::{ProxyConfig, Protocol, Proxy};
use agama_network::{
    model::{Connection, ConnectionConfig, NetworkState, StateConfig},
    types::{DeviceState, DeviceType, Ipv4Method, Ipv6Method},
    Adapter, NetworkManagerAdapter,
};
use anyhow::Result;
use cidr::IpInet;
use crossterm::{
    event::{Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use tokio_stream::StreamExt;
use crossterm::event::EventStream;
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    widgets::{Block, Borders, List, ListItem, ListState, Paragraph, Tabs},
    Terminal,
};
use std::{io, net::IpAddr, str::FromStr};

#[derive(Copy, Clone, Debug, PartialEq)]
enum AppTab {
    Connections,
    Devices,
    Proxy,
}

#[derive(Copy, Clone, Debug, PartialEq)]
enum EditTab {
    Common,
    Ipv4,
    Ipv6,
}

impl EditTab {
    fn to_index(self) -> usize {
        match self {
            EditTab::Common => 0,
            EditTab::Ipv4 => 1,
            EditTab::Ipv6 => 2,
        }
    }

    fn next(self, _config: &ConnectionConfig) -> Self {
        match self {
            EditTab::Common => EditTab::Ipv4,
            EditTab::Ipv4 => EditTab::Ipv6,
            EditTab::Ipv6 => EditTab::Common,
        }
    }

    fn previous(self, _config: &ConnectionConfig) -> Self {
        match self {
            EditTab::Common => EditTab::Ipv6,
            EditTab::Ipv4 => EditTab::Common,
            EditTab::Ipv6 => EditTab::Ipv4,
        }
    }
}

#[derive(Debug, PartialEq, Copy, Clone)]
enum ProxyField {
    Enabled,
    Http,
    Https,
    Ftp,
    Gopher,
    Socks,
    Socks5,
    NoProxy,
}

impl ProxyField {
    fn next(self) -> Self {
        match self {
            ProxyField::Enabled => ProxyField::Http,
            ProxyField::Http => ProxyField::Https,
            ProxyField::Https => ProxyField::Ftp,
            ProxyField::Ftp => ProxyField::Gopher,
            ProxyField::Gopher => ProxyField::Socks,
            ProxyField::Socks => ProxyField::Socks5,
            ProxyField::Socks5 => ProxyField::NoProxy,
            ProxyField::NoProxy => ProxyField::Enabled,
        }
    }

    fn previous(self) -> Self {
        match self {
            ProxyField::Enabled => ProxyField::NoProxy,
            ProxyField::Http => ProxyField::Enabled,
            ProxyField::Https => ProxyField::Http,
            ProxyField::Ftp => ProxyField::Https,
            ProxyField::Gopher => ProxyField::Ftp,
            ProxyField::Socks => ProxyField::Gopher,
            ProxyField::Socks5 => ProxyField::Socks,
            ProxyField::NoProxy => ProxyField::Socks5,
        }
    }
}

#[derive(Debug, PartialEq, Copy, Clone)]
enum EditField {
    Id,
    Interface,
    Ipv4Method,
    Ipv4Addresses,
    Ipv4Gateway,
    Ipv6Method,
    Ipv6Addresses,
    Ipv6Gateway,
    Nameservers,
    Ports,
    // Bond
    BondMode,
    BondOptions,
    // Bridge
    BridgeStp,
    BridgePriority,
    // VLAN
    VlanId,
    VlanParent,
}

impl EditField {
    fn first_in_tab(tab: EditTab) -> Self {
        match tab {
            EditTab::Common => EditField::Id,
            EditTab::Ipv4 => EditField::Ipv4Method,
            EditTab::Ipv6 => EditField::Ipv6Method,
        }
    }

    fn next(self, config: &ConnectionConfig) -> (Self, EditTab) {
        match (self, config) {
            (EditField::Id, _) => (EditField::Interface, EditTab::Common),
            (EditField::Interface, _) => (EditField::Nameservers, EditTab::Common),

            // From Nameservers, go to type-specific fields or IPv4
            (EditField::Nameservers, ConnectionConfig::Bond(_)) => (EditField::Ports, EditTab::Common),
            (EditField::Nameservers, ConnectionConfig::Bridge(_)) => (EditField::Ports, EditTab::Common),
            (EditField::Nameservers, ConnectionConfig::Vlan(_)) => (EditField::VlanId, EditTab::Common),
            (EditField::Nameservers, _) => (EditField::Ipv4Method, EditTab::Ipv4),

            // Bond fields
            (EditField::Ports, ConnectionConfig::Bond(_)) => (EditField::BondMode, EditTab::Common),
            (EditField::BondMode, _) => (EditField::BondOptions, EditTab::Common),
            (EditField::BondOptions, _) => (EditField::Ipv4Method, EditTab::Ipv4),

            // Bridge fields
            (EditField::Ports, ConnectionConfig::Bridge(_)) => (EditField::BridgeStp, EditTab::Common),
            (EditField::BridgeStp, _) => (EditField::BridgePriority, EditTab::Common),
            (EditField::BridgePriority, _) => (EditField::Ipv4Method, EditTab::Ipv4),

            // Vlan fields
            (EditField::VlanId, _) => (EditField::VlanParent, EditTab::Common),
            (EditField::VlanParent, _) => (EditField::Ipv4Method, EditTab::Ipv4),

            (EditField::Ipv4Method, _) => (EditField::Ipv4Addresses, EditTab::Ipv4),
            (EditField::Ipv4Addresses, _) => (EditField::Ipv4Gateway, EditTab::Ipv4),
            (EditField::Ipv4Gateway, _) => (EditField::Ipv6Method, EditTab::Ipv6),
            (EditField::Ipv6Method, _) => (EditField::Ipv6Addresses, EditTab::Ipv6),
            (EditField::Ipv6Addresses, _) => (EditField::Ipv6Gateway, EditTab::Ipv6),
            (EditField::Ipv6Gateway, _) => (EditField::Id, EditTab::Common),

            // Fallback
            (EditField::Ports, _) => (EditField::Ipv4Method, EditTab::Ipv4),
        }
    }

    fn previous(self, config: &ConnectionConfig) -> (Self, EditTab) {
        match (self, config) {
            (EditField::Id, _) => (EditField::Ipv6Gateway, EditTab::Ipv6),
            (EditField::Interface, _) => (EditField::Id, EditTab::Common),
            (EditField::Nameservers, _) => (EditField::Interface, EditTab::Common),

            // From Ipv4Method, go back to type-specific fields or Nameservers
            (EditField::Ipv4Method, ConnectionConfig::Bond(_)) => (EditField::BondOptions, EditTab::Common),
            (EditField::Ipv4Method, ConnectionConfig::Bridge(_)) => (EditField::BridgePriority, EditTab::Common),
            (EditField::Ipv4Method, ConnectionConfig::Vlan(_)) => (EditField::VlanParent, EditTab::Common),
            (EditField::Ipv4Method, _) => (EditField::Nameservers, EditTab::Common),

            // Bond
            (EditField::BondOptions, _) => (EditField::BondMode, EditTab::Common),
            (EditField::BondMode, _) => (EditField::Ports, EditTab::Common),
            (EditField::Ports, ConnectionConfig::Bond(_)) => (EditField::Nameservers, EditTab::Common),

            // Bridge
            (EditField::BridgePriority, _) => (EditField::BridgeStp, EditTab::Common),
            (EditField::BridgeStp, _) => (EditField::Ports, EditTab::Common),
            (EditField::Ports, ConnectionConfig::Bridge(_)) => (EditField::Nameservers, EditTab::Common),

            // Vlan
            (EditField::VlanParent, _) => (EditField::VlanId, EditTab::Common),
            (EditField::VlanId, _) => (EditField::Nameservers, EditTab::Common),

            (EditField::Ipv4Addresses, _) => (EditField::Ipv4Method, EditTab::Ipv4),
            (EditField::Ipv4Gateway, _) => (EditField::Ipv4Addresses, EditTab::Ipv4),
            (EditField::Ipv6Method, _) => (EditField::Ipv4Gateway, EditTab::Ipv4),
            (EditField::Ipv6Addresses, _) => (EditField::Ipv6Method, EditTab::Ipv6),
            (EditField::Ipv6Gateway, _) => (EditField::Ipv6Addresses, EditTab::Ipv6),

            // Fallback
            (EditField::Ports, _) => (EditField::Nameservers, EditTab::Common),
        }
    }
}

#[derive(Debug)]
enum AppMode {
    Normal,
    SelectingType(ListState),
    EditingConnection(EditField),
    EditingProxy(ProxyField),
}

impl PartialEq for AppMode {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (AppMode::Normal, AppMode::Normal) => true,
            (AppMode::SelectingType(_), AppMode::SelectingType(_)) => true,
            (AppMode::EditingConnection(f1), AppMode::EditingConnection(f2)) => f1 == f2,
            (AppMode::EditingProxy(f1), AppMode::EditingProxy(f2)) => f1 == f2,
            _ => false,
        }
    }
}

impl AppTab {
    fn to_index(self) -> usize {
        match self {
            AppTab::Connections => 0,
            AppTab::Devices => 1,
            AppTab::Proxy => 2,
        }
    }

    fn next(self) -> Self {
        match self {
            AppTab::Connections => AppTab::Devices,
            AppTab::Devices => AppTab::Proxy,
            AppTab::Proxy => AppTab::Connections,
        }
    }

    fn previous(self) -> Self {
        match self {
            AppTab::Connections => AppTab::Proxy,
            AppTab::Devices => AppTab::Connections,
            AppTab::Proxy => AppTab::Devices,
        }
    }
}

struct App {
    network_state: Option<NetworkState>,
    connections_list_state: ListState,
    devices_list_state: ListState,
    error_message: Option<String>,
    info_message: Option<String>,
    active_tab: AppTab,
    active_edit_tab: EditTab,
    mode: AppMode,
    // Form fields for editing
    edit_id: String,
    edit_type: DeviceType,
    edit_interface: String,
    edit_ipv4_method: Ipv4Method,
    edit_ipv4_addresses: String,
    edit_ipv4_gateway: String,
    edit_ipv6_method: Ipv6Method,
    edit_ipv6_addresses: String,
    edit_ipv6_gateway: String,
    edit_nameservers: String,
    edit_ports: String,
    // Bond
    edit_bond_mode: agama_network::types::BondMode,
    edit_bond_options: String,
    // Bridge
    edit_bridge_stp: bool,
    edit_bridge_priority: String,
    // VLAN
    edit_vlan_id: String,
    edit_vlan_parent: String,
    // Proxy fields
    proxy_enabled: bool,
    proxy_http: String,
    proxy_https: String,
    proxy_ftp: String,
    proxy_gopher: String,
    proxy_socks: String,
    proxy_socks5: String,
    proxy_no_proxy: String,
}

impl App {
    fn new() -> App {
        let mut connections_list_state = ListState::default();
        connections_list_state.select(Some(0));
        let mut devices_list_state = ListState::default();
        devices_list_state.select(Some(0));

        let mut app = App {
            network_state: None,
            connections_list_state,
            devices_list_state,
            error_message: None,
            info_message: None,
            active_tab: AppTab::Connections,
            active_edit_tab: EditTab::Common,
            mode: AppMode::Normal,
            edit_id: String::new(),
            edit_type: DeviceType::Ethernet,
            edit_interface: String::new(),
            edit_ipv4_method: Ipv4Method::Auto,
            edit_ipv4_addresses: String::new(),
            edit_ipv4_gateway: String::new(),
            edit_ipv6_method: Ipv6Method::Auto,
            edit_ipv6_addresses: String::new(),
            edit_ipv6_gateway: String::new(),
            edit_nameservers: String::new(),
            edit_ports: String::new(),
            edit_bond_mode: agama_network::types::BondMode::RoundRobin,
            edit_bond_options: String::new(),
            edit_bridge_stp: false,
            edit_bridge_priority: String::new(),
            edit_vlan_id: String::new(),
            edit_vlan_parent: String::new(),
            // Proxy
            proxy_enabled: false,
            proxy_http: String::new(),
            proxy_https: String::new(),
            proxy_ftp: String::new(),
            proxy_gopher: String::new(),
            proxy_socks: String::new(),
            proxy_socks5: String::new(),
            proxy_no_proxy: String::new(),
        };
        app.load_proxy();
        app
    }

    fn load_proxy(&mut self) {
        if let Ok(Some(config)) = ProxyConfig::read() {
            self.proxy_enabled = config.enabled.unwrap_or(false);
            self.proxy_no_proxy = config.no_proxy.unwrap_or_default();
            for proxy in config.proxies {
                match proxy.protocol {
                    Protocol::HTTP => self.proxy_http = proxy.url,
                    Protocol::HTTPS => self.proxy_https = proxy.url,
                    Protocol::FTP => self.proxy_ftp = proxy.url,
                    Protocol::GOPHER => self.proxy_gopher = proxy.url,
                    Protocol::SOCKS => self.proxy_socks = proxy.url,
                    Protocol::SOCKS5 => self.proxy_socks5 = proxy.url,
                }
            }
        }
    }

    fn save_proxy(&mut self) -> Result<()> {
        let mut proxies = Vec::new();
        if !self.proxy_http.is_empty() {
            proxies.push(Proxy::new(self.proxy_http.clone(), Protocol::HTTP));
        }
        if !self.proxy_https.is_empty() {
            proxies.push(Proxy::new(self.proxy_https.clone(), Protocol::HTTPS));
        }
        if !self.proxy_ftp.is_empty() {
            proxies.push(Proxy::new(self.proxy_ftp.clone(), Protocol::FTP));
        }
        if !self.proxy_gopher.is_empty() {
            proxies.push(Proxy::new(self.proxy_gopher.clone(), Protocol::GOPHER));
        }
        if !self.proxy_socks.is_empty() {
            proxies.push(Proxy::new(self.proxy_socks.clone(), Protocol::SOCKS));
        }
        if !self.proxy_socks5.is_empty() {
            proxies.push(Proxy::new(self.proxy_socks5.clone(), Protocol::SOCKS5));
        }

        let config = ProxyConfig {
            enabled: Some(self.proxy_enabled),
            no_proxy: Some(self.proxy_no_proxy.clone()),
            proxies,
        };

        config.write().map_err(|e| anyhow::anyhow!(e))?;
        self.info_message = Some("Proxy configuration saved".to_string());
        Ok(())
    }

    fn current_list_state(&mut self) -> &mut ListState {
        match self.active_tab {
            AppTab::Connections => &mut self.connections_list_state,
            AppTab::Devices => &mut self.devices_list_state,
            AppTab::Proxy => unreachable!(),
        }
    }

    fn next(&mut self) {
        if self.active_tab == AppTab::Proxy {
            return;
        }
        if let Some(state) = &self.network_state {
            let len = match self.active_tab {
                AppTab::Connections => state.connections.len(),
                AppTab::Devices => state.devices.len(),
                AppTab::Proxy => 0,
            };
            if len == 0 {
                return;
            }
            let i = match self.current_list_state().selected() {
                Some(i) => {
                    if i >= len - 1 {
                        0
                    } else {
                        i + 1
                    }
                }
                None => 0,
            };
            self.current_list_state().select(Some(i));
        }
    }

    fn previous(&mut self) {
        if let Some(state) = &self.network_state {
            let len = match self.active_tab {
                AppTab::Connections => state.connections.len(),
                AppTab::Devices => state.devices.len(),
                AppTab::Proxy => 0,
            };
            if len == 0 {
                return;
            }
            let i = match self.current_list_state().selected() {
                Some(i) => {
                    if i == 0 {
                        len - 1
                    } else {
                        i - 1
                    }
                }
                None => 0,
            };
            self.current_list_state().select(Some(i));
        }
    }
}

fn is_dracut() -> bool {
    std::path::Path::new("/run/initramfs").exists()
}

async fn fetch_state(
    adapter: &NetworkManagerAdapter<'_>,
) -> Result<NetworkState, agama_network::NetworkAdapterError> {
    let mut state = adapter.read(StateConfig::default()).await?;
    if is_dracut() {
        state
            .connections
            .retain(|c| !matches!(c.config, ConnectionConfig::Wireless(_)));
        state.devices.retain(|d| d.type_ != DeviceType::Wireless);
    }
    Ok(state)
}

#[tokio::main]
async fn main() -> Result<()> {
    // Setup gettext
    gettextrs::setlocale(gettextrs::LocaleCategory::LcAll, "");
    gettextrs::bindtextdomain("agama", "/usr/share/locale")?;
    gettextrs::textdomain("agama")?;

    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Create app
    let mut app = App::new();

    // Try to fetch initial state
    let adapter = match NetworkManagerAdapter::from_system().await {
        Ok(adapter) => match fetch_state(&adapter).await {
            Ok(state) => {
                app.network_state = Some(state);
                Some(adapter)
            }
            Err(e) => {
                app.error_message = Some(format!("Error reading network state: {}", e));
                None
            }
        },
        Err(e) => {
            app.error_message = Some(format!("Error connecting to NetworkManager: {}", e));
            None
        }
    };

    // Run app
    let res = run_app(&mut terminal, app, adapter).await;

    // Restore terminal
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    if let Err(err) = res {
        println!("{:?}", err)
    }

    Ok(())
}

fn handle_action(app: &mut App, action: agama_network::Action) {
    if let Some(ref mut state) = app.network_state {
        match action {
            agama_network::Action::AddDevice(device) => {
                let _ = state.add_device(*device);
            }
            agama_network::Action::UpdateDevice(name, device) => {
                let _ = state.update_device(&name, *device);
            }
            agama_network::Action::RemoveDevice(name) => {
                let _ = state.remove_device(&name);
            }
            agama_network::Action::NewConnection(conn) => {
                let _ = state.add_connection(*conn);
            }
            agama_network::Action::UpdateConnection(conn, _) => {
                let _ = state.update_connection(*conn);
            }
            agama_network::Action::RemoveConnection(id) => {
                let _ = state.remove_connection(&id);
            }
            agama_network::Action::ChangeConnectionState(id, conn_state) => {
                if let Some(conn) = state.get_connection_mut(&id) {
                    conn.state = conn_state;
                }
            }
            agama_network::Action::UpdateGeneralState(general_state) => {
                state.general_state = general_state;
            }
            _ => {}
        }
    }
}

async fn run_app<B: ratatui::backend::Backend>(
    terminal: &mut Terminal<B>,
    mut app: App,
    adapter: Option<NetworkManagerAdapter<'_>>,
) -> io::Result<()> {
    let (actions_tx, mut actions_rx) = tokio::sync::mpsc::unbounded_channel();

    if let Some(ref adapter) = adapter {
        if let Some(watcher) = adapter.watcher() {
            tokio::spawn(async move {
                if let Err(e) = watcher.run(actions_tx).await {
                    tracing::error!("Watcher error: {}", e);
                }
            });
        }
    }

    let mut event_stream = EventStream::new();

    loop {
        terminal.draw(|f| ui(f, &mut app))?;

        tokio::select! {
            Some(Ok(event)) = event_stream.next() => {
                if let Event::Key(key) = event {
                    if let AppMode::EditingProxy(field) = app.mode {
                        match key.code {
                            KeyCode::Esc => {
                                app.mode = AppMode::Normal;
                            }
                            KeyCode::Tab | KeyCode::Down => {
                                app.mode = AppMode::EditingProxy(field.next());
                            }
                            KeyCode::BackTab | KeyCode::Up => {
                                app.mode = AppMode::EditingProxy(field.previous());
                            }
                            KeyCode::Char(' ') => {
                                if field == ProxyField::Enabled {
                                    app.proxy_enabled = !app.proxy_enabled;
                                }
                            }
                            KeyCode::Enter => {
                                if let Err(e) = app.save_proxy() {
                                    app.error_message = Some(format!("Error saving proxy: {}", e));
                                } else {
                                    app.mode = AppMode::Normal;
                                }
                            }
                            KeyCode::Char(c) => {
                                match field {
                                    ProxyField::Http => app.proxy_http.push(c),
                                    ProxyField::Https => app.proxy_https.push(c),
                                    ProxyField::Ftp => app.proxy_ftp.push(c),
                                    ProxyField::Gopher => app.proxy_gopher.push(c),
                                    ProxyField::Socks => app.proxy_socks.push(c),
                                    ProxyField::Socks5 => app.proxy_socks5.push(c),
                                    ProxyField::NoProxy => app.proxy_no_proxy.push(c),
                                    _ => {}
                                }
                            }
                            KeyCode::Backspace => {
                                match field {
                                    ProxyField::Http => { app.proxy_http.pop(); }
                                    ProxyField::Https => { app.proxy_https.pop(); }
                                    ProxyField::Ftp => { app.proxy_ftp.pop(); }
                                    ProxyField::Gopher => { app.proxy_gopher.pop(); }
                                    ProxyField::Socks => { app.proxy_socks.pop(); }
                                    ProxyField::Socks5 => { app.proxy_socks5.pop(); }
                                    ProxyField::NoProxy => { app.proxy_no_proxy.pop(); }
                                    _ => {}
                                }
                            }
                            _ => {}
                        }
                        continue;
                    }

                    if let AppMode::SelectingType(ref mut list_state) = app.mode {
                        let types = vec![
                            DeviceType::Ethernet,
                            DeviceType::Wireless,
                            DeviceType::Bond,
                            DeviceType::Bridge,
                            DeviceType::Vlan,
                        ];
                        match key.code {
                            KeyCode::Esc => {
                                app.mode = AppMode::Normal;
                            }
                            KeyCode::Up => {
                                let i = match list_state.selected() {
                                    Some(i) => {
                                        if i == 0 {
                                            types.len() - 1
                                        } else {
                                            i - 1
                                        }
                                    }
                                    None => 0,
                                };
                                list_state.select(Some(i));
                            }
                            KeyCode::Down => {
                                let i = match list_state.selected() {
                                    Some(i) => {
                                        if i >= types.len() - 1 {
                                            0
                                        } else {
                                            i + 1
                                        }
                                    }
                                    None => 0,
                                };
                                list_state.select(Some(i));
                            }
                            KeyCode::Enter => {
                                if let Some(i) = list_state.selected() {
                                    let selected_type = types[i];
                                    app.edit_id = format!("{}_new", match selected_type {
                                        DeviceType::Ethernet => "eth",
                                        DeviceType::Wireless => "wlan",
                                        DeviceType::Bond => "bond",
                                        DeviceType::Bridge => "br",
                                        DeviceType::Vlan => "vlan",
                                        _ => "conn",
                                    });
                                    app.edit_type = selected_type;
                                    app.edit_interface = app.edit_id.clone();
                                    app.edit_ipv4_method = Ipv4Method::Auto;
                                    app.edit_ipv4_addresses = String::new();
                                    app.edit_ipv4_gateway = String::new();
                                    app.edit_ipv6_method = Ipv6Method::Auto;
                                    app.edit_ipv6_addresses = String::new();
                                    app.edit_ipv6_gateway = String::new();
                                    app.edit_nameservers = String::new();
                                    app.edit_ports = String::new();
                                    app.edit_bond_mode = agama_network::types::BondMode::RoundRobin;
                                    app.edit_bond_options = "miimon=100".to_string();
                                    app.edit_bridge_stp = true;
                                    app.edit_bridge_priority = "32768".to_string();
                                    app.edit_vlan_id = "1".to_string();
                                    app.edit_vlan_parent = String::new();
                                    app.active_edit_tab = EditTab::Common;
                                    app.mode = AppMode::EditingConnection(EditField::Id);
                                }
                            }
                            _ => {}
                        }
                        continue;
                    }

                    if let AppMode::EditingConnection(field) = app.mode {
                        // Create a temporary config to use for navigation based on edit_type
                        let config = match app.edit_type {
                            DeviceType::Bond => ConnectionConfig::Bond(Default::default()),
                            DeviceType::Bridge => ConnectionConfig::Bridge(Default::default()),
                            DeviceType::Vlan => ConnectionConfig::Vlan(Default::default()),
                            _ => ConnectionConfig::Ethernet,
                        };

                        match key.code {
                            KeyCode::Esc => {
                                app.mode = AppMode::Normal;
                            }
                            KeyCode::Tab => {
                                let (next_field, next_tab) = field.next(&config);
                                app.mode = AppMode::EditingConnection(next_field);
                                app.active_edit_tab = next_tab;
                            }
                            KeyCode::BackTab => {
                                let (prev_field, prev_tab) = field.previous(&config);
                                app.mode = AppMode::EditingConnection(prev_field);
                                app.active_edit_tab = prev_tab;
                            }
                            KeyCode::F(1) => {
                                app.active_edit_tab = EditTab::Common;
                                app.mode = AppMode::EditingConnection(EditField::Id);
                            }
                            KeyCode::F(2) => {
                                app.active_edit_tab = EditTab::Ipv4;
                                app.mode = AppMode::EditingConnection(EditField::Ipv4Method);
                            }
                            KeyCode::F(3) => {
                                app.active_edit_tab = EditTab::Ipv6;
                                app.mode = AppMode::EditingConnection(EditField::Ipv6Method);
                            }
                            KeyCode::Up => {
                                let (prev_field, prev_tab) = field.previous(&config);
                                app.mode = AppMode::EditingConnection(prev_field);
                                app.active_edit_tab = prev_tab;
                            }
                            KeyCode::Down => {
                                let (next_field, next_tab) = field.next(&config);
                                app.mode = AppMode::EditingConnection(next_field);
                                app.active_edit_tab = next_tab;
                            }
                            KeyCode::Left => {
                                app.active_edit_tab = app.active_edit_tab.previous(&config);
                                app.mode = AppMode::EditingConnection(EditField::first_in_tab(app.active_edit_tab));
                            }
                            KeyCode::Right => {
                                app.active_edit_tab = app.active_edit_tab.next(&config);
                                app.mode = AppMode::EditingConnection(EditField::first_in_tab(app.active_edit_tab));
                            }
                            KeyCode::Char(' ') => {
                                match field {
                                    EditField::Ipv4Method => {
                                        app.edit_ipv4_method = match app.edit_ipv4_method {
                                            Ipv4Method::Disabled => Ipv4Method::Auto,
                                            Ipv4Method::Auto => Ipv4Method::Manual,
                                            Ipv4Method::Manual => Ipv4Method::LinkLocal,
                                            Ipv4Method::LinkLocal => Ipv4Method::Disabled,
                                        };
                                    }
                                    EditField::Ipv6Method => {
                                        app.edit_ipv6_method = match app.edit_ipv6_method {
                                            Ipv6Method::Disabled => Ipv6Method::Auto,
                                            Ipv6Method::Auto => Ipv6Method::Manual,
                                            Ipv6Method::Manual => Ipv6Method::LinkLocal,
                                            Ipv6Method::LinkLocal => Ipv6Method::Ignore,
                                            Ipv6Method::Ignore => Ipv6Method::Dhcp,
                                            Ipv6Method::Dhcp => Ipv6Method::Disabled,
                                        };
                                    }
                                    EditField::BondMode => {
                                        app.edit_bond_mode = ((app.edit_bond_mode as u8 + 1) % 7)
                                            .try_into().unwrap_or(agama_network::types::BondMode::RoundRobin);
                                    }
                                    EditField::BridgeStp => {
                                        app.edit_bridge_stp = !app.edit_bridge_stp;
                                    }
                                    _ => {}
                                }
                            }
                            KeyCode::Enter => {
                                // Save changes
                                if let (Some(adapter), Some(state)) = (&adapter, &mut app.network_state) {
                                    // Find or create connection
                                    let conn_id = app.edit_id.trim().to_string();
                                    if conn_id.is_empty() {
                                        app.error_message = Some("Profile ID cannot be empty".to_string());
                                    } else {
                                        let mut conn = if let Some(existing) = state.get_connection(&conn_id) {
                                            existing.clone()
                                        } else {
                                            Connection::new(conn_id.clone(), app.edit_type)
                                        };

                                        conn.interface = if app.edit_interface.is_empty() {
                                            None
                                        } else {
                                            Some(app.edit_interface.clone())
                                        };
                                        conn.ip_config.method4 = app.edit_ipv4_method;
                                        conn.ip_config.method6 = app.edit_ipv6_method;
                                        
                                        // Parse IPv4 addresses
                                        conn.ip_config.addresses = app.edit_ipv4_addresses
                                            .split(',')
                                            .filter_map(|s| IpInet::from_str(s.trim()).ok())
                                            .collect();
                                        
                                        // Parse IPv6 addresses
                                        let ipv6_addrs: Vec<IpInet> = app.edit_ipv6_addresses
                                            .split(',')
                                            .filter_map(|s| IpInet::from_str(s.trim()).ok())
                                            .collect();
                                        conn.ip_config.addresses.extend(ipv6_addrs);

                                        // Parse Gateways
                                        conn.ip_config.gateway4 = IpAddr::from_str(app.edit_ipv4_gateway.trim()).ok();
                                        conn.ip_config.gateway6 = IpAddr::from_str(app.edit_ipv6_gateway.trim()).ok();

                                        // Parse Nameservers
                                        conn.ip_config.nameservers = app.edit_nameservers
                                            .split(',')
                                            .filter_map(|s| IpAddr::from_str(s.trim()).ok())
                                            .collect();

                                        // Update bond/bridge/vlan config
                                        match &mut conn.config {
                                            ConnectionConfig::Bond(bond) => {
                                                bond.mode = app.edit_bond_mode;
                                                if let Ok(opts) = agama_network::model::BondOptions::try_from(app.edit_bond_options.as_str()) {
                                                    bond.options = opts;
                                                }
                                            }
                                            ConnectionConfig::Bridge(bridge) => {
                                                bridge.stp = Some(app.edit_bridge_stp);
                                                bridge.priority = app.edit_bridge_priority.trim().parse().ok();
                                            }
                                            ConnectionConfig::Vlan(vlan) => {
                                                vlan.id = app.edit_vlan_id.trim().parse().unwrap_or(0);
                                                vlan.parent = app.edit_vlan_parent.trim().to_string();
                                            }
                                            _ => {}
                                        }

                                        conn.set_up();

                                        // Update or add to state
                                        let mut new_state = state.clone();
                                        let res = if new_state.get_connection(&conn_id).is_some() {
                                            new_state.update_connection(conn.clone())
                                        } else {
                                            new_state.add_connection(conn.clone())
                                        };

                                        match res {
                                            Ok(_) => {
                                                // Handle ports if bond/bridge
                                                if matches!(app.edit_type, DeviceType::Bond | DeviceType::Bridge) {
                                                    let ports: Vec<String> = app.edit_ports
                                                        .split(',')
                                                        .map(|s| s.trim().to_string())
                                                        .filter(|s| !s.is_empty())
                                                        .collect();
                                                    if let Err(e) = new_state.set_ports(&conn, ports) {
                                                        app.error_message = Some(format!("Error setting ports: {}", e));
                                                    }
                                                }

                                                match adapter.write(&new_state).await {
                                                    Ok(_) => {
                                                        app.info_message = Some(format!("Saved connection {}", conn_id));
                                                        // Refresh state
                                                        if let Ok(refreshed_state) = fetch_state(adapter).await {
                                                            app.network_state = Some(refreshed_state);
                                                        }
                                                        app.mode = AppMode::Normal;
                                                    }
                                                    Err(e) => {
                                                        app.error_message = Some(format!("Error writing configuration: {}", e))
                                                    }
                                                }
                                            }
                                            Err(e) => {
                                                app.error_message = Some(format!("Error updating state: {}", e))
                                            }
                                        }
                                    }
                                } else {
                                    app.mode = AppMode::Normal;
                                }
                            }
                            KeyCode::Char(c) => {
                                match field {
                                    EditField::Id => app.edit_id.push(c),
                                    EditField::Interface => app.edit_interface.push(c),
                                    EditField::Ipv4Addresses => app.edit_ipv4_addresses.push(c),
                                    EditField::Ipv4Gateway => app.edit_ipv4_gateway.push(c),
                                    EditField::Ipv6Addresses => app.edit_ipv6_addresses.push(c),
                                    EditField::Ipv6Gateway => app.edit_ipv6_gateway.push(c),
                                    EditField::Nameservers => app.edit_nameservers.push(c),
                                    EditField::Ports => app.edit_ports.push(c),
                                    EditField::BondOptions => app.edit_bond_options.push(c),
                                    EditField::BridgePriority => app.edit_bridge_priority.push(c),
                                    EditField::VlanId => app.edit_vlan_id.push(c),
                                    EditField::VlanParent => app.edit_vlan_parent.push(c),
                                    _ => {}
                                }
                            }
                            KeyCode::Backspace => {
                                match field {
                                    EditField::Id => { app.edit_id.pop(); }
                                    EditField::Interface => { app.edit_interface.pop(); }
                                    EditField::Ipv4Addresses => { app.edit_ipv4_addresses.pop(); }
                                    EditField::Ipv4Gateway => { app.edit_ipv4_gateway.pop(); }
                                    EditField::Ipv6Addresses => { app.edit_ipv6_addresses.pop(); }
                                    EditField::Ipv6Gateway => { app.edit_ipv6_gateway.pop(); }
                                    EditField::Nameservers => { app.edit_nameservers.pop(); }
                                    EditField::Ports => { app.edit_ports.pop(); }
                                    EditField::BondOptions => { app.edit_bond_options.pop(); }
                                    EditField::BridgePriority => { app.edit_bridge_priority.pop(); }
                                    EditField::VlanId => { app.edit_vlan_id.pop(); }
                                    EditField::VlanParent => { app.edit_vlan_parent.pop(); }
                                    _ => {}
                                }
                            }
                            _ => {}
                        }
                        continue;
                    }

                    match key.code {
                        KeyCode::Char('q') => return Ok(()),
                        KeyCode::Tab | KeyCode::Right => {
                            app.active_tab = app.active_tab.next();
                        }
                        KeyCode::Left => {
                            app.active_tab = app.active_tab.previous();
                        }
                        KeyCode::Char('1') => app.active_tab = AppTab::Connections,
                        KeyCode::Char('2') => app.active_tab = AppTab::Devices,
                        KeyCode::Char('3') => app.active_tab = AppTab::Proxy,
                        KeyCode::Down => app.next(),
                        KeyCode::Up => app.previous(),
                        KeyCode::Char('n') => {
                            if app.active_tab == AppTab::Connections {
                                let mut list_state = ListState::default();
                                list_state.select(Some(0));
                                app.mode = AppMode::SelectingType(list_state);
                            }
                        }
                        KeyCode::Char('b') => {
                            if app.active_tab == AppTab::Connections {
                                app.edit_id = "bond0".to_string();
                                app.edit_type = DeviceType::Bond;
                                app.edit_interface = "bond0".to_string();
                                app.edit_ipv4_method = Ipv4Method::Auto;
                                app.edit_ipv4_addresses = String::new();
                                app.edit_ipv4_gateway = String::new();
                                app.edit_ipv6_method = Ipv6Method::Auto;
                                app.edit_ipv6_addresses = String::new();
                                app.edit_ipv6_gateway = String::new();
                                app.edit_nameservers = String::new();
                                app.edit_ports = String::new();
                                app.edit_bond_mode = agama_network::types::BondMode::RoundRobin;
                                app.edit_bond_options = "miimon=100".to_string();
                                app.active_edit_tab = EditTab::Common;
                                app.mode = AppMode::EditingConnection(EditField::Id);
                            }
                        }
                        KeyCode::Char('r') => {
                            if app.active_tab == AppTab::Connections {
                                app.edit_id = "br0".to_string();
                                app.edit_type = DeviceType::Bridge;
                                app.edit_interface = "br0".to_string();
                                app.edit_ipv4_method = Ipv4Method::Auto;
                                app.edit_ipv4_addresses = String::new();
                                app.edit_ipv4_gateway = String::new();
                                app.edit_ipv6_method = Ipv6Method::Auto;
                                app.edit_ipv6_addresses = String::new();
                                app.edit_ipv6_gateway = String::new();
                                app.edit_nameservers = String::new();
                                app.edit_ports = String::new();
                                app.edit_bridge_stp = true;
                                app.edit_bridge_priority = "32768".to_string();
                                app.active_edit_tab = EditTab::Common;
                                app.mode = AppMode::EditingConnection(EditField::Id);
                            }
                        }
                        KeyCode::Char('e') => {
                            if app.active_tab == AppTab::Proxy {
                                app.mode = AppMode::EditingProxy(ProxyField::Enabled);
                            } else if app.active_tab == AppTab::Connections {
                                if let Some(state) = &app.network_state {
                                    if let Some(selected_index) = app.connections_list_state.selected() {
                                        if let Some(conn) = state.connections.get(selected_index) {
                                            app.edit_id = conn.id.clone();
                                            // Wait, ConnectionConfig doesn't easily convert to DeviceType without a helper
                                            app.edit_type = match &conn.config {
                                                ConnectionConfig::Ethernet => DeviceType::Ethernet,
                                                ConnectionConfig::Wireless(_) => DeviceType::Wireless,
                                                ConnectionConfig::Loopback => DeviceType::Loopback,
                                                ConnectionConfig::Dummy => DeviceType::Dummy,
                                                ConnectionConfig::Bond(_) => DeviceType::Bond,
                                                ConnectionConfig::Vlan(_) => DeviceType::Vlan,
                                                ConnectionConfig::Bridge(_) => DeviceType::Bridge,
                                                _ => DeviceType::Ethernet,
                                            };
                                            app.edit_interface =
                                                conn.interface.as_deref().unwrap_or("").to_string();
                                            app.edit_ipv4_method = conn.ip_config.method4;
                                            app.edit_ipv4_addresses = conn.ip_config.addresses
                                                .iter()
                                                .filter(|a| a.address().is_ipv4())
                                                .map(|a| a.to_string())
                                                .collect::<Vec<_>>()
                                                .join(", ");
                                            app.edit_ipv4_gateway = conn.ip_config.gateway4.map(|a| a.to_string()).unwrap_or_default();
                                            app.edit_ipv6_method = conn.ip_config.method6;
                                            app.edit_ipv6_addresses = conn.ip_config.addresses
                                                .iter()
                                                .filter(|a| a.address().is_ipv6())
                                                .map(|a| a.to_string())
                                                .collect::<Vec<_>>()
                                                .join(", ");
                                            app.edit_ipv6_gateway = conn.ip_config.gateway6.map(|a| a.to_string()).unwrap_or_default();
                                            app.edit_nameservers = conn.ip_config.nameservers
                                                .iter()
                                                .map(|a| a.to_string())
                                                .collect::<Vec<_>>()
                                                .join(", ");
                                            
                                            // Load ports
                                            app.edit_ports = state.connections.iter()
                                                .filter(|c| c.controller == Some(conn.uuid))
                                                .map(|c| c.interface.as_deref().unwrap_or(&c.id).to_string())
                                                .collect::<Vec<_>>()
                                                .join(", ");

                                            // Load bond/bridge/vlan config
                                            match &conn.config {
                                                ConnectionConfig::Bond(bond) => {
                                                    app.edit_bond_mode = bond.mode;
                                                    app.edit_bond_options = bond.options.to_string();
                                                }
                                                ConnectionConfig::Bridge(bridge) => {
                                                    app.edit_bridge_stp = bridge.stp.unwrap_or(false);
                                                    app.edit_bridge_priority = bridge.priority.map(|p| p.to_string()).unwrap_or_default();
                                                }
                                                ConnectionConfig::Vlan(vlan) => {
                                                    app.edit_vlan_id = vlan.id.to_string();
                                                    app.edit_vlan_parent = vlan.parent.clone();
                                                }
                                                _ => {}
                                            }

                                            app.active_edit_tab = EditTab::Common;
                                            app.mode = AppMode::EditingConnection(EditField::Interface);
                                        }
                                    }
                                }
                            }
                        }
                        KeyCode::Char('d') => {
                            if app.active_tab == AppTab::Connections {
                                if let (Some(adapter), Some(state)) = (&adapter, &mut app.network_state)
                                {
                                    if let Some(selected_index) = app.connections_list_state.selected() {
                                        if selected_index < state.connections.len() {
                                            let conn_id = state.connections[selected_index].id.clone();
                                            state.connections[selected_index].remove();
                                            match adapter.write(state).await {
                                                Ok(_) => {
                                                    state.connections.remove(selected_index);
                                                    app.info_message =
                                                        Some(format!("Deleted connection {}", conn_id));
                                                    // Refresh state
                                                    if let Ok(refreshed_state) =
                                                        fetch_state(adapter).await
                                                    {
                                                        app.network_state = Some(refreshed_state);
                                                    }
                                                    // Reset selection if out of bounds
                                                    if let Some(s) =
                                                        app.connections_list_state.selected()
                                                    {
                                                        if let Some(state) = &app.network_state {
                                                            if s >= state.connections.len()
                                                                && !state.connections.is_empty()
                                                            {
                                                                app.connections_list_state
                                                                    .select(Some(
                                                                        state.connections.len() - 1,
                                                                    ));
                                                            } else if state.connections.is_empty() {
                                                                app.connections_list_state.select(None);
                                                            }
                                                        }
                                                    }
                                                }
                                                Err(e) => {
                                                    app.error_message = Some(format!(
                                                        "Error deleting connection: {}",
                                                        e
                                                    ))
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        KeyCode::Char('c') => {
                            if app.active_tab == AppTab::Devices {
                                if let (Some(adapter), Some(state)) = (&adapter, &mut app.network_state)
                                {
                                    if let Some(selected_index) = app.devices_list_state.selected() {
                                        if let Some(device) = state.devices.get(selected_index) {
                                            app.info_message = Some(format!(
                                                "Configuring DHCP for {}...",
                                                device.name
                                            ));

                                            // Create a new connection for DHCP
                                            let mut conn =
                                                Connection::new(device.name.clone(), device.type_);
                                            conn.interface = Some(device.name.clone());
                                            conn.ip_config.method4 = Ipv4Method::Auto;
                                            conn.set_up();

                                            // Add connection to state and write it
                                            let mut new_state = state.clone();
                                            if let Err(e) = new_state.add_connection(conn) {
                                                // If it already exists, update it
                                                // (In a real app we'd find the existing one)
                                                app.error_message =
                                                    Some(format!("Failed to add connection: {}", e));
                                            } else {
                                                match adapter.write(&new_state).await {
                                                    Ok(_) => {
                                                        app.info_message = Some(format!(
                                                            "DHCP configured for {}",
                                                            device.name
                                                        ));
                                                        // Refresh state
                                                        if let Ok(refreshed_state) =
                                                            fetch_state(adapter).await
                                                        {
                                                            app.network_state = Some(refreshed_state);
                                                        }
                                                    }
                                                    Err(e) => {
                                                        app.error_message = Some(format!(
                                                            "Error writing configuration: {}",
                                                            e
                                                        ))
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
            Some(action) = actions_rx.recv() => {
                handle_action(&mut app, action);
            }
        }
    }
}

fn ui(f: &mut ratatui::Frame, app: &mut App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(1)
        .constraints(
            [
                Constraint::Length(3),
                Constraint::Length(3),
                Constraint::Min(0),
                Constraint::Length(3),
                Constraint::Length(3),
            ]
            .as_ref(),
        )
        .split(f.area());

    let title = Paragraph::new("Agama Network Configuration (TUI)")
        .block(Block::default().borders(Borders::ALL));
    f.render_widget(title, chunks[0]);

    let titles = vec!["(1) Connections", "(2) Devices", "(3) Proxy"];
    let tabs = Tabs::new(titles)
        .block(Block::default().borders(Borders::ALL).title("Tabs"))
        .select(app.active_tab.to_index())
        .style(Style::default().fg(Color::Cyan))
        .highlight_style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        );
    f.render_widget(tabs, chunks[1]);

    if let Some(error) = &app.error_message {
        let error_para = Paragraph::new(error.as_str()).block(
            Block::default()
                .borders(Borders::ALL)
                .title("Error")
                .style(Style::default().fg(Color::Red)),
        );
        f.render_widget(error_para, chunks[2]);
    } else if let Some(state) = &app.network_state {
        if let AppMode::SelectingType(ref mut list_state) = app.mode {
            let types = vec![
                "Ethernet",
                "Wireless",
                "Bond",
                "Bridge",
                "Vlan",
            ];
            let items: Vec<ListItem> = types.iter().map(|t| ListItem::new(*t)).collect();
            let list = List::new(items)
                .block(Block::default().borders(Borders::ALL).title("Select Connection Type"))
                .highlight_style(
                    Style::default()
                        .add_modifier(Modifier::BOLD)
                        .bg(Color::Blue),
                )
                .highlight_symbol(">> ");
            
            let area = Layout::default()
                .direction(Direction::Vertical)
                .constraints([Constraint::Percentage(30), Constraint::Percentage(40), Constraint::Percentage(30)].as_ref())
                .split(chunks[2])[1];
            let area = Layout::default()
                .direction(Direction::Horizontal)
                .constraints([Constraint::Percentage(30), Constraint::Percentage(40), Constraint::Percentage(30)].as_ref())
                .split(area)[1];

            f.render_stateful_widget(list, area, list_state);
        } else if let AppMode::EditingProxy(current_field) = app.mode {
            let edit_block = Block::default()
                .borders(Borders::ALL)
                .title("Edit Proxy Configuration");
            
            let inner_chunks = Layout::default()
                .direction(Direction::Vertical)
                .margin(1)
                .constraints([
                    Constraint::Length(3), // Enabled
                    Constraint::Length(3), // HTTP
                    Constraint::Length(3), // HTTPS
                    Constraint::Length(3), // FTP
                    Constraint::Length(3), // Gopher
                    Constraint::Length(3), // Socks
                    Constraint::Length(3), // Socks5
                    Constraint::Length(3), // No Proxy
                    Constraint::Min(0),    // Instructions
                ].as_ref())
                .split(chunks[2]);

            let enabled_input = Paragraph::new(if app.proxy_enabled { "Yes" } else { "No" })
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("Proxy Enabled (Space to toggle)")
                    .border_style(if current_field == ProxyField::Enabled { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(enabled_input, inner_chunks[0]);

            let http_input = Paragraph::new(app.proxy_http.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("HTTP Proxy URL")
                    .border_style(if current_field == ProxyField::Http { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(http_input, inner_chunks[1]);

            let https_input = Paragraph::new(app.proxy_https.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("HTTPS Proxy URL")
                    .border_style(if current_field == ProxyField::Https { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(https_input, inner_chunks[2]);

            let ftp_input = Paragraph::new(app.proxy_ftp.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("FTP Proxy URL")
                    .border_style(if current_field == ProxyField::Ftp { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(ftp_input, inner_chunks[3]);

            let gopher_input = Paragraph::new(app.proxy_gopher.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("Gopher Proxy URL")
                    .border_style(if current_field == ProxyField::Gopher { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(gopher_input, inner_chunks[4]);

            let socks_input = Paragraph::new(app.proxy_socks.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("Socks Proxy URL")
                    .border_style(if current_field == ProxyField::Socks { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(socks_input, inner_chunks[5]);

            let socks5_input = Paragraph::new(app.proxy_socks5.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("Socks5 Proxy URL")
                    .border_style(if current_field == ProxyField::Socks5 { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(socks5_input, inner_chunks[6]);

            let no_proxy_input = Paragraph::new(app.proxy_no_proxy.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("No Proxy (comma separated domains)")
                    .border_style(if current_field == ProxyField::NoProxy { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(no_proxy_input, inner_chunks[7]);

            let instructions = Paragraph::new("Tab/Arrows: next field, Space: toggle, Enter: Save, Esc: Cancel.")
                .style(Style::default().fg(Color::Yellow));
            f.render_widget(instructions, inner_chunks[8]);
            
            f.render_widget(edit_block, chunks[2]);
        } else if let AppMode::EditingConnection(current_field) = app.mode {
            let edit_block = Block::default()
                .borders(Borders::ALL)
                .title("Edit Connection");
            
            // Create a temporary config to use for layout based on edit_type
            let config = match app.edit_type {
                DeviceType::Bond => ConnectionConfig::Bond(Default::default()),
                DeviceType::Bridge => ConnectionConfig::Bridge(Default::default()),
                DeviceType::Vlan => ConnectionConfig::Vlan(Default::default()),
                _ => ConnectionConfig::Ethernet,
            };

            let edit_chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints([Constraint::Length(3), Constraint::Min(0)].as_ref())
                .split(chunks[2]);

            let type_name = match app.edit_type {
                DeviceType::Ethernet => "Ethernet",
                DeviceType::Wireless => "Wireless",
                DeviceType::Bond => "Bond",
                DeviceType::Bridge => "Bridge",
                DeviceType::Vlan => "VLAN",
                DeviceType::Loopback => "Loopback",
                DeviceType::Dummy => "Dummy",
            };
            let titles = vec![type_name, "IPv4", "IPv6"];

            let tabs = Tabs::new(titles)
                .block(Block::default().borders(Borders::ALL).title("Edit Tabs"))
                .select(app.active_edit_tab.to_index())
                .style(Style::default().fg(Color::Cyan))
                .highlight_style(
                    Style::default()
                        .fg(Color::Yellow)
                        .add_modifier(Modifier::BOLD),
                );
            f.render_widget(tabs, edit_chunks[0]);

            let mut constraints = match app.active_edit_tab {
                EditTab::Common => {
                    let mut c = vec![
                        Constraint::Length(3), // ID
                        Constraint::Length(3), // Interface
                        Constraint::Length(3), // Nameservers
                    ];
                    match config {
                        ConnectionConfig::Bond(_) => {
                            c.push(Constraint::Length(3)); // Ports
                            c.push(Constraint::Length(3)); // Bond Mode
                            c.push(Constraint::Length(3)); // Bond Options
                        }
                        ConnectionConfig::Bridge(_) => {
                            c.push(Constraint::Length(3)); // Ports
                            c.push(Constraint::Length(3)); // Bridge STP
                            c.push(Constraint::Length(3)); // Bridge Priority
                        }
                        ConnectionConfig::Vlan(_) => {
                            c.push(Constraint::Length(3)); // VLAN ID
                            c.push(Constraint::Length(3)); // VLAN Parent
                        }
                        _ => {}
                    }
                    c
                }
                EditTab::Ipv4 => {
                    vec![
                        Constraint::Length(3), // IPv4 Method
                        Constraint::Length(3), // IPv4 Addresses
                        Constraint::Length(3), // IPv4 Gateway
                    ]
                }
                EditTab::Ipv6 => {
                    vec![
                        Constraint::Length(3), // IPv6 Method
                        Constraint::Length(3), // IPv6 Addresses
                        Constraint::Length(3), // IPv6 Gateway
                    ]
                }
            };
            constraints.push(Constraint::Min(0)); // Instructions

            let inner_chunks = Layout::default()
                .direction(Direction::Vertical)
                .margin(1)
                .constraints(constraints)
                .split(edit_chunks[1]);

            let mut chunk_idx = 0;

            match app.active_edit_tab {
                EditTab::Common => {
                    let id_input = Paragraph::new(app.edit_id.as_str())
                        .block(Block::default()
                            .borders(Borders::ALL)
                            .title("Profile ID")
                            .border_style(if current_field == EditField::Id { Style::default().fg(Color::Yellow) } else { Style::default() }));
                    f.render_widget(id_input, inner_chunks[chunk_idx]);
                    chunk_idx += 1;

                    let interface_input = Paragraph::new(app.edit_interface.as_str())
                        .block(Block::default()
                            .borders(Borders::ALL)
                            .title("Interface")
                            .border_style(if current_field == EditField::Interface { Style::default().fg(Color::Yellow) } else { Style::default() }));
                    f.render_widget(interface_input, inner_chunks[chunk_idx]);
                    chunk_idx += 1;

                    let nameservers_input = Paragraph::new(app.edit_nameservers.as_str())
                        .block(Block::default()
                            .borders(Borders::ALL)
                            .title("Nameservers (comma separated, e.g. 8.8.8.8, 1.1.1.1)")
                            .border_style(if current_field == EditField::Nameservers { Style::default().fg(Color::Yellow) } else { Style::default() }));
                    f.render_widget(nameservers_input, inner_chunks[chunk_idx]);
                    chunk_idx += 1;

                    match config {
                        ConnectionConfig::Bond(_) => {
                            let ports_input = Paragraph::new(app.edit_ports.as_str())
                                .block(Block::default()
                                    .borders(Borders::ALL)
                                    .title("Ports (comma separated interface names or profile IDs)")
                                    .border_style(if current_field == EditField::Ports { Style::default().fg(Color::Yellow) } else { Style::default() }));
                            f.render_widget(ports_input, inner_chunks[chunk_idx]);
                            chunk_idx += 1;

                            let bond_mode_input = Paragraph::new(app.edit_bond_mode.to_string())
                                .block(Block::default()
                                    .borders(Borders::ALL)
                                    .title("Bond Mode (Space to change)")
                                    .border_style(if current_field == EditField::BondMode { Style::default().fg(Color::Yellow) } else { Style::default() }));
                            f.render_widget(bond_mode_input, inner_chunks[chunk_idx]);
                            chunk_idx += 1;

                            let bond_options_input = Paragraph::new(app.edit_bond_options.as_str())
                                .block(Block::default()
                                    .borders(Borders::ALL)
                                    .title("Bond Options (e.g. miimon=100)")
                                    .border_style(if current_field == EditField::BondOptions { Style::default().fg(Color::Yellow) } else { Style::default() }));
                            f.render_widget(bond_options_input, inner_chunks[chunk_idx]);
                            chunk_idx += 1;
                        }
                        ConnectionConfig::Bridge(_) => {
                            let ports_input = Paragraph::new(app.edit_ports.as_str())
                                .block(Block::default()
                                    .borders(Borders::ALL)
                                    .title("Ports (comma separated interface names or profile IDs)")
                                    .border_style(if current_field == EditField::Ports { Style::default().fg(Color::Yellow) } else { Style::default() }));
                            f.render_widget(ports_input, inner_chunks[chunk_idx]);
                            chunk_idx += 1;

                            let bridge_stp_input = Paragraph::new(if app.edit_bridge_stp { "Yes" } else { "No" })
                                .block(Block::default()
                                    .borders(Borders::ALL)
                                    .title("Bridge STP (Space to toggle)")
                                    .border_style(if current_field == EditField::BridgeStp { Style::default().fg(Color::Yellow) } else { Style::default() }));
                            f.render_widget(bridge_stp_input, inner_chunks[chunk_idx]);
                            chunk_idx += 1;

                            let bridge_priority_input = Paragraph::new(app.edit_bridge_priority.as_str())
                                .block(Block::default()
                                    .borders(Borders::ALL)
                                    .title("Bridge Priority (0-65535)")
                                    .border_style(if current_field == EditField::BridgePriority { Style::default().fg(Color::Yellow) } else { Style::default() }));
                            f.render_widget(bridge_priority_input, inner_chunks[chunk_idx]);
                            chunk_idx += 1;
                        }
                        ConnectionConfig::Vlan(_) => {
                            let vlan_id_input = Paragraph::new(app.edit_vlan_id.as_str())
                                .block(Block::default()
                                    .borders(Borders::ALL)
                                    .title("VLAN ID (0-4094)")
                                    .border_style(if current_field == EditField::VlanId { Style::default().fg(Color::Yellow) } else { Style::default() }));
                            f.render_widget(vlan_id_input, inner_chunks[chunk_idx]);
                            chunk_idx += 1;

                            let vlan_parent_input = Paragraph::new(app.edit_vlan_parent.as_str())
                                .block(Block::default()
                                    .borders(Borders::ALL)
                                    .title("Parent Interface (e.g. eth0)")
                                    .border_style(if current_field == EditField::VlanParent { Style::default().fg(Color::Yellow) } else { Style::default() }));
                            f.render_widget(vlan_parent_input, inner_chunks[chunk_idx]);
                            chunk_idx += 1;
                        }
                        _ => {}
                    }
                }
                EditTab::Ipv4 => {
                    let ipv4_method_input = Paragraph::new(app.edit_ipv4_method.to_string())
                        .block(Block::default()
                            .borders(Borders::ALL)
                            .title("IPv4 Method (Space to change)")
                            .border_style(if current_field == EditField::Ipv4Method { Style::default().fg(Color::Yellow) } else { Style::default() }));
                    f.render_widget(ipv4_method_input, inner_chunks[chunk_idx]);
                    chunk_idx += 1;

                    let ipv4_addresses_input = Paragraph::new(app.edit_ipv4_addresses.as_str())
                        .block(Block::default()
                            .borders(Borders::ALL)
                            .title("IPv4 Addresses (comma separated, e.g. 192.168.1.10/24)")
                            .border_style(if current_field == EditField::Ipv4Addresses { Style::default().fg(Color::Yellow) } else { Style::default() }));
                    f.render_widget(ipv4_addresses_input, inner_chunks[chunk_idx]);
                    chunk_idx += 1;

                    let ipv4_gateway_input = Paragraph::new(app.edit_ipv4_gateway.as_str())
                        .block(Block::default()
                            .borders(Borders::ALL)
                            .title("IPv4 Gateway (e.g. 192.168.1.1)")
                            .border_style(if current_field == EditField::Ipv4Gateway { Style::default().fg(Color::Yellow) } else { Style::default() }));
                    f.render_widget(ipv4_gateway_input, inner_chunks[chunk_idx]);
                    chunk_idx += 1;
                }
                EditTab::Ipv6 => {
                    let ipv6_method_input = Paragraph::new(app.edit_ipv6_method.to_string())
                        .block(Block::default()
                            .borders(Borders::ALL)
                            .title("IPv6 Method (Space to change)")
                            .border_style(if current_field == EditField::Ipv6Method { Style::default().fg(Color::Yellow) } else { Style::default() }));
                    f.render_widget(ipv6_method_input, inner_chunks[chunk_idx]);
                    chunk_idx += 1;

                    let ipv6_addresses_input = Paragraph::new(app.edit_ipv6_addresses.as_str())
                        .block(Block::default()
                            .borders(Borders::ALL)
                            .title("IPv6 Addresses (comma separated, e.g. 2001:db8::1/64)")
                            .border_style(if current_field == EditField::Ipv6Addresses { Style::default().fg(Color::Yellow) } else { Style::default() }));
                    f.render_widget(ipv6_addresses_input, inner_chunks[chunk_idx]);
                    chunk_idx += 1;

                    let ipv6_gateway_input = Paragraph::new(app.edit_ipv6_gateway.as_str())
                        .block(Block::default()
                            .borders(Borders::ALL)
                            .title("IPv6 Gateway (e.g. 2001:db8::1)")
                            .border_style(if current_field == EditField::Ipv6Gateway { Style::default().fg(Color::Yellow) } else { Style::default() }));
                    f.render_widget(ipv6_gateway_input, inner_chunks[chunk_idx]);
                    chunk_idx += 1;
                }
            }

            let instructions = Paragraph::new("Tab: next field, BackTab: previous field, F1-F3: switch edit tabs, Enter: Save, Esc: Cancel.")
                .style(Style::default().fg(Color::Yellow));
            f.render_widget(instructions, inner_chunks[chunk_idx]);
            
            f.render_widget(edit_block, chunks[2]);
        } else {
            let list_chunks = Layout::default()
                .direction(Direction::Horizontal)
                .constraints([Constraint::Percentage(40), Constraint::Percentage(60)].as_ref())
                .split(chunks[2]);

            match app.active_tab {
                AppTab::Connections => {
                    let items: Vec<ListItem> = state
                        .connections
                        .iter()
                        .map(|c| ListItem::new(c.id.clone()))
                        .collect();
                    let list = List::new(items)
                        .block(Block::default().borders(Borders::ALL).title("Connections"))
                        .highlight_style(
                            Style::default()
                                .add_modifier(Modifier::BOLD)
                                .bg(Color::Blue),
                        )
                        .highlight_symbol(">> ");
                    f.render_stateful_widget(list, list_chunks[0], &mut app.connections_list_state);

                    // Details
                    if let Some(selected_index) = app.connections_list_state.selected() {
                        if let Some(conn) = state.connections.get(selected_index) {
                            let mut details = vec![
                                format!("ID: {}", conn.id),
                                format!("UUID: {:?}", conn.uuid),
                                format!("Interface: {}", conn.interface.as_deref().unwrap_or("none")),
                                format!("IPv4 Method: {}", conn.ip_config.method4),
                                format!("IPv4 Gateway: {:?}", conn.ip_config.gateway4),
                                format!("IPv6 Method: {}", conn.ip_config.method6),
                                format!("IPv6 Gateway: {:?}", conn.ip_config.gateway6),
                                format!("Addresses: {:?}", conn.ip_config.addresses),
                                format!("Nameservers: {:?}", conn.ip_config.nameservers),
                            ];

                            // Add config-specific details
                            match &conn.config {
                                ConnectionConfig::Bond(bond) => {
                                    details.push(format!("Bond Mode: {}", bond.mode));
                                    details.push(format!("Bond Options: {}", bond.options));
                                }
                                ConnectionConfig::Bridge(bridge) => {
                                    details.push(format!("Bridge STP: {:?}", bridge.stp));
                                    details.push(format!("Bridge Priority: {:?}", bridge.priority));
                                }
                                ConnectionConfig::Vlan(vlan) => {
                                    details.push(format!("VLAN ID: {}", vlan.id));
                                    details.push(format!("VLAN Parent: {}", vlan.parent));
                                }
                                _ => {}
                            }

                            // Show ports for controllers
                            let ports: Vec<String> = state.connections.iter()
                                .filter(|c| c.controller == Some(conn.uuid))
                                .map(|c| c.interface.as_deref().unwrap_or(&c.id).to_string())
                                .collect();
                            if !ports.is_empty() {
                                details.push(format!("Ports: {}", ports.join(", ")));
                            }

                            let details_para = Paragraph::new(details.join("\n"))
                                .block(Block::default().borders(Borders::ALL).title("Connection Details"));
                            f.render_widget(details_para, list_chunks[1]);
                        }
                    }
                }
                AppTab::Devices => {
                    let items: Vec<ListItem> = state
                        .devices
                        .iter()
                        .map(|d| {
                            let status = match d.state {
                                DeviceState::Connected => "Connected",
                                DeviceState::Disconnected => "Disconnected",
                                DeviceState::Connecting => "Connecting",
                                _ => "Unknown",
                            };
                            ListItem::new(format!("{}: {}", d.name, status))
                        })
                        .collect();
                    let list = List::new(items)
                        .block(Block::default().borders(Borders::ALL).title("Interfaces"))
                        .highlight_style(
                            Style::default()
                                .add_modifier(Modifier::BOLD)
                                .bg(Color::Blue),
                        )
                        .highlight_symbol(">> ");
                    f.render_stateful_widget(list, list_chunks[0], &mut app.devices_list_state);

                    // Details
                    if let Some(selected_index) = app.devices_list_state.selected() {
                        if let Some(device) = state.devices.get(selected_index) {
                            let status = match device.state {
                                DeviceState::Connected => "Connected",
                                DeviceState::Disconnected => "Disconnected",
                                DeviceState::Connecting => "Connecting",
                                _ => "Unknown",
                            };
                            let details = vec![
                                format!("Name: {}", device.name),
                                format!("Type: {:?}", device.type_),
                                format!("Status: {}", status),
                                format!("IPv4: {:?}", device.ip_config),
                            ];
                            let details_para = Paragraph::new(details.join("\n"))
                                .block(Block::default().borders(Borders::ALL).title("Interface Details"));
                            f.render_widget(details_para, list_chunks[1]);
                        }
                    }
                }
                AppTab::Proxy => {
                    let details = vec![
                        format!("Proxy Enabled: {}", if app.proxy_enabled { "Yes" } else { "No" }),
                        format!("HTTP Proxy: {}", app.proxy_http),
                        format!("HTTPS Proxy: {}", app.proxy_https),
                        format!("FTP Proxy: {}", app.proxy_ftp),
                        format!("Gopher Proxy: {}", app.proxy_gopher),
                        format!("Socks Proxy: {}", app.proxy_socks),
                        format!("Socks5 Proxy: {}", app.proxy_socks5),
                        format!("No Proxy: {}", app.proxy_no_proxy),
                    ];
                    let details_para = Paragraph::new(details.join("\n"))
                        .block(Block::default().borders(Borders::ALL).title("Proxy Settings"));
                    f.render_widget(details_para, chunks[2]);
                }
            }
        }
    } else if app.active_tab == AppTab::Proxy {
        // Render proxy configuration even if network_state is None
        if let AppMode::EditingProxy(current_field) = app.mode {
            let edit_block = Block::default()
                .borders(Borders::ALL)
                .title("Edit Proxy Configuration");
            
            let inner_chunks = Layout::default()
                .direction(Direction::Vertical)
                .margin(1)
                .constraints([
                    Constraint::Length(3), // Enabled
                    Constraint::Length(3), // HTTP
                    Constraint::Length(3), // HTTPS
                    Constraint::Length(3), // FTP
                    Constraint::Length(3), // Gopher
                    Constraint::Length(3), // Socks
                    Constraint::Length(3), // Socks5
                    Constraint::Length(3), // No Proxy
                    Constraint::Min(0),    // Instructions
                ].as_ref())
                .split(chunks[2]);

            let enabled_input = Paragraph::new(if app.proxy_enabled { "Yes" } else { "No" })
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("Proxy Enabled (Space to toggle)")
                    .border_style(if current_field == ProxyField::Enabled { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(enabled_input, inner_chunks[0]);

            let http_input = Paragraph::new(app.proxy_http.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("HTTP Proxy URL")
                    .border_style(if current_field == ProxyField::Http { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(http_input, inner_chunks[1]);

            let https_input = Paragraph::new(app.proxy_https.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("HTTPS Proxy URL")
                    .border_style(if current_field == ProxyField::Https { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(https_input, inner_chunks[2]);

            let ftp_input = Paragraph::new(app.proxy_ftp.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("FTP Proxy URL")
                    .border_style(if current_field == ProxyField::Ftp { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(ftp_input, inner_chunks[3]);

            let gopher_input = Paragraph::new(app.proxy_gopher.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("Gopher Proxy URL")
                    .border_style(if current_field == ProxyField::Gopher { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(gopher_input, inner_chunks[4]);

            let socks_input = Paragraph::new(app.proxy_socks.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("Socks Proxy URL")
                    .border_style(if current_field == ProxyField::Socks { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(socks_input, inner_chunks[5]);

            let socks5_input = Paragraph::new(app.proxy_socks5.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("Socks5 Proxy URL")
                    .border_style(if current_field == ProxyField::Socks5 { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(socks5_input, inner_chunks[6]);

            let no_proxy_input = Paragraph::new(app.proxy_no_proxy.as_str())
                .block(Block::default()
                    .borders(Borders::ALL)
                    .title("No Proxy (comma separated domains)")
                    .border_style(if current_field == ProxyField::NoProxy { Style::default().fg(Color::Yellow) } else { Style::default() }));
            f.render_widget(no_proxy_input, inner_chunks[7]);

            let instructions = Paragraph::new("Tab/Arrows: next field, Space: toggle, Enter: Save, Esc: Cancel.")
                .style(Style::default().fg(Color::Yellow));
            f.render_widget(instructions, inner_chunks[8]);
            
            f.render_widget(edit_block, chunks[2]);
        } else {
            let details = vec![
                format!("Proxy Enabled: {}", if app.proxy_enabled { "Yes" } else { "No" }),
                format!("HTTP Proxy: {}", app.proxy_http),
                format!("HTTPS Proxy: {}", app.proxy_https),
                format!("FTP Proxy: {}", app.proxy_ftp),
                format!("Gopher Proxy: {}", app.proxy_gopher),
                format!("Socks Proxy: {}", app.proxy_socks),
                format!("Socks5 Proxy: {}", app.proxy_socks5),
                format!("No Proxy: {}", app.proxy_no_proxy),
            ];
            let details_para = Paragraph::new(details.join("\n"))
                .block(Block::default().borders(Borders::ALL).title("Proxy Settings"));
            f.render_widget(details_para, chunks[2]);
        }
    } else {
        let loading = Paragraph::new("Loading...").block(Block::default().borders(Borders::ALL));
        f.render_widget(loading, chunks[2]);
    }

    if let Some(info) = &app.info_message {
        let info_para = Paragraph::new(info.as_str()).block(Block::default().borders(Borders::ALL).title("Info"));
        f.render_widget(info_para, chunks[3]);
    } else {
        let status = Paragraph::new("Ready").block(Block::default().borders(Borders::ALL).title("Status"));
        f.render_widget(status, chunks[3]);
    }

    let help = Paragraph::new("Arrows: navigate, Tab/1/2/3: switch tabs, Space: change value, 'n': new, 'e': edit, 'd': delete, 'c': DHCP (Devices), 'q': quit")
        .block(Block::default().borders(Borders::ALL));
    f.render_widget(help, chunks[4]);
}


