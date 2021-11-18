import { struct, u8 } from '@solana/buffer-layout';
import { publicKey, uint64 } from './utils';

export const ListingLayout = struct([
  u8('is_initialized'),
  u8('is_available'),
  publicKey('charter_governance'),
  publicKey('authority'),
  publicKey('sol_token_account'),
  publicKey('community_token_account'),
  uint64('price'),
  publicKey('mint'),
]);
