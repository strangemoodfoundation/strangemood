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
  STRANGEMOOD_FOUNDATION_VOTE_ACCOUNT: new anchor.web3.PublicKey(
    "3tHFaRiaiSoJsBkx5HbSm6Ep8J43Xuev2Sm1TwSnraUZ"
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

export const TESTNET = {
  STRANGEMOOD_PROGRAM_ID: new anchor.web3.PublicKey(
    "i2wXatLLgvNiVkDP9VrNm7mQ3vYs43MZP8D3ooY9Rgw"
  ),
  GOVERNANCE_PROGRAM_ID: new anchor.web3.PublicKey(
    "eyoXCKW5rkxbHc1fAXQJry5i6jYyyXk1iDGfKLYErbX"
  ),
  STRANGEMOOD_FOUNDATION_MINT: new anchor.web3.PublicKey(
    "HKJCqeLfGRCBHNzcevhGFXcau6mw7M1e481ub2TUAZkG"
  ),
};

export const LOCALNET = {
  GOVERNANCE_PROGRAM_ID: new anchor.web3.PublicKey(
    "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
  ),
};