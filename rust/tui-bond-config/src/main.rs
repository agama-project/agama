//! ## Demo
//!
//! `Demo` shows how to use tui-realm in a real case

use agama_lib::error::ServiceError;
use agama_lib::install_settings::Scope;
use agama_lib::network::settings::NetworkConnection;
use std::time::Duration;
use tui_realm_stdlib::Label;
use tuirealm::StateValue;

use tui_realm_stdlib::Checkbox;
use tui_realm_stdlib::Input;
use tui_realm_stdlib::Select;
use tuirealm::command::{Cmd, CmdResult, Direction, Position};
use tuirealm::event::KeyModifiers;
use tuirealm::props::{Alignment, BorderType, Borders, Color, TextModifiers, TextSpan};
use tuirealm::props::{AttrValue, Attribute, InputType, PropPayload, PropValue, Style};
use tuirealm::terminal::TerminalBridge;
use tuirealm::State;
use tuirealm::{
    application::PollStrategy,
    event::{Key, KeyEvent},
    Application, Component, Event, EventListenerCfg, MockComponent, NoUserEvent, Update,
};
// tui
use tuirealm::tui::layout::{Constraint, Direction as LayoutDirection, Layout};

use agama_lib::connection;
use agama_lib::network::types::Device as NetworkDevice;
use agama_lib::network::{NetworkClient, NetworkSettings, NetworkStore};

#[derive(Debug, PartialEq)]
pub enum Msg {
    AppClose,
    BondNameBlur,
    BondMembersBlur,
    SaveChanges,
    None,
}

// Let's define the component ids for our application
#[derive(Debug, Eq, PartialEq, Clone, Hash)]
pub enum Id {
    SelectDevice,
    LabelAlfa,
    BondName,
    BondMembers,
}

struct Model {
    quit: bool,   // Becomes true when the user presses <ESC>
    redraw: bool, // Tells whether to refresh the UI; performance optimization
    app: Application<Id, Msg, NoUserEvent>,
    settings: NetworkSettings,
    connections: Vec<NetworkConnection>,
    available_devices: Vec<NetworkDevice>,
    bond_members: Vec<NetworkDevice>,
}

impl Model {
    fn default() -> Self {
        // Setup app
        let mut app: Application<Id, Msg, NoUserEvent> = Application::init(
            EventListenerCfg::default().default_input_listener(Duration::from_millis(10)),
        );
        assert!(app
            .mount(Id::BondName, Box::new(BondName::default()), vec![])
            .is_ok());

        assert!(app
            .mount(Id::BondMembers, Box::new(BondMembers::new(vec![])), vec![])
            .is_ok());

        assert!(app
            .mount(Id::LabelAlfa, Box::new(LabelAlfa::default()), vec![])
            .is_ok());

        // We need to give focus to input then
        assert!(app.active(&Id::BondName).is_ok());
        Self {
            app,
            connections: vec![],
            quit: false,
            redraw: true,
            settings: NetworkSettings::default(),
            available_devices: vec![],
            bond_members: vec![],
        }
    }
}

impl Model {
    fn view(&mut self, terminal: &mut TerminalBridge) {
        // Calc len
        let bond_name_len = match self.app.state(&Id::SelectDevice) {
            Ok(State::One(_)) => 3,
            _ => 8,
        };

        let bond_members_len = match self.app.state(&Id::BondMembers) {
            Ok(State::One(_)) => 1,
            _ => 8,
        };

        let label_len = match self.app.state(&Id::LabelAlfa) {
            Ok(State::One(_)) => 1,
            _ => 8,
        };

        let _ = terminal.raw_mut().draw(|f| {
            // Prepare chunks
            let chunks = Layout::default()
                .direction(LayoutDirection::Vertical)
                .margin(1)
                .constraints(
                    [
                        Constraint::Length(bond_name_len),
                        Constraint::Length(bond_members_len),
                        Constraint::Length(label_len),
                        Constraint::Length(1),
                    ]
                    .as_ref(),
                )
                .split(f.size());
            self.app.view(&Id::BondName, f, chunks[0]);
            self.app.view(&Id::BondMembers, f, chunks[1]);
            self.app.view(&Id::LabelAlfa, f, chunks[2]);
        });
    }

    async fn query_available_devices(&self) -> Vec<NetworkDevice> {
        let conn = connection().await.unwrap();
        let client = NetworkClient::new(conn).await.unwrap();
        client.available_devices().await.unwrap()
    }

