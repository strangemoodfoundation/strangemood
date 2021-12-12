use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .service(getlisting)
            .service(postlogin)
            .service(postlisting)
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}

#[get("/listing/{pubkey}")]
async fn getlisting(path: web::Path<String>) -> impl Responder {
    HttpResponse::Ok().body(format!("Get Listing. your pubkey: {}!", &path))
}

#[post("/login/{pubkey}")]
async fn postlogin(path: web::Path<String>) -> impl Responder {
    HttpResponse::Ok().body(format!("Post Login. your pubkey: {}!", &path))
}

#[post("/listing/{pubkey}")]
async fn postlisting(path: web::Path<String>) -> impl Responder {
    HttpResponse::Ok().body(format!("Post Listing. your pubkey: {}!", &path))
}
