import * as solana from '@solana/web3.js';
import { struct, u32, ns64, u8 } from '@solana/buffer-layout';
import { AccountMeta as SolanaAccountMeta } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { STRANGEMOOD_PROGRAM_ID } from './constants';
import { CharterLayout, ListingLayout, publicKey } from './state';
import { Charter } from './types';

const INDEXES = {
  INIT_LISTING: 0,
  PURCHASE_LISTING: 1,
  SET_LISTING_AUTHORITY: 2,
  SET_LISTING_PRICE: 3,
  SET_LISTING_DEPOSIT: 4,
  SET_LISTING_AVAILABILITY: 5,
  SET_CHARTER: 6,
};

const rent: ReadonlyAccountMeta = {
  isSigner: false,
  isWritable: false,
  pubkey: solana.SYSVAR_RENT_PUBKEY,
};

const splToken: ReadonlyAccountMeta = {
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

export type InitListingParams = {
  signerPubkey: solana.PublicKey;
  listingPubkey: solana.PublicKey;
  appMintPubkey: solana.PublicKey;
  solDepositPubkey: solana.PublicKey;
  voteDepositPubkey: solana.PublicKey;
  realmPubkey: solana.PublicKey;
  charterGovernancePubkey: solana.PublicKey;
  charterPubkey: solana.PublicKey;
  priceInLamports: number;
};

export function initListing(params: InitListingParams) {
  let fields = Object.assign(
    { instruction: INDEXES.INIT_LISTING },
    { amount: params.priceInLamports }
  );
  let layout = struct([u32('instruction'), ns64('amount')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [
    asSigner(params.signerPubkey),
    asWritable(params.listingPubkey),
    asReadonly(params.appMintPubkey),
    asReadonly(params.solDepositPubkey),
    asReadonly(params.voteDepositPubkey),
    asReadonly(params.realmPubkey),
    asReadonly(params.charterGovernancePubkey),
    asReadonly(params.charterPubkey),
    rent,
    splToken,
  ];
  return new solana.TransactionInstruction({
    keys,
    programId: STRANGEMOOD_PROGRAM_ID,
    data,
  });
}

export type SetListingPriceParams = {
  signerPubkey: solana.PublicKey;
  listingPubkey: solana.PublicKey;
  priceInLamports: number;
};

export function setListingPrice(params: SetListingPriceParams) {
  let fields = Object.assign(
    { instruction: INDEXES.SET_LISTING_PRICE },
    { amount: params.priceInLamports }
  );
  let layout = struct([u32('instruction'), ns64('amount')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [
    asSigner(params.signerPubkey),
    asWritable(params.listingPubkey),
  ];
  return new solana.TransactionInstruction({
    keys,
    programId: STRANGEMOOD_PROGRAM_ID,
    data,
  });
}

export type SetListingAuthorityParams = {
  signerPubkey: solana.PublicKey;
  listingPubkey: solana.PublicKey;
  authorityPubkey: solana.PublicKey;
};

export function setListingAuthority(params: SetListingAuthorityParams) {
  let fields = { instruction: INDEXES.SET_LISTING_AUTHORITY };
  let layout = struct([u32('instruction')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [
    asSigner(params.signerPubkey),
    asWritable(params.listingPubkey),
    asReadonly(params.authorityPubkey),
  ];
  return new solana.TransactionInstruction({
    keys,
    programId: STRANGEMOOD_PROGRAM_ID,
    data,
  });
}

export type SetListingDepositParams = {
  signerPubkey: solana.PublicKey;
  listingPubkey: solana.PublicKey;
  solDepositPubkey: solana.PublicKey;
  voteDepositPubkey: solana.PublicKey;
};

export function setListingDeposit(params: SetListingDepositParams) {
  let fields = { instruction: INDEXES.SET_LISTING_DEPOSIT };
  let layout = struct([u32('instruction')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [
    asSigner(params.signerPubkey),
    asWritable(params.listingPubkey),
    asReadonly(params.solDepositPubkey),
    asReadonly(params.voteDepositPubkey),
  ];
  return new solana.TransactionInstruction({
    keys,
    programId: STRANGEMOOD_PROGRAM_ID,
    data,
  });
}

export type SetListingAvailabilityParams = {
  signerPubkey: solana.PublicKey;
  listingPubkey: solana.PublicKey;
  isAvailable: boolean;
};

export function setListingAvailability(params: SetListingAvailabilityParams) {
  let fields = Object.assign(
    { instruction: INDEXES.SET_LISTING_AVAILABILITY },
    { available: params.isAvailable }
  );
  let layout = struct([u32('instruction'), ns64('amount')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [
    asSigner(params.signerPubkey),
    asWritable(params.listingPubkey),
  ];
  return new solana.TransactionInstruction({
    keys,
    programId: STRANGEMOOD_PROGRAM_ID,
    data,
  });
}

export type PurchaseListingParams = {
  signerPubkey: solana.PublicKey;
  listingPubkey: solana.PublicKey;
  solTokenAccountPubkey: solana.PublicKey;
  appTokenAccountPubkey: solana.PublicKey;
  appTokenOwnerPubkey: solana.PublicKey;
  realmPubkey: solana.PublicKey;
  charterGovernancePubkey: solana.PublicKey;
  charterPubkey: solana.PublicKey;
};

export function purchaseListing(
  params: PurchaseListingParams
): solana.TransactionInstruction {
  let fields = Object.assign({ instruction: INDEXES.SET_LISTING_DEPOSIT });
  let layout = struct([u32('instruction'), ns64('amount')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [
    asSigner(params.signerPubkey),
    asWritable(params.listingPubkey),
    asReadonly(params.solTokenAccountPubkey),
    asReadonly(params.appTokenAccountPubkey),
    asReadonly(params.appTokenOwnerPubkey),
    asReadonly(params.realmPubkey),
    asReadonly(params.charterGovernancePubkey),
    asReadonly(params.charterPubkey),
    rent,
    splToken,
  ];
  return new solana.TransactionInstruction({
    keys,
    programId: STRANGEMOOD_PROGRAM_ID,
    data,
  });
}

export type CreateCharterAccountParams = {
  lamportsForRent: number;
  payerPubkey: solana.PublicKey;
  newAccountPubkey: solana.PublicKey;
  owner: solana.PublicKey;
};

export function createEmptyCharterAccount(params: CreateCharterAccountParams) {
  return solana.SystemProgram.createAccount({
    fromPubkey: params.payerPubkey,
    newAccountPubkey: params.newAccountPubkey,
    lamports: params.lamportsForRent,
    space: CharterLayout.span,

    // TODO: this probably should be the gov program, but technically there's no check,
    // since anyone could create their own governance program.
    programId: params.owner,
  });
}

export type SetCharterAccountParams = {
  charterPubkey: solana.PublicKey;
  charterData: Charter;
  signer: solana.PublicKey;
};

export function setCharterAccount(params: SetCharterAccountParams) {
  let fields = Object.assign(
    { instruction: INDEXES.SET_CHARTER },
    {
      expansion_rate_amount: params.charterData.expansion_rate_amount,
      expansion_rate_decimals: params.charterData.expansion_rate_decimals,
      contribution_rate_amount: params.charterData.contribution_rate_amount,
      contribution_rate_decimals: params.charterData.contribution_rate_decimals,
      authority: params.charterData.authority.toBytes(),
      realm_sol_token_account_pubkey: params.charterData.realm_sol_token_account_pubkey.toBytes(),
    }
  );

  let layout = struct([
    u8('instruction'),

    ns64('expansion_rate_amount'),
    u8('expansion_rate_decimals'),

    ns64('contribution_rate_amount'),
    u8('contribution_rate_decimals'),

    publicKey('authority'),
    publicKey('realm_sol_token_account_pubkey'),
  ]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [asSigner(params.signer), asWritable(params.charterPubkey)];
  return new solana.TransactionInstruction({
    keys,
    programId: STRANGEMOOD_PROGRAM_ID,
    data,
  });
}

export type CreateListingAccount = {
  lamportsForRent: number;
  payerPubkey: solana.PublicKey;
  newAccountPubkey: solana.PublicKey;
};

export function createListingAccount(params: CreateListingAccount) {
  return solana.SystemProgram.createAccount({
    fromPubkey: params.payerPubkey,
    newAccountPubkey: params.newAccountPubkey,
    lamports: params.lamportsForRent,
    space: ListingLayout.span,
    programId: STRANGEMOOD_PROGRAM_ID,
  });
}
