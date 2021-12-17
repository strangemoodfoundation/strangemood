use serde_json;
use solana_sdk::signer::Signer;
use std::env;
use std::fs::File;
use std::io::{self, BufRead, Read};

fn main() {
    let stdin = io::stdin();
    let mut message: String = String::new();
    for line in stdin.lock().lines() {
        message.push_str(line.unwrap().as_str());
    }

    let mut args = env::args();
    let keypair_file = match args.nth(2) {
        Some(a) => a,
        None => shellexpand::tilde("~/.config/solana/id.json").to_string(),
    };

    println!("{}", keypair_file);
    let mut file = File::open(keypair_file).unwrap();
    let mut data = String::new();
    file.read_to_string(&mut data).unwrap();

    let data = serde_json::from_str::<Vec<u8>>(data.as_str()).unwrap();

    let keypair = solana_sdk::signature::Keypair::from_bytes(&data).unwrap();
    let signature = keypair.sign_message(message.clone().as_bytes());

    println!("{:?}", signature);
}
