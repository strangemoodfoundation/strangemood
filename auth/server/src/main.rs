use actix_web::{get, middleware::Logger, post, web, App, HttpResponse, HttpServer, Responder};

mod signature_message;
mod utils;

/// Returns the message a user must sign with their private key to authenticate.
#[get("/signature_message/{public_key}")]
async fn get_signature_message(web::Path(public_key): web::Path<String>) -> impl Responder {
    let nonce = utils::generate_nonce();
    let issued_at = utils::get_current_time();
    let signature_message =
        signature_message::get_strangemood_signature_message(nonce, issued_at, public_key);
    HttpResponse::Ok().body(signature_message)
}

// TODO: implement the login
#[post("/echo")]
async fn echo(req_body: String) -> impl Responder {
    HttpResponse::Ok().body(req_body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    std::env::set_var("RUST_LOG", "info");
    std::env::set_var("RUST_BACKTRACE", "1");
    env_logger::init();
    HttpServer::new(|| {
        let logger = Logger::default();
        App::new()
            .wrap(logger)
            .service(get_signature_message)
            .service(echo)
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
