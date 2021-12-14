use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::pubkey;
use strangemood::state::Listing;
use borsh::{BorshDeserialize};
use yaml_rust::YamlLoader;
use thiserror::Error;

/// Establishes a RPC connection with the solana cluster configured by
/// `solana config set --url <URL>`. Information about what cluster
/// has been configured is gleened from the solana config file
/// `~/.config/solana/cli/config.yml`.
pub fn establish_connection() -> Result<RpcClient> {
    let rpc_url = get_rpc_url()?;
    Ok(RpcClient::new_with_commitment(
        rpc_url,
        CommitmentConfig::confirmed(),
    ))
}

/// Pulls down the greeting account data and the value of its counter
/// which ought to track how many times the `say_hello` method has
/// been run.
pub fn get_listing_authority_pubkey(listing: &str, connection: &RpcClient) -> Result<Pubkey> {
    let listing_pubkey_res = pubkey::read_pubkey_file(listing);
    let listing_pubkey = match listing_pubkey_res {
        Ok(res) => res,
        Err(err) => return Err(Error::InvalidPubkey("".to_string())),
    };
    let listing_account = connection.get_account(&listing_pubkey)?;
    Ok(get_authority_pubkey(&listing_account.data)?)
}

/// Deserializes a greeting account and reports the value of its
/// greeting counter.
fn get_authority_pubkey(data: &[u8]) -> Result<Pubkey> {
    let decoded = Listing::try_from_slice(data).map_err(|e| Error::SerializationError(e))?;
    Ok(decoded.authority)
}

/// Gets the RPC url for the cluster that this machine is configured
/// to communicate with.
fn get_rpc_url() -> Result<String> {
    let config = get_config()?;
    match config["json_rpc_url"].as_str() {
        Some(s) => Ok(s.to_string()),
        None => Err(Error::InvalidConfig(
            "missing `json_rpc_url` field".to_string(),
        )),
    }
}

/// Parses and returns the Solana yaml config on the system.
fn get_config() -> Result<yaml_rust::Yaml> {
    let path = match home::home_dir() {
        Some(mut path) => {
            path.push(".config/solana/cli/config.yml");
            path
        }
        None => {
            return Err(Error::ConfigReadError(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "failed to locate homedir and thus can not locoate solana config",
            )));
        }
    };
    let config = std::fs::read_to_string(path).map_err(|e| Error::ConfigReadError(e))?;
    let mut config = YamlLoader::load_from_str(&config)?;
    match config.len() {
        1 => Ok(config.remove(0)),
        l => Err(Error::InvalidConfig(format!(
            "expected one yaml document got ({})",
            l
        ))),
    }
}


#[derive(Error, Debug)]
pub enum Error {
    #[error("failed to read solana config file: ({0})")]
    ConfigReadError(std::io::Error),
    #[error("failed to parse solana config file: ({0})")]
    ConfigParseError(#[from] yaml_rust::ScanError),
    #[error("invalid config: ({0})")]
    InvalidConfig(String),
    #[error("invalid public key ({0})")]
    InvalidPubkey(String),

    #[error("serialization error: ({0})")]
    SerializationError(std::io::Error),

    #[error("solana client error: ({0})")]
    ClientError(#[from] solana_client::client_error::ClientError),

    #[error("error in public key derivation: ({0})")]
    KeyDerivationError(#[from] solana_sdk::pubkey::PubkeyError),
}

pub type Result<T> = std::result::Result<T, Error>;