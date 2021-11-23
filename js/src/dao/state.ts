import { struct, u8 } from '@solana/buffer-layout';
import { publicKey, uint64 } from '../utils';

export const CharterLayout = struct([
  uint64('expansion_rate_amount'),
  u8('expansion_rate_decimals'),

  uint64('sol_contribution_rate_amount'),
  u8('sol_contribution_rate_decimals'),
  uint64('vote_contribution_rate_amount'),
  u8('vote_contribution_rate_decimals'),

  publicKey('authority'),
  publicKey('realm_sol_token_account'),
  publicKey('realm_vote_token_account'),
]);
