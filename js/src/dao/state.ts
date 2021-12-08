import { ns64, struct, u8, seq } from '@solana/buffer-layout';
import { publicKey, uint64 } from '../utils';

export const CharterLayout = struct([
  u8('instruction'),

  ns64('expansion_rate_amount'),
  u8('expansion_rate_decimals'),

  ns64('sol_contribution_rate_amount'),
  u8('sol_contribution_rate_decimals'),

  ns64('vote_contribution_rate_amount'),
  u8('vote_contribution_rate_decimals'),

  publicKey('authority'),
  publicKey('realm_sol_token_account'),
  publicKey('realm_vote_token_account'),

  seq(u8(), 128, 'uri'),
  seq(u8(), 64, 'reserved'), // Reserved space for future versions
]);