    async fn query_settings(&self) -> NetworkSettings {
        let conn = connection().await.unwrap();
        let store = NetworkStore::new(conn).await.unwrap();
        store.load().await.unwrap()
    }

    async fn save_settings(&self) {
        let conn = connection().await.unwrap();
        let store = NetworkStore::new(conn).await.unwrap();
        store.store(&self.settings).await.unwrap();
    }

    fn device_names(&self) -> Vec<&String> {
        self.available_devices.iter().map(|x| &x.name).collect()
    }

    fn set_textarea_text(&mut self, id: &Id, lines: Vec<PropValue>) {
        assert!(self
            .app
            .attr(
                id,
                Attribute::Text,
                AttrValue::Payload(PropPayload::Vec(lines))
            )
            .is_ok());
    }

    fn set_checkbox_options(&mut self, id: &Id, items: Vec<PropValue>) {
        assert!(self
            .app
            .attr(
                id,
                Attribute::Content,
                AttrValue::Payload(PropPayload::Vec(items))
            )
            .is_ok());
    }

    fn bond_name(&self) -> String {
        self.app
            .state(&Id::BondName)
            .unwrap()
            .unwrap_one()
            .unwrap_string()
    }

    fn device_for(&self, idx: usize) -> String {
        self.available_devices[idx].name.clone()
    }

    fn bond_members(&self) -> Vec<String> {
        self.app
            .state(&Id::BondMembers)
            .unwrap()
            .unwrap_vec()
            .iter()
            .map(|f| self.device_for(f.clone().unwrap_usize()))
            .collect()
    }

    fn checkbox_items(&self, values: &Vec<&String>) -> Vec<PropValue> {
        values
            .iter()
            .map(|x| PropValue::Str(x.to_string()))
            .collect()
    }

    pub fn init(&mut self) {
        self.available_devices = futures::executor::block_on(self.query_available_devices());
        self.settings = futures::executor::block_on(self.query_settings());

        let items = self.checkbox_items(&self.device_names());
        self.set_checkbox_options(&Id::BondMembers, items);
    }
}

#[async_std::main]
async fn main() -> Result<(), ServiceError> {
    let conn = connection().await?;
    let settings = NetworkStore::new(conn).await?;
    let settings = settings.load().await?;

    let connections = settings.connections;

    let mut model = Model::default();
    model.init();
    let mut terminal = TerminalBridge::new().expect("Cannot create terminal bridge");
    let _ = terminal.enable_raw_mode();
    let _ = terminal.enter_alternate_screen();

    // Now we use the Model struct to keep track of some states

    // let's loop until quit is true
    while !model.quit {
        // Tick
        if let Ok(messages) = model.app.tick(PollStrategy::Once) {
            for msg in messages.into_iter() {
                let mut msg = Some(msg);
                while msg.is_some() {
                    msg = model.update(msg);
                }
            }
        }
        // Redraw
        if model.redraw {
            model.view(&mut terminal);
            model.redraw = false;
        }
    }
    // Terminate terminal
    let _ = terminal.leave_alternate_screen();
    let _ = terminal.disable_raw_mode();
    let _ = terminal.clear_screen();

    Ok(())
}

impl Update<Msg> for Model {
    fn update(&mut self, msg: Option<Msg>) -> Option<Msg> {
        self.redraw = true;
        match msg.unwrap_or(Msg::None) {
            Msg::AppClose => {
                self.quit = true;
                None
            }
            Msg::BondNameBlur => {
                assert!(self.app.active(&Id::BondMembers).is_ok());
                None
            }
            Msg::BondMembersBlur => {
                assert!(self.app.active(&Id::BondName).is_ok());
                None
            }
            Msg::SaveChanges => {
                println!("Saving the bond: {}", self.bond_name());
                println!("Bond members are: {}", self.bond_members().join(","));

                None
            }

            Msg::None => None,
        }
    }
}

#[derive(MockComponent)]
struct BondName {
    component: Input,
}

impl Default for BondName {
    fn default() -> Self {
        Self {
            component: Input::default()
                .borders(
                    Borders::default()
                        .modifiers(BorderType::Rounded)
                        .color(Color::LightYellow),
                )
                .foreground(Color::LightYellow)
                .input_type(InputType::Text)
                .title("Bond name", Alignment::Left)
                .value("bond0")
                .invalid_style(Style::default().fg(Color::Red)),
        }
    }
}

