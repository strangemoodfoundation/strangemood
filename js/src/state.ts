import { struct, blob, u8 } from '@solana/buffer-layout';

const publicKey = (prop: string) => blob(32, prop);
const uint64 = (prop: string) => blob(8, prop);

export const ListingLayout = struct([
  u8('is_initialized'),
  u8('is_available'),
  publicKey('charter_governance'),
  struct(
    [
      publicKey('authority'),
      publicKey('sol_token_account'),
      publicKey('community_token_account'),
    ],
    'seller'
  ),
  struct([uint64('amount')], 'price'),
  struct([publicKey('mint')], 'product'),
]);

export const CharterLayout = struct([
  uint64('expansion_rate_amount'),
  u8('expansion_rate_decimals'),

  uint64('contribution_rate_amount'),
  u8('contribution_rate_decimals'),

  publicKey('realm_sol_token_account_pubkey'),
]);
