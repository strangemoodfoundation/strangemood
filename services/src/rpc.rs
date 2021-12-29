use anchor_lang::AccountDeserialize;
use anyhow::Result;
use base64;
use bs58;
use jsonrpc::{self, Error};
use serde::{Deserialize, Serialize};
use serde_json::{json, Number};
use solana_sdk::pubkey::Pubkey;
use std::{borrow::BorrowMut, collections::HashMap, hash::Hasher, str::FromStr};
use strangemood;
use worker::{console_log, wasm_bindgen::JsValue, Fetch, Method, Request, RequestInit};

use crate::errors::RpcError;

#[derive(Serialize, Deserialize, Clone)]
struct EncodingParams {
    // "base58"
    pub encoding: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct BlockContext {
    slot: i64,
}

#[derive(Serialize, Deserialize, Clone)]
struct AccountValue {
    data: [String; 2],
    executable: bool,
    lamports: i64,
    owner: String,
    rentEpoch: i64,
}

#[derive(Serialize, Deserialize, Clone)]
struct AccountInfoResponse {
    context: BlockContext,
    value: AccountValue,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AccountInfo<T> {
    pub data: T,
    pub executable: bool,
    pub lamports: i64,
    pub owner: Pubkey,
    pub rent_epoch: i64,
}

#[derive(Serialize, Deserialize, Clone)]
struct JsonRPCRequest<T> {
    pub jsonrpc: String,
    pub id: i32,
    pub method: String,
    pub params: Vec<T>,
}

#[derive(Serialize, Deserialize, Clone)]
struct JsonRPCResponse<T> {
    // {"jsonrpc":"2.0", "id":1, "method":"getBalance", "params":["67pNhjgzP65WtdhFLKi3JvnsjKxnZGFA9AfRRJXdX6ii"]}
    pub jsonrpc: String,
    pub id: i32,
    pub result: T,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(untagged)]
enum AccountInfoParams {
    EncodingParams(EncodingParams),
    String(String),
}

pub async fn get_listing_info(
    url: &str,
    pubkey: Pubkey,
) -> Result<AccountInfo<strangemood::Listing>, RpcError> {
    let mut reqinit = RequestInit::new();
    reqinit.with_method(Method::Post);

    let mut headers = worker::Headers::new();
    headers
        .set("Content-Type", "application/json")
        .map_err(|e| RpcError::FailedToCreateRPCRequest(e.to_string()).into())?;
    reqinit.with_headers(headers);

    let body = JsonRPCRequest::<AccountInfoParams> {
        jsonrpc: "2.0".to_string(),
        id: 1, // TODO: use a random id
        method: "getAccountInfo".to_string(),
        params: vec![
            AccountInfoParams::String(pubkey.to_string()),
            AccountInfoParams::EncodingParams(EncodingParams {
                encoding: "base64".to_string(),
            }),
        ],
    };

    let body_as_str = serde_json::to_string_pretty(&body)
        .map_err(|e| RpcError::FailedToCreateRPCRequest(e.to_string()).into())?;
    let body_as_js_value = JsValue::from_serde(&body_as_str)
        .map_err(|e| RpcError::FailedToCreateRPCRequest(e.to_string()).into())?;

    reqinit.with_body(Some(body_as_js_value));

    let req = Request::new_with_init(url, &reqinit)
        .map_err(|e| RpcError::FailedToCreateRPCRequest(e.to_string()).into())?;

    let mut resp = worker::Fetch::send(&Fetch::Request(req))
        .await
        .map_err(|e| RpcError::FailedToCreateRPCRequest(e.to_string()).into())?;

    if resp.status_code() != 200 {
        let body = resp.text().await.unwrap();
        return Err(RpcError::FailedToCreateRPCRequest(body).into());
    }

    let as_text = resp
        .text()
        .await
        .map_err(|e| RpcError::FailedToCreateRPCRequest(e.to_string()))?;

    let response_body = serde_json::from_str::<JsonRPCResponse<AccountInfoResponse>>(
        as_text.as_str(),
    )
    .map_err(|e| {
        RpcError::RPCRequestFailed(
            format!(
                "Failed to parse response body into json\n{}\n\n{}",
                e.to_string(),
                as_text
            ),
            body_as_str,
        )
        .into()
    })?;

    let owner = response_body.result.value.owner.as_str();
    let owner_pubkey =
        Pubkey::from_str(owner).map_err(|e| RpcError::FailedToCreateRPCRequest(e.to_string()))?;

    let value = &response_body.result.value.data[0];
    let data =
        base64::decode(value).map_err(|e| RpcError::FailedToCreateRPCRequest(e.to_string()))?;
    let mut data_as_slice: &[u8] = &data;

    let listing = strangemood::Listing::try_deserialize(&mut data_as_slice)
        .map_err(|e| RpcError::FailedToCreateRPCRequest(e.to_string()))?;

    Ok(AccountInfo {
        data: listing,
        executable: response_body.result.value.executable,
        lamports: response_body.result.value.lamports,
        owner: owner_pubkey,
        rent_epoch: response_body.result.value.rentEpoch,
    })
}