impl Component<Msg, NoUserEvent> for BondName {
    fn on(&mut self, ev: Event<NoUserEvent>) -> Option<Msg> {
        let _ = match ev {
            Event::Keyboard(KeyEvent {
                code: Key::Left, ..
            }) => self.perform(Cmd::Move(Direction::Left)),
            Event::Keyboard(KeyEvent {
                code: Key::Right, ..
            }) => self.perform(Cmd::Move(Direction::Right)),
            Event::Keyboard(KeyEvent {
                code: Key::Home, ..
            }) => self.perform(Cmd::GoTo(Position::Begin)),
            Event::Keyboard(KeyEvent { code: Key::End, .. }) => {
                self.perform(Cmd::GoTo(Position::End))
            }
            Event::Keyboard(KeyEvent {
                code: Key::Delete, ..
            }) => self.perform(Cmd::Cancel),
            Event::Keyboard(KeyEvent {
                code: Key::Backspace,
                ..
            }) => self.perform(Cmd::Delete),
            Event::Keyboard(KeyEvent {
                code: Key::Char('s'),
                modifiers: KeyModifiers::CONTROL,
            }) => self.perform(Cmd::Submit),
            Event::Keyboard(KeyEvent {
                code: Key::Char(ch),
                modifiers: KeyModifiers::NONE,
            }) => self.perform(Cmd::Type(ch)),
            Event::Keyboard(KeyEvent { code: Key::Tab, .. }) => return Some(Msg::BondNameBlur),
            Event::Keyboard(KeyEvent { code: Key::Esc, .. }) => return Some(Msg::AppClose),
            _ => CmdResult::None,
        };
        Some(Msg::None)
    }
}

#[derive(MockComponent)]
struct BondMembers {
    component: Checkbox,
}

impl BondMembers {
    fn new(connections: Vec<NetworkConnection>) -> Self {
        let connection_names: Vec<String> = connections.iter().map(|c| c.id.clone()).collect();

        Self {
            component: Checkbox::default()
                .borders(
                    Borders::default()
                        .modifiers(BorderType::Rounded)
                        .color(Color::LightGreen),
                )
                .foreground(Color::LightGreen)
                .background(Color::Black)
                .title("Select the bond ports", Alignment::Center)
                .rewind(true)
                .choices(&connection_names),
        }
    }
}

impl Component<Msg, NoUserEvent> for BondMembers {
    fn on(&mut self, ev: Event<NoUserEvent>) -> Option<Msg> {
        let _ = match ev {
            Event::Keyboard(KeyEvent {
                code: Key::Left, ..
            }) => self.perform(Cmd::Move(Direction::Left)),
            Event::Keyboard(KeyEvent {
                code: Key::Right, ..
            }) => self.perform(Cmd::Move(Direction::Right)),
            Event::Keyboard(KeyEvent {
                code: Key::Enter, ..
            }) => self.perform(Cmd::Submit),
            Event::Keyboard(KeyEvent {
                code: Key::Char(' '),
                ..
            }) => self.perform(Cmd::Toggle),
            Event::Keyboard(KeyEvent {
                code: Key::Char('s'),
                modifiers: KeyModifiers::CONTROL,
            }) => return Some(Msg::SaveChanges),
            Event::Keyboard(KeyEvent { code: Key::Tab, .. }) => return Some(Msg::BondMembersBlur),
            Event::Keyboard(KeyEvent { code: Key::Esc, .. }) => return Some(Msg::AppClose),
            _ => CmdResult::None,
        };
        Some(Msg::None)
    }
}

#[derive(MockComponent)]
struct LabelAlfa {
    component: Label,
}

impl Default for LabelAlfa {
    fn default() -> Self {
        Self {
            component: Label::default()
                .alignment(Alignment::Center)
                .foreground(Color::Green)
                .modifiers(TextModifiers::BOLD)
                .text("Press Ctrl + S to save or Esc to quit"),
        }
    }
}

impl Component<Msg, NoUserEvent> for LabelAlfa {
    fn on(&mut self, ev: Event<NoUserEvent>) -> Option<Msg> {
        let _ = match ev {
            Event::Keyboard(KeyEvent { code: Key::Esc, .. }) => return Some(Msg::AppClose),
            _ => CmdResult::None,
        };
        Some(Msg::None)
    }
}
