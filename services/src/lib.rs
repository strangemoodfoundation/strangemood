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

#[event(fetch)]
pub async fn main(req: Request, env: Env) -> Result<Response> {
    log_request(&req);

    // Optionally, get more helpful error messages written to the console in the case of a panic.
    utils::set_panic_hook();

    // Optionally, use the Router to handle matching endpoints, use ":name" placeholders, or "*name"
    // catch-alls to match on specific patterns. Alternatively, use `Router::with_data(D)` to
    // provide arbitrary data that will be accessible in each route via the `ctx.data()` method.
    let router = Router::new();

    // Add as many routes as your Worker needs! Each route will get a `Request` for handling HTTP
    // functionality and a `RouteContext` which you can use to  and get route parameters and
    // Environment bindings like KV Stores, Durable Objects, Secrets, and Variables.
    router
        .get("/", |_, _| Response::ok("Strike the earth!"))
        .post_async("/challenge/:public_key", |mut req, ctx| async move {
            let public_key = match ctx.param("public_key") {
                Some(k) => k,
                None => return Response::error("No :public_key given", 400),
            };
            let scope = req.text().await?;

            match auth::create_and_store_permission(public_key.to_string(), scope, &ctx).await {
                Ok(challenge) => Response::ok(challenge),
                Err(e) => match e {
                    errors::ServicesError::Unauthorized() => {
                        console_log!("{:?}", e);
                        return Response::error("Unauthorized", 401);
                    }
                    errors::ServicesError::ExpiredSession() => {
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
        .get_async("/listings/:public_key", |_, ctx| async move {
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
        .post_async("/listings/:public_key", |mut req, ctx| async move {
            let public_key = match ctx.param("public_key") {
                Some(k) => k,
                None => return Response::error("No 'public_key' given", 400),
            };
            let data = match req.json::<omg::OpenMetaGraph>().await {
                Ok(j) => j,
                Err(e) => return Response::error(e.to_string(), 400),
            };

            // TODO: look up listing in Strangemood
            // let client =
            //     solana_client::rpc_client::RpcClient::new("https://api.mainnet-beta.solana.com");

            // let data = client.get_account_data(pubkey)?;
            // let listing = strangemood::Listing::try_deserialize(data)?;

            match auth::assert_permission(
                public_key.to_string(),
                format!("POST /listings/{}", public_key),
                req,
                &ctx,
            )
            .await
            {
                Ok(a) => a,
                Err(e) => match e {
                    errors::ServicesError::Unauthorized() => {
                        return Response::error("Unauthorized", 401);
                    }
                    errors::ServicesError::ExpiredSession() => {
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
                format!("{}/{}", public_key.as_str(), "metadata").as_str(),
                data_as_str.clone(),
            )?
            .execute()
            .await?;

            Response::ok(data_as_str)
        })
        // Post files, like game files, or screenshots that are associated with the listing
        // .post_async("/listings/:public_key/upload/:key", |mut req, ctx| async move {})
        .get("/worker-version", |_, ctx| {
            let version = ctx.var("WORKERS_RS_VERSION")?.to_string();
            Response::ok(version)
        })
        .run(req, env)
        .await
}
