use serde::{Deserialize, Serialize};
use worker::*;

mod omg;
mod signature_message;
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

#[derive(Serialize, Deserialize)]
struct SignatureMessageSession {
    nonce: String,
    issued_at: String,
    scope: String,
    public_key: String,
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
        .get_async("/challenge/:public_key/:scope", |mut req, ctx| async move {
            let public_key = match ctx.param("public_key") {
                Some(k) => k,
                None => return Response::error("No :public_key given", 400),
            };
            let scope = match ctx.param("scope") {
                Some(k) => k,
                None => return Response::error("No :scope given", 400),
            };

            let nonce = utils::generate_nonce();
            let issued_at = utils::get_current_time();

            let kv = ctx.kv("SIGNATURES")?;
            kv.put(
                format!("{}/{}", public_key.as_str(), scope).as_str(),
                SignatureMessageSession {
                    nonce: nonce.clone(),
                    issued_at: issued_at.clone(),
                    public_key: public_key.clone(),
                    scope: scope.clone(),
                },
            )?;

            let signature_message = signature_message::get_strangemood_signature_message(
                nonce,
                issued_at,
                public_key.to_string(),
            );
            Response::ok(signature_message)
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

            Response::ok(value.as_string())
        })
        // Post metadata to the listing
        .post_async("/listings/:public_key", |mut req, ctx| async move {
            let public_key = match ctx.param("public_key") {
                Some(k) => k,
                None => return Response::error("No :public_key given", 400),
            };
            let data = match req.json::<omg::OpenMetaGraph>().await {
                Ok(j) => j,
                Err(e) => return Response::error(e.to_string(), 400),
            };

            // TODO Check to see if we're allow to modify this

            // Store the data (for the moment in the KV)
            let kv = match ctx.kv("LISTINGS") {
                Ok(k) => k,
                Err(e) => return Response::error(e.to_string(), 500),
            };
            kv.put(
                format!("{}/{}", public_key.as_str(), "metadata").as_str(),
                data.clone(),
            )?;

            let response = serde_json::to_string(&data)?;
            Response::ok(response)
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
