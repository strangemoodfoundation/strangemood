import * as solana from '@solana/web3.js';

export const MAINNET = {
  STRANGEMOOD_PROGRAM_ID: new solana.PublicKey(
    'smRTqb2UbcSmFu1XLVDiLpVaGdoc4spJdF3BVxfCdum'
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
};

export const TESTNET = {
  STRANGEMOOD_PROGRAM_ID: new solana.PublicKey(
    'i2wXatLLgvNiVkDP9VrNm7mQ3vYs43MZP8D3ooY9Rgw'
  ),
  GOVERNANCE_PROGRAM_ID: new solana.PublicKey(
    'eyoXCKW5rkxbHc1fAXQJry5i6jYyyXk1iDGfKLYErbX'
  ),
  STRANGEMOOD_FOUNDATION_MINT: new solana.PublicKey(
    '36RC6XAKAnjEYVySfb4k6dnyjWJGgfjRL1oMx3pe9MVL'
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
