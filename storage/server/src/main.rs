use actix_multipart::Multipart;
use actix_web::{middleware, web, App, Error, HttpResponse, HttpServer};
use dotenv::dotenv;
use serde::{Deserialize, Serialize};
use std::borrow::BorrowMut;
use std::env;
use uuid::Uuid;
use utils::upload::{save_file as upload_save_file, split_payload, UploadFile};

mod utils;

#[derive(Deserialize, Serialize, Debug)]
pub struct InpAdd {
    pub listing_pubkey: String,
}

async fn save_file(mut payload: Multipart) -> Result<HttpResponse, Error> {
    let pl = split_payload(payload.borrow_mut()).await;
    println!("bytes={:#?}", pl.0);
    let inp_info: InpAdd = serde_json::from_slice(&pl.0).unwrap();
    println!("converter_struct={:#?}", inp_info);
    println!("tmpfiles={:#?}", pl.1);
    // Auth TODO
    //make key
    let object_id = Uuid::new_v4();
    let remote_file_key = format!("objects/{}/{}", inp_info.listing_pubkey, object_id.to_hyphenated().to_string()); // TODO parameterize
    //create tmp file and upload s3 and remove tmp file
    let upload_files: Vec<UploadFile> =
        upload_save_file(pl.1, remote_file_key).await.unwrap();
    println!("upload_files={:#?}", upload_files);
    Ok(HttpResponse::Ok().into())
}

fn is_auth(nonce: String, listing_pubkey: String) -> bool {
    let authority_pubkey = get_authority_pubkey_from_listing(listing_pubkey);
    return is_signed_by_pubkey(nonce, authority_pubkey)
}


fn is_signed_by_pubkey(check: String, pubkey: String) -> bool {
    return false
}

fn get_authority_pubkey_from_listing(listing_pubkey: String) -> String {
    return "".to_owned()
}

fn index() -> HttpResponse {
    let html = r#"<html>
        <head><title>Upload Test</title></head>
        <body>
            <form target="/" method="post" enctype="multipart/form-data" id="myForm" >
                <input type="text"  id="listing_pubkey" name="listing_pubkey" value="test_pub_key"/>    
                <input type="button" value="Submit" onclick="myFunction()"></button>
            </form>
            <input type="file" multiple name="file" id="myFile"/>
        </body>
        <script>
        function myFunction(){
            var myForm = document.getElementById('myForm');
            var myFile = document.getElementById('myFile');
    
            let formData = new FormData();
            const obj = {
                text: document.getElementById('text').value,
                number: Number(document.getElementById('number').value)
            };
            const json = JSON.stringify(obj);
            console.log(obj);
            console.log(json);
    
            
            formData.append("data", json);
            formData.append("myFile", myFile.files[0]);
    
            var request = new XMLHttpRequest();
            request.open("POST", "");
            request.send(formData);
        }
        
        
        </script>
    </html>"#;

    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(html)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    let aws_access_key_id =
        env::var("AWS_ACCESS_KEY_ID").expect("AWS_ACCESS_KEY_ID must be set");
    let aws_secret_access_key =
        env::var("AWS_SECRET_ACCESS_KEY").expect("AWS_SECRET_ACCESS_KEY must be set");
    let aws_s3_bucket_name =
        env::var("AWS_S3_BUCKET_NAME").expect("AWS_S3_BUCKET_NAME must be set");

    println!("{}", aws_access_key_id);
    println!("{}", aws_s3_bucket_name);

    std::env::set_var("RUST_LOG", "actix_server=info,actix_web=info");
    std::fs::create_dir_all("./tmp").unwrap(); // ensure flag no-exec set && readonly fs

    let ip = "0.0.0.0:8080";

    HttpServer::new(|| {
        App::new().wrap(middleware::Logger::default()).service(
            web::resource("/")
                .route(web::get().to(index))
                .route(web::post().to(save_file)),
        )
    })
    .bind(ip)?
    .run()
    .await
}