import * as solana from '@solana/web3.js';
import { struct, u32, ns64, u8 } from '@solana/buffer-layout';
import {
  STRANGEMOOD_PROGRAM_ID,
  STRANGEMOOD_INSTRUCTION_INDEXES as INDEXES,
} from './constants';
import { ListingLayout } from './state';
import { asReadonly, asSigner, asWritable, rent, splToken } from './utils';

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
    { amount: params.priceInLamports }
  );
  let layout = struct([u32('instruction'), ns64('amount')]);
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
  listingTokenAccountPubkey: solana.PublicKey;
  listingTokenOwnerPubkey: solana.PublicKey;
  realmPubkey: solana.PublicKey;
  charterGovernancePubkey: solana.PublicKey;
  charterPubkey: solana.PublicKey;
  governanceProgramId: solana.PublicKey;
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
    asReadonly(params.listingTokenAccountPubkey),
    asReadonly(params.listingTokenOwnerPubkey),
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
