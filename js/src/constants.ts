import * as solana from '@solana/web3.js';

export const MAINNET = {
  STRANGEMOOD_PROGRAM_ID: new solana.PublicKey(
    'smtaswNwG1JkZY2EbogfBn9JmRdsjgMrRHgLvfikoVq'
  ),
  GOVERNANCE_PROGRAM_ID: new solana.PublicKey(
    'smfjietFKFJ4Sbw1cqESBTpPhF4CwbMwN8kBEC1e5ui'
  ),
  STRANGEMOOD_FOUNDATION_MINT: new solana.PublicKey(
    'moodzXgRAZuPDjdogxtWCQSs3xjyiXKtiqsFGTPpkeW'
  ),
  STRANGEMOOD_FOUNDATION_SOL_ACCOUNT: new solana.PublicKey(
    '5BGdQ9MKMSbkHRKPvC1XNq5ky9hVCU4s1QbNxLBYgJDv'
  ),
  STRANGEMOOD_FOUNDATION_VOTE_ACCOUNT: new solana.PublicKey(
    '3tHFaRiaiSoJsBkx5HbSm6Ep8J43Xuev2Sm1TwSnraUZ'
  ),
  STRANGEMOOD_FOUNDATION_CHARTER_GOVERNANCE: new solana.PublicKey(
    '6cS5HRJ9eapyy33LozbmoTRYwsMCnFLfTGQzAEBej1r6'
  ),
  STRANGEMOOD_FOUNDATION_CHARTER: new solana.PublicKey(
    '2xg9nw4KjxA9mAvNnLmnNzqZ7MFUayFPLrwQR75W4pG5'
  ),
  STRANGEMOOD_FOUNDATION_REALM: new solana.PublicKey(
    'FvzZFjf3NPTZbKAmQA4Gf1v7uTW7HFcP5Pcr2oVm49t3'
  ),
};

export const TESTNET = {
  STRANGEMOOD_PROGRAM_ID: new solana.PublicKey(
    'i2wXatLLgvNiVkDP9VrNm7mQ3vYs43MZP8D3ooY9Rgw'
  ),
  GOVERNANCE_PROGRAM_ID: new solana.PublicKey(
    'eyoXCKW5rkxbHc1fAXQJry5i6jYyyXk1iDGfKLYErbX'
  ),
  STRANGEMOOD_FOUNDATION_MINT: new solana.PublicKey(
    'HKJCqeLfGRCBHNzcevhGFXcau6mw7M1e481ub2TUAZkG'
  ),
};

export const STRANGEMOOD_INSTRUCTION_INDEXES = {
  INIT_LISTING: 0,
  PURCHASE_LISTING: 1,
  SET_LISTING_AUTHORITY: 2,
  SET_LISTING_PRICE: 3,
  SET_LISTING_DEPOSIT: 4,
  SET_LISTING_AVAILABILITY: 5,
  SET_CHARTER: 6,
};
