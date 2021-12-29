use std::str::FromStr;

use anchor_lang::prelude::Pubkey;
// use solana_client;
use solana_sdk::{self, signature};
use strangemood;
use worker::*;

mod auth;
mod errors;
mod omg;
mod rpc;
mod utils;

fn log_request(req: &Request) {
    console_log!(
        "{} - [{}], located at: {:?}, within: {}",
        Date::now().to_string(),
        req.path(),
        req.cf().coordinates().unwrap_or_default(),
        req.cf().region().unwrap_or("unknown region".into())
    );
}

const HELP_TEXT: &str = r#"# Strangemood Services API

This is the off-chain HTTP API for Strangemood. You can
find the code at https://github.com/strangemoodfoundation/strangemood

## Wallet-signing Auth

Strangemood uses RSA for auth. Before making a request to a Strangemood 
service, you must have the user "login" to the route you're trying to hit.

To "login", you must request a "challenge" message that should be signed by the private 
key of the user. To request a challenge, use `POST /v1/challenge/:public_key`. 

You must include the method and the path in `<METHOD> <PATH>` format as plain 
text in the body of your request.

```
# <METHOD> <PATH>
POST /v1/listings/Aeb5jFtqK6BnTZthit5DAUa3anS8dLimCR71X58Gz5bt
```

For example, here's a request for a challenge scoped to 
the `POST /v1/listings/:public_key` route.

```
curl -X POST \
  --data "POST /v1/listings/Aeb5jFtqK6BnTZthit5DAUa3anS8dLimCR71X58Gz5bt" \ 
  https://api.strangemood/v1/challenge/akSzRKB5bkrtUF2MkkPUFqmmbuPppm8dkwH9SWMULMt
```

This will return a human readable string, that a wallet should show 
to a user to sign.

```
example.com wants to sign in with your wallet:
kaVzRKB52krtUF2Mkk1UFqm1buPppm8dkwH9TWSULMn

Do you want to give 'example.com' permission 
to modify the metadata (such as application files,
photos, titles, descriptions, and so on)?

URI: https://example.com
Version: 1
Nonce: 32891756
Issued At: 2021-09-30T16:25:24Z
```

Have the user's wallet (private key) sign this message, and you will get a base58 signature like the 
following:

```
34w2ApyTyRZP3ZFe33Ko1ih8Aacl5nMo6mQBcSS5naNk9bfdBz1bzzRlfbCmsVPyGBwTgtq13168KJWKaSngUbGn
```

Include this signature as your Authorization header for every request that requires authorization.


## Posting data to a listing

```
POST /v1/listings/:listing_public_key
Authorization="34w2ApyTyRZP3ZFe33Ko1ih8Aacl5nMo6mQBcSS5naNk9bfdBz1bzzRlfbCmsVPyGBwTgtq13168KJWKaSngUbGn"
Content-Type="application/json"
{
    "version":  "0.1.0",
    "elements": [
      {
        "key": "application"
        "type": "application/octet-stream",
        "uri": "https://some-storage-layer.com/...",
      },
      {
        "key": "title"
        "type": "text/plain",
        "value": "My Game"
      },
      {
        "key": "description"
        "type": "text/markdown",
        "value": "\# My Game \n is very cool"
      },
      {
        "key": "twitter"
        "type": "text/plain",
        "value": "@mygame"
      },
    ]
  }
```


## Getting a listing's metadata

```
GET /v1/listings/:listing_public_key
```

Returns the OpenMetaGraph document:

```
{
    "version":  "0.1.0",
    "elements": [
      {
        "key": "application"
        "type": "application/octet-stream",
        "uri": "https://some-storage-layer.com/...",
      },
      {
        "key": "title"
        "type": "text/plain",
        "value": "My Game"
      },
      {
        "key": "description"
        "type": "text/markdown",
        "value": "\# My Game \n is very cool"
      },
      {
        "key": "twitter"
        "type": "text/plain",
        "value": "@mygame"
      },
    ]
}
```

--------------------------------------------------------------------------------------------

Strike the Earth! 
"#;

