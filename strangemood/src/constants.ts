import * as anchor from "@project-serum/anchor";

export type NET = typeof MAINNET;

export type Government = {
  governance_program_id: anchor.web3.PublicKey;
  mint: anchor.web3.PublicKey;
  realm: anchor.web3.PublicKey;
  charter: anchor.web3.PublicKey;
  sol_account: anchor.web3.PublicKey;
  vote_account: anchor.web3.PublicKey;
  sol_account_governance: anchor.web3.PublicKey;
  vote_account_governance: anchor.web3.PublicKey;
  charter_governance: anchor.web3.PublicKey;
  mint_authority: anchor.web3.PublicKey;
};

export type Environment = {
  strangemood_program_id: anchor.web3.PublicKey;
  government: Government;
};

export const MAINNET: Environment = {
  strangemood_program_id: new anchor.web3.PublicKey(
    "sgSBafcCxwD6G3tUbvTcvnCD28sCXhpasauLtpw9HdF"
  ),
  government: {
    governance_program_id: new anchor.web3.PublicKey(
      "smfjietFKFJ4Sbw1cqESBTpPhF4CwbMwN8kBEC1e5ui"
    ),
    mint: new anchor.web3.PublicKey(
      "moodn6VC7wWoFEmx5xGRkFJTNqXdiWBE2c9a3JhEC5p"
    ),
    sol_account: new anchor.web3.PublicKey(
      "9PsSpZjRbVErAuZ2j5NExLMKFXnp9P4QfaRSp9paGym7"
    ),
    sol_account_governance: new anchor.web3.PublicKey(
      "BgAtADKLwHNrNDP1s11W9f4ZqYhVwcg4XUTuizA4HgpR"
    ),
    vote_account: new anchor.web3.PublicKey(
      "ronqxZ9Cq6My2qJeL2CpMA5EChe81QY7vcsKefy1Hs5"
    ),
    vote_account_governance: new anchor.web3.PublicKey(
      "CpPq4mUd5YFSScJYLHMgyRumk2MWKPKxxrWZAsmcLXSS"
    ),
    charter_governance: new anchor.web3.PublicKey(
      "BR4ZTgXdFr1xYJcQwRToy87uydzimsju4Sp1H5HXQ6yc"
    ),
    charter: new anchor.web3.PublicKey(
      "BdbEbwDDLF5421zZdoZJLGjbRZYACyRBhE7cmKwfhmZF"
    ),
    realm: new anchor.web3.PublicKey(
      "2kH9MSnUnBcTG4A7khDuYVwvjJWQVFNDqreAAEpP4atV"
    ),
    mint_authority: new anchor.web3.PublicKey(
      "FHxaV3WNNYrqdoKE3w8rUtnUMDoRQAxmL642fdXHmEca"
    ),
  },
};

export const TESTNET: Environment = {
  strangemood_program_id: new anchor.web3.PublicKey(
    "sgSBafcCxwD6G3tUbvTcvnCD28sCXhpasauLtpw9HdF"
  ),
  government: {
    governance_program_id: new anchor.web3.PublicKey(
      "smfjietFKFJ4Sbw1cqESBTpPhF4CwbMwN8kBEC1e5ui"
    ),
    mint: new anchor.web3.PublicKey(
      "678yLhgiZbnRdUb8XZoGembuF5zfjzN1wMAdgr4JXGQx"
    ),
    realm: new anchor.web3.PublicKey(
      "ApRKmRxykkXFHjJtxWR4bk8m4AJTw5x46DyaX65VZMPe"
    ),
    charter: new anchor.web3.PublicKey(
      "BXoctCMnGs5Y1nrRYuYWLBwdg79o9JfGUsbYzPJbLjvT"
    ),
    sol_account: new anchor.web3.PublicKey(
      "4U9UYj9KcEghQ5n6Datvq8HPAbhkqENebyn9BuMfdCB5"
    ),
    vote_account: new anchor.web3.PublicKey(
      "3Yi8nAPyEJFbxvQHEksuukqChv9BXwfSmHnV29pkWrFH"
    ),
    sol_account_governance: new anchor.web3.PublicKey(
      "Ga1Y5ubkou5BgNsRDWJcn9JehgZDoE36fW7rP2SQSpCL"
    ),
    vote_account_governance: new anchor.web3.PublicKey(
      "CK5k5UCC9DNyAXCBwzYpFAZ24ZRoe6DomvsGrNyC7HVg"
    ),
    charter_governance: new anchor.web3.PublicKey(
      "8BxgjyhxXQkhibc2jKzjVhTnM5KZGCcVbKoCod141f1R"
    ),
    mint_authority: new anchor.web3.PublicKey(
      "Hi9KN3FHbJpjJxtnzyEvVFKm4x4iYkXDg4CPehUYUPAH"
    ),
  },
};
