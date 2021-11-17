import { struct, blob, u8 } from '@solana/buffer-layout';

export const publicKey = (prop: string) => blob(32, prop);
export const uint64 = (prop: string) => blob(8, prop);

export const toBuffer = (arr: Buffer | Uint8Array | Array<number>): Buffer => {
  if (Buffer.isBuffer(arr)) {
    return arr;
  } else if (arr instanceof Uint8Array) {
    return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  } else {
    return Buffer.from(arr);
  }
};

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

  publicKey('authority'),
  publicKey('realm_sol_token_account'),
]);
