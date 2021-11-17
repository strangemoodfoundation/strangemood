import * as solana from '@solana/web3.js';
import { struct, u32, ns64, u8, blob } from '@solana/buffer-layout';
import { AccountMeta as SolanaAccountMeta } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

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

export const rent: ReadonlyAccountMeta = {
  isSigner: false,
  isWritable: false,
  pubkey: solana.SYSVAR_RENT_PUBKEY,
};

export const splToken: ReadonlyAccountMeta = {
  isSigner: false,
  isWritable: false,
  pubkey: TOKEN_PROGRAM_ID,
};

interface AccountMeta<Signer extends boolean, Writable extends boolean>
  extends SolanaAccountMeta {
  isSigner: Signer;
  isWritable: Writable;
}

type SignerAccountMeta = AccountMeta<true, false>;
type WritableAccountMeta = AccountMeta<false, true>;
type ReadonlyAccountMeta = AccountMeta<false, false>;

export function asSigner(pubkey: solana.PublicKey): SignerAccountMeta {
  return {
    isSigner: true,
    isWritable: false,
    pubkey,
  };
}

export function asWritable(pubkey: solana.PublicKey): WritableAccountMeta {
  return {
    isSigner: false,
    isWritable: true,
    pubkey,
  };
}

export function asReadonly(pubkey: solana.PublicKey): ReadonlyAccountMeta {
  return {
    isSigner: false,
    isWritable: false,
    pubkey,
  };
}
