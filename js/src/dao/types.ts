import * as solana from '@solana/web3.js';

export type Charter = {
  expansion_rate_amount: number;
  expansion_rate_decimals: number;
  contribution_rate_amount: number;
  contribution_rate_decimals: number;
  authority: solana.PublicKey;
  realm_sol_token_account: solana.PublicKey;
  realm_vote_token_account: solana.PublicKey;
};
