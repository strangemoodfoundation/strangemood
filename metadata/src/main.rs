use serde::{Serialize, Deserialize};
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
// Get listing metadata (no need for auth)
async fn getlisting(path: web::Path<String>) -> impl Responder {
    HttpResponse::Ok().body(format!("Get Listing. your pubkey: {}!", &path))
}

// Login with public private key auth 
#[post("/login/{pubkey}")]
async fn postlogin(path: web::Path<String>, omgbody: web::Json<LoginPostBody>) -> impl Responder {
    // HttpResponse::Ok().body("hello world")
    HttpResponse::Ok().body(format!("Post Login. your pubkey: {}! your json version {}", &path, omgbody.version))
}

// Update listing metadata; should use keypair auth + take OMG as post body
#[post("/listing/{pubkey}")]
async fn postlisting(path: web::Path<String>) -> impl Responder {
    HttpResponse::Ok().body(format!("Post Listing. your pubkey: {}!", &path))
}

/// Struct to receive user input.
#[derive(Serialize, Deserialize)]
pub struct LoginPostBody {
    pub version: String
    // TODO: finish building out the omg spec
}