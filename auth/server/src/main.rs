use actix_web::{get, middleware::Logger, post, web, App, HttpResponse, HttpServer, Responder};

#[get("/signature_message/{public_key}")]
async fn get_signature_message(web::Path(public_key): web::Path<String>) -> impl Responder {
    HttpResponse::Ok().body(public_key)
}

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
