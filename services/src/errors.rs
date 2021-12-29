use thiserror::Error;

#[derive(Error, Debug)]
pub enum ServicesError {
    // A standard message that doesn't reveal the difference between
    // "does this user just not exist" and "did I enter the wrong details"
    // which prevents folks from using API to discover details about users
    // behavior.
    #[error("Unauthorized")]
    Unauthorized, // 401

    // The caller must grab a new session
    #[error("ExpiredSession\nTry requesting another challenge")]
    ExpiredSession, // 401

    #[error("MissingHTTPHeader\n{0}")]
    MissingHTTPHeader(String), // 400

    #[error("InvalidRequest\n{0}")]
    InvalidRequest(String), // 400
}

#[derive(Error, Debug)]
pub enum RpcError {
    #[error("ListingPublicKeyDoesNotExist")]
    ListingPublicKeyDoesNotExist, // 404

    // Something went wrong creating the request
    #[error("FailedToCreateRPCRequest\n{0}")]
    FailedToCreateRPCRequest(String), // 500

    // The request failed in some way
    #[error("SolanaRPCRequestFailure\n{0}\n\nRequest sent:\n{1}")]
    RPCRequestFailed(String, String), // 500
}
