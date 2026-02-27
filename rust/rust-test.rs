#![allow(unused)]
fn main() {
    use std::process::Command;
    
    let status = Command::new("false")
        .status();
    
    match status {
        Ok(status) => {
            if status.success() {
                println!("Command executed successfully");
            } else {
                println!("Command failed: {}", status);
            }
        }
        Err(e) => {
            println!("Command failed to run: {}", e);
        }
    }
}
