use std::str::FromStr;

use anyhow::Result;
use bs58;
use jsonrpc::{self, Error};
use serde::{Deserialize, Serialize};
use serde_json::{json, Number};
use solana_sdk::pubkey::Pubkey;
use strangemood;
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
struct EncodingParams {
    // "base58"
    encoding: String,
}

#[derive(Serialize, Deserialize)]
struct BlockContext {
    slot: i64,
}

#[derive(Serialize, Deserialize)]
struct AccountValue {
    data: [String; 2],
    executable: bool,
    lamports: i64,
    owner: String,
    rentEpoch: i64,
}

#[derive(Serialize, Deserialize)]
struct AccountInfoResponse {
    context: BlockContext,
    value: AccountValue,
}

#[derive(Serialize, Deserialize)]
struct AccountInfo<T> {
    data: T,
    executable: bool,
    lamports: i64,
    owner: Pubkey,
    rentEpoch: i64,
}

fn get_listing_info(url: &str, pubkey: Pubkey) -> Result<()> {
    let client = jsonrpc::client::Client::simple_http(url, None, None)?;

    let response = client.send_request(jsonrpc::Request {
        method: "getAccountInfo",
        params: &[
            serde_json::value::to_raw_value(&pubkey.to_string())?,
            serde_json::value::to_raw_value(&EncodingParams {
                encoding: "base58".to_string(),
            })?,
        ],
        id: json!(2),
        jsonrpc: Some("2.0"),
    })?;

    let info = match response.result {
        Some(r) => {
            let inner = r.to_string();
            serde_json::from_str::<AccountInfoResponse>(inner.as_str())?
        }
        None => return Err(anyhow::format_err!("Oh no")),
    };

    let ownerPubkey = Pubkey::from_str(info.value.owner.as_str())?;
    bs58::decode(info.value.data);

    Ok(())
}
