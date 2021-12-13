import * as solana from '@solana/web3.js';
import * as splToken from '@solana/spl-token';

export type ListingAccount = solana.AccountInfo<{
  isInitialized: boolean;
  isAvailable: boolean;
  charterGovernance: any; // new solana.PublicKey(object.charter_governance),
  authority: solana.PublicKey;
  solTokenAccount: solana.PublicKey;
  communityTokenAccount: solana.PublicKey;
  mint: solana.PublicKey;
  price: splToken.u64;
}>;
