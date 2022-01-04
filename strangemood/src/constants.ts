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

// type NET = typeof MAINNET;

// spl-token authorize HKJCqeLfGRCBHNzcevhGFXcau6mw7M1e481ub2TUAZkG mint 8k1Hm8TDGjRS8eGjyomnvaGPfKdtuKyKUmY9u7XbaEkb

export const TESTNET = {
  STRANGEMOOD_PROGRAM_ID: new anchor.web3.PublicKey(
    "i2wXatLLgvNiVkDP9VrNm7mQ3vYs43MZP8D3ooY9Rgw"
  ),
  GOVERNANCE_PROGRAM_ID: new anchor.web3.PublicKey(
    "smfjietFKFJ4Sbw1cqESBTpPhF4CwbMwN8kBEC1e5ui"
  ),
  STRANGEMOOD_FOUNDATION_MINT: new anchor.web3.PublicKey(
    "GFwmbvvpPC9y4jMX769GkjAXGFZJhj45QgQcn4wbe6k9"
  ),
  STRANGEMOOD_FOUNDATION_REALM: new anchor.web3.PublicKey(
    "GN4fpf9QxSx23CPokGTxnsSS6gK9c9Ww5QdszuP2T9Sm"
  ),
  STRANGEMOOD_FOUNDATION_CHARTER: new anchor.web3.PublicKey(
    "9a84XtFUxX7xSGSLH3vV4PQXAjkSNRHr1NUWGoGjjbLL"
  ),
  STRANGEMOOD_FOUNDATION_SOL_ACCOUNT: new anchor.web3.PublicKey(
    "8Z3cywoLZK49mAYb356pgn5cJ6VA7wE5vUynzRsBhAc3"
  ),
  STRANGEMOOD_FOUNDATION_VOTE_ACCOUNT: new anchor.web3.PublicKey(
    "7KoX9LX13ATUKixj9uGsFULsP4fdaSNsS9EmysjZXYWD"
  ),
  STRANGEMOOD_FOUNDATION_SOL_ACCOUNT_GOVERNANCE: new anchor.web3.PublicKey(
    "HALt41NKHMRXGeZiEyDQYC66UkyBDZVtFKDdg8tAxWC8"
  ),
  STRANGEMOOD_FOUNDATION_VOTE_ACCOUNT_GOVERNANCE: new anchor.web3.PublicKey(
    "BkTyQNFsoa2KFPLYMF9M6yGfEW56eJgc8dqXaFeRezuL"
  ),
  STRANGEMOOD_FOUNDATION_CHARTER_GOVERNANCE: new anchor.web3.PublicKey(
    "CCni6HPzuXQaGcXTJNs1YRrnvWFnAM9troewV6vyfhex"
  ),
  STRANGEMOOD_FOUNDATION_MINT_AUTHORITY: new anchor.web3.PublicKey(
    "BfGppy4MdeNDaR7sjdYy2FtYFHrCstt9wGWVyhU3xQNH"
  ),
};

export const LOCALNET = {
  GOVERNANCE_PROGRAM_ID: new anchor.web3.PublicKey(
    "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
  ),
};
