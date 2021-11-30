import * as solana from '@solana/web3.js';
import { struct, ns64, u8 } from '@solana/buffer-layout';
import {
  STRANGEMOOD_PROGRAM_ID,
  STRANGEMOOD_INSTRUCTION_INDEXES as INDEXES,
} from './constants';
import { ListingLayout } from './state';
import {
  asReadonly,
  asSigner,
  asWritable,
  rent,
  splToken,
  uint64,
} from './utils';
import * as token from '@solana/spl-token';

export type InitListingParams = {
  signerPubkey: solana.PublicKey;
  listingPubkey: solana.PublicKey;
  mintPubkey: solana.PublicKey;
  solDepositPubkey: solana.PublicKey;
  voteDepositPubkey: solana.PublicKey;
  realmPubkey: solana.PublicKey;
  charterGovernancePubkey: solana.PublicKey;
  charterPubkey: solana.PublicKey;
  priceInLamports: number;
  governanceProgramId: solana.PublicKey;
};

export function initListing(params: InitListingParams) {
  let fields = Object.assign(
    { instruction: INDEXES.INIT_LISTING },
    { amount: new token.u64(params.priceInLamports).toBuffer() }
  );
  let layout = struct([u8('instruction'), uint64('amount')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [
    asSigner(params.signerPubkey),
    asWritable(params.listingPubkey),
    asWritable(params.mintPubkey),
    asReadonly(params.solDepositPubkey),
    asReadonly(params.voteDepositPubkey),
    asReadonly(params.governanceProgramId),
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
  let layout = struct([u8('instruction'), ns64('amount')]);
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
  let layout = struct([u8('instruction')]);
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
  let layout = struct([u8('instruction')]);
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
  let layout = struct([
    u8('instruction'),

    ns64('available'), // todo: this shouldn't be a ns64
  ]);
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
  purchasersListingTokenAccountPubkey: solana.PublicKey;

  solDepositPubkey: solana.PublicKey;
  voteDepositPubkey: solana.PublicKey;
  solContributionPubkey: solana.PublicKey;
  voteContributionPubkey: solana.PublicKey;

  realmMintPubkey: solana.PublicKey;
  listingMintPubkey: solana.PublicKey;
  realmMintAuthority: solana.PublicKey;
  listingMintAuthority: solana.PublicKey;

  governanceProgramId: solana.PublicKey;
  realmPubkey: solana.PublicKey;
  charterGovernancePubkey: solana.PublicKey;
  charterPubkey: solana.PublicKey;
};

export function purchaseListing(
  params: PurchaseListingParams
): solana.TransactionInstruction {
  let fields = Object.assign({ instruction: INDEXES.SET_LISTING_DEPOSIT });
  let layout = struct([u8('instruction'), ns64('amount')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [
    asSigner(params.signerPubkey),
    asWritable(params.listingPubkey),
    asReadonly(params.solTokenAccountPubkey),
    asReadonly(params.purchasersListingTokenAccountPubkey),

    asReadonly(params.solDepositPubkey),
    asReadonly(params.voteDepositPubkey),
    asReadonly(params.solContributionPubkey),
    asReadonly(params.voteContributionPubkey),

    asReadonly(params.realmMintPubkey),
    asReadonly(params.listingMintPubkey),
    asReadonly(params.realmMintAuthority),
    asReadonly(params.listingMintAuthority),

    asReadonly(params.governanceProgramId),
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
