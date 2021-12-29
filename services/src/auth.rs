use crate::{errors::ServicesError, utils};
use serde::{Deserialize, Serialize};
use solana_sdk::{
    self,
    signature::{self, Signature},
};
use std::str::FromStr;
use worker::{console_log, Request, RouteContext};

macro_rules! SIGNATURE_MESSAGE_TEMPLATE {
    () => {
        r#"{domain} wants you to sign in with your wallet:
{user_public_address}

I accept the Strangemood Terms of Service.

URI: {uri}
Version: {version}
Nonce: {nonce}
Issued At: {issued_at}"#
    };
}

struct SignatureMessage {
    domain: String,
    uri: String,
    version: String,
}

impl SignatureMessage {
    fn get_signature_message(
        &self,
        nonce: String,
        issued_at: String,
        user_public_address: String,
    ) -> String {
        return format!(
            SIGNATURE_MESSAGE_TEMPLATE!(),
            domain = self.domain,
            user_public_address = user_public_address,
            uri = self.uri,
            version = self.version,
            nonce = nonce,
            issued_at = issued_at
        );
    }
}

pub fn get_strangemood_signature_message(
    nonce: String,
    issued_at: String,
    uri: String,
    user_public_address: String,
) -> String {
    let signature_message = SignatureMessage {
        domain: "strangemood.org".to_string(),
        uri,
        version: "0.0.0".to_string(),
    };

    return signature_message.get_signature_message(nonce, issued_at, user_public_address);
}

#[derive(Serialize, Deserialize)]
struct SignatureMessageSession {
    nonce: String,
    issued_at: String,
    scope: String,
    public_key: String,
}

pub async fn create_and_store_permission(
    public_key: String,
    scope: String,
    ctx: &RouteContext<()>,
) -> Result<String, ServicesError> {
    let nonce = utils::generate_nonce();
    let issued_at = chrono::Utc::now().to_rfc2822();

    let kv = ctx.kv("SIGNATURES").unwrap();
    kv.put(
        format!("{}/{}", public_key.as_str(), scope).as_str(),
        serde_json::to_string(&SignatureMessageSession {
            nonce: nonce.clone(),
            issued_at: issued_at.clone(),
            public_key: public_key.clone(),
            scope: scope.clone(),
        })
        .unwrap(),
    )
    .unwrap()
    .expiration_ttl(60 * 60 * 2) // Expires in 2 hours
    .execute()
    .await
    .unwrap();

    let signature_message =
        get_strangemood_signature_message(nonce, issued_at, scope, public_key.to_string());

    return Ok(signature_message);
}

pub async fn assert_permission(
    public_key: String,
    scope: String,
    req: Request,
    ctx: &RouteContext<()>,
) -> Result<(), ServicesError> {
    let auth = match req.headers().get("Authorization").unwrap() {
        Some(a) => a,
        None => {
            return Err(ServicesError::MissingHTTPHeader(
                "Authorization".to_string(),
            ))
        }
    };
    let signatures = ctx.kv("SIGNATURES").unwrap();
    let session = match signatures
        .get(format!("{}/{}", public_key.as_str(), scope.as_str()).as_str())
        .await
        .unwrap()
    {
        Some(session) => session.as_json::<SignatureMessageSession>().unwrap(),
        None => {
            console_log!(
                "No session found {:?}",
                format!("{}/{}", public_key.as_str(), scope.as_str()).as_str()
            );
            return Err(ServicesError::Unauthorized);
        }
    };

    let message = get_strangemood_signature_message(
        session.nonce,
        session.issued_at,
        session.scope,
        public_key.to_string(),
    );

    let sig = match Signature::from_str(&auth) {
        Ok(s) => s,
        Err(_) => {
            return Err(ServicesError::InvalidRequest(
                "Failed to parse Signature in Authorization Header".to_string(),
            ))
        }
    };
    if !sig.verify(
        &signature::Keypair::from_base58_string(&public_key).to_bytes(),
        message.as_bytes(),
    ) {
        return Err(ServicesError::Unauthorized);
    }

    return Ok(());
}
