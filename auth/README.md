# Authentication

The ideas here were heavily inspired by [ethereums off chain login projects](https://login.xyz/). In it, they define a standard message that users sign with their private key. The login flow is the following:

1. User gets the strangemood login message through a GET request with their public key at `/signature_message/<public_key>` - this is particulary important since the server will be responsible of generating the nonce that avoids replay attacks
2. User signs the message string with their private key and sends the message AND the signature as a POST request to `/login`
3. Server recieves the request, verifies the signature _and the nonce_
4. If Signature and nonce are valid, the user is given a session or JWT

Since the user will see the message as plain text, its important that it is not in machine readable code like `json` or `xml`. We will need to parse the data to retrieve the relevant fields.

This is the strangemood message format:

```
${domain} wants you to sign in with your Ethereum account:
${user_public_address}

${statement}

URI: ${uri}
Version: ${version}
Nonce: ${nonce}
Issued At: ${issued-at}
```

## Server

To run the server in development:

```bash
cd server
cargo run
```