#[event(fetch)]
pub async fn main(req: Request, env: Env) -> Result<Response> {
    log_request(&req);

    // Optionally, get more helpful error messages written to the console in the case of a panic.
    utils::set_panic_hook();

    // if req.method() == Method::Options {
    //     console_log!("Yay love it");
    //     let mut headers = Headers::new();
    //     headers.set("Access-Control-Max-Age", "86400")?;
    //     headers.set(
    //         "Access-Control-Allow-Origin",
    //         req.headers()
    //             .get("Origin")?
    //             .unwrap_or("*".to_string())
    //             .as_str(),
    //     )?;
    //     headers.set("Access-Control-Allow-Credentials", "true")?;
    //     headers.set(
    //         "Access-Control-Allow-Headers",
    //         req.headers()
    //             .get("Access-Control-Request-Headers")?
    //             .unwrap_or("".to_string())
    //             .as_str(),
    //     )?;
    //     headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")?;

    //     return Ok(Response::ok("ok")?.with_headers(headers));
    // }

    // Optionally, use the Router to handle matching endpoints, use ":name" placeholders, or "*name"
    // catch-alls to match on specific patterns. Alternatively, use `Router::with_data(D)` to
    // provide arbitrary data that will be accessible in each route via the `ctx.data()` method.
    let router = Router::new();

    // Add as many routes as your Worker needs! Each route will get a `Request` for handling HTTP
    // functionality and a `RouteContext` which you can use to  and get route parameters and
    // Environment bindings like KV Stores, Durable Objects, Secrets, and Variables.
    router
        .get("/", |_, _| Response::ok(HELP_TEXT))
        .post_async("/v1/challenge/:public_key", |mut req, ctx| async move {
            let public_key = match ctx.param("public_key") {
                Some(k) => k,
                None => return Response::error("No :public_key given", 400),
            };
            let scope = req.text().await?;

            match auth::create_and_store_permission(public_key.to_string(), scope, &ctx).await {
                Ok(challenge) => {
                    let mut headers = Headers::new();
                    headers.set(
                        "Access-Control-Allow-Origin",
                        req.headers()
                            .get("Origin")?
                            .unwrap_or("*".to_string())
                            .as_str(),
                    )?;

                    Ok(Response::ok(challenge.as_str())?.with_headers(headers))
                }
                Err(e) => match e {
                    errors::ServicesError::Unauthorized => {
                        console_log!("{:?}", e);
                        return Response::error("Unauthorized", 401);
                    }
                    errors::ServicesError::ExpiredSession => {
                        return Response::error("ExpiredSession", 401)
                    }
                    errors::ServicesError::MissingHTTPHeader(_) => {
                        return Response::error("MissingHTTPHeader", 400)
                    }
                    errors::ServicesError::InvalidRequest(msg) => return Response::error(msg, 400),
                },
            }
        })
        // Get the metadata for a listing
        .get_async("/v1/listings/:public_key", |_, ctx| async move {
            let public_key = match ctx.param("public_key") {
                Some(k) => k,
                None => return Response::error("No :public_key given", 400),
            };

            let kv = ctx.kv("LISTINGS")?;
            let value = match kv
                .get(format!("{}/{}", public_key.as_str(), "metadata").as_str())
                .await?
            {
                Some(v) => v,
                None => return Response::error("Metadata Not Found", 404),
            };

            Response::from_json(&value.as_json::<omg::OpenMetaGraph>()?)
        })
        // Post metadata to the listing
        .post_async("/v1/listings/:public_key", |mut req, ctx| async move {
            console_log!("What the fuck");
            let listing_public_key = match ctx.param("public_key") {
                Some(k) => k,
                None => return Response::error("No 'public_key' given", 400),
            };
            let data = match req.json::<omg::OpenMetaGraph>().await {
                Ok(j) => j,
                Err(e) => {
                    return Response::error(
                        format!("Open Metagraph Error: {:}", e.to_string()),
                        400,
                    )
                }
            };

            console_log!("got data");

            let l_pubkey = match Pubkey::from_str(listing_public_key.as_str()) {
                Ok(p) => p,
                Err(e) => return Response::error(":public_key must be a base58 Public Key", 400),
            };
            let listing_account = match rpc::get_listing_info(
                "https://api.mainnet-beta.solana.com",
                l_pubkey,
            )
            .await
            {
                Ok(a) => a,
                Err(e) => match e {
                    errors::RpcError::ListingPublicKeyDoesNotExist => {
                        console_log!("Listing public key does not exist");
                        return Response::error(e.to_string(), 404);
                    }
                    errors::RpcError::RPCRequestFailed(_, _) => {
                        return Response::error(e.to_string(), 500);
                    }
                    errors::RpcError::FailedToCreateRPCRequest(_) => {
                        return Response::error(e.to_string(), 500)
                    }
                },
            };
            let authority = listing_account.data.authority;

            match auth::assert_permission(
                authority.to_string(),
                format!("POST /listings/{}", listing_public_key.to_string()),
                req.clone()?,
                &ctx,
            )
            .await
            {
                Ok(a) => a,
                Err(e) => match e {
                    errors::ServicesError::Unauthorized => {
                        return Response::error("Unauthorized", 401);
                    }
                    errors::ServicesError::ExpiredSession => {
                        return Response::error("ExpiredSession", 401)
                    }
                    errors::ServicesError::MissingHTTPHeader(_) => {
                        return Response::error("MissingHTTPHeader", 400)
                    }
                    errors::ServicesError::InvalidRequest(msg) => return Response::error(msg, 400),
                },
            }

            // Store the data (for the moment in the KV)
            let kv = match ctx.kv("LISTINGS") {
                Ok(k) => k,
                Err(e) => return Response::error(e.to_string(), 500),
            };
            let data_as_str = serde_json::to_string(&data)?;
            kv.put(
                format!("{}/{}", listing_public_key.as_str(), "metadata").as_str(),
                data_as_str.clone(),
            )?
            .execute()
            .await?;

            let mut headers = Headers::new();
            headers.set("Access-Control-Max-Age", "86400")?;
            headers.set(
                "Access-Control-Allow-Origin",
                req.headers()
                    .get("Origin")?
                    .unwrap_or("*".to_string())
                    .as_str(),
            )?;
            headers.set("Access-Control-Allow-Credentials", "true")?;
            headers.set(
                "Access-Control-Allow-Headers",
                req.headers()
                    .get("Access-Control-Request-Headers")?
                    .unwrap_or("".to_string())
                    .as_str(),
            )?;
            headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")?;
            Ok(Response::ok(data_as_str)?.with_headers(headers))
        })
        .options_async("/v1/listings/:public_key", |mut req, ctx| async move {
            let mut headers = Headers::new();
            headers.set("Access-Control-Max-Age", "86400")?;
            headers.set(
                "Access-Control-Allow-Origin",
                req.headers()
                    .get("Origin")?
                    .unwrap_or("*".to_string())
                    .as_str(),
            )?;
            headers.set("Access-Control-Allow-Credentials", "true")?;
            headers.set(
                "Access-Control-Allow-Headers",
                req.headers()
                    .get("Access-Control-Request-Headers")?
                    .unwrap_or("".to_string())
                    .as_str(),
            )?;
            headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")?;
            return Ok(Response::ok("ok")?.with_headers(headers));
        })
        .run(req, env)
        .await
}
