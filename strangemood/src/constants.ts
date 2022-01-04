import * as anchor from "@project-serum/anchor";

export const MAINNET = {
  STRANGEMOOD_PROGRAM_ID: new anchor.web3.PublicKey(
    "smtaswNwG1JkZY2EbogfBn9JmRdsjgMrRHgLvfikoVq"
  ),
  GOVERNANCE_PROGRAM_ID: new anchor.web3.PublicKey(
    "smfjietFKFJ4Sbw1cqESBTpPhF4CwbMwN8kBEC1e5ui"
  ),
  STRANGEMOOD_FOUNDATION_MINT: new anchor.web3.PublicKey(
    "moodzXgRAZuPDjdogxtWCQSs3xjyiXKtiqsFGTPpkeW"
  ),
  STRANGEMOOD_FOUNDATION_SOL_ACCOUNT: new anchor.web3.PublicKey(
    "5BGdQ9MKMSbkHRKPvC1XNq5ky9hVCU4s1QbNxLBYgJDv"
  ),
  STRANGEMOOD_FOUNDATION_SOL_ACCOUNT_GOVERNANCE: new anchor.web3.PublicKey(
    "4SxNGraPXoS3ia38Wt89MdTBN1AACSjzJE56LLLAonrL"
  ),
  STRANGEMOOD_FOUNDATION_VOTE_ACCOUNT: new anchor.web3.PublicKey(
    "3tHFaRiaiSoJsBkx5HbSm6Ep8J43Xuev2Sm1TwSnraUZ"
  ),
  STRANGEMOOD_FOUNDATION_VOTE_ACCOUNT_GOVERNANCE: new anchor.web3.PublicKey(
    "BPXhmqQZ8BUmd5F17a2K2QogPRQ45Fisa3NZfnfAoXzN"
  ),
  STRANGEMOOD_FOUNDATION_CHARTER_GOVERNANCE: new anchor.web3.PublicKey(
    "5jUJkBMX9PMZ3LYCRW3K9E1xpxGKxR6VNYvicJTQB68F"
  ),
  STRANGEMOOD_FOUNDATION_CHARTER: new anchor.web3.PublicKey(
    "A5yVjHjp8LTjpkw7VEhRP3KPoKKqTqWtkhTR47sJbxJg"
  ),
  STRANGEMOOD_FOUNDATION_REALM: new anchor.web3.PublicKey(
    "FvzZFjf3NPTZbKAmQA4Gf1v7uTW7HFcP5Pcr2oVm49t3"
  ),
  STRANGEMOOD_FOUNDATION_MINT_AUTHORITY: new anchor.web3.PublicKey(
    "4TTmTnvvBqH6aSJ1aLqapHBitfH47AfvSoZpGmEA88hu"
  ),
};

export type NET = typeof MAINNET;

export const TESTNET: NET = {
  STRANGEMOOD_PROGRAM_ID: new anchor.web3.PublicKey(
    "smtaswNwG1JkZY2EbogfBn9JmRdsjgMrRHgLvfikoVq"
  ),
  GOVERNANCE_PROGRAM_ID: new anchor.web3.PublicKey(
    "smfjietFKFJ4Sbw1cqESBTpPhF4CwbMwN8kBEC1e5ui"
  ),
  STRANGEMOOD_FOUNDATION_MINT: new anchor.web3.PublicKey(
    "678yLhgiZbnRdUb8XZoGembuF5zfjzN1wMAdgr4JXGQx"
  ),
  STRANGEMOOD_FOUNDATION_REALM: new anchor.web3.PublicKey(
    "ApRKmRxykkXFHjJtxWR4bk8m4AJTw5x46DyaX65VZMPe"
  ),
  STRANGEMOOD_FOUNDATION_CHARTER: new anchor.web3.PublicKey(
    "8xkw3m8r2uo3B9w3UrLjLpAYLqXJEjEyZePsPEgeigLn"
  ),
  STRANGEMOOD_FOUNDATION_SOL_ACCOUNT: new anchor.web3.PublicKey(
    "4U9UYj9KcEghQ5n6Datvq8HPAbhkqENebyn9BuMfdCB5"
  ),
  STRANGEMOOD_FOUNDATION_VOTE_ACCOUNT: new anchor.web3.PublicKey(
    "3Yi8nAPyEJFbxvQHEksuukqChv9BXwfSmHnV29pkWrFH"
  ),
  STRANGEMOOD_FOUNDATION_SOL_ACCOUNT_GOVERNANCE: new anchor.web3.PublicKey(
    "Ga1Y5ubkou5BgNsRDWJcn9JehgZDoE36fW7rP2SQSpCL"
  ),
  STRANGEMOOD_FOUNDATION_VOTE_ACCOUNT_GOVERNANCE: new anchor.web3.PublicKey(
    "CK5k5UCC9DNyAXCBwzYpFAZ24ZRoe6DomvsGrNyC7HVg"
  ),
  STRANGEMOOD_FOUNDATION_CHARTER_GOVERNANCE: new anchor.web3.PublicKey(
    "Bs4nkSyZoP7pKk5RviR2eHV2WMD9dbsgRWZA5uQK1GN7"
  ),
  STRANGEMOOD_FOUNDATION_MINT_AUTHORITY: new anchor.web3.PublicKey(
    "Hi9KN3FHbJpjJxtnzyEvVFKm4x4iYkXDg4CPehUYUPAH"
  ),
};

export const LOCALNET = {
  GOVERNANCE_PROGRAM_ID: new anchor.web3.PublicKey(
    "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
  ),
};
