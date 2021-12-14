macro_rules! SIGNATURE_MESSAGE_TEMPLATE {
    () => {
        r#"
{domain} wants you to sign in with your Solana account:
{user_public_address}

I accept the Strangemood Terms of Service.

URI: {uri}
Version: {version}
Nonce: {nonce}
Issued At: {issued_at}

"#
    };
}

struct SignatureMessage {
    domain: &'static str,
    uri: &'static str,
    version: &'static str,
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
    user_public_address: String,
) -> String {
    let signature_message = SignatureMessage {
        domain: "strangemood.org",
        uri: "strangemood.org/login",
        version: "0.0.0",
    };

    return signature_message.get_signature_message(nonce, issued_at, user_public_address);
}
