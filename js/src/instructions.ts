import * as solana from '@solana/web3.js';
import { struct, ns64, u8 } from '@solana/buffer-layout';
import { STRANGEMOOD_INSTRUCTION_INDEXES as INDEXES } from './constants';
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
  strangemoodProgramId: solana.PublicKey;
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
    programId: params.strangemoodProgramId,
    data,
  });
}

export type SetListingPriceParams = {
  strangemoodProgramId: solana.PublicKey;
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
    programId: params.strangemoodProgramId,
    data,
  });
}

export type SetListingAuthorityParams = {
  strangemoodProgramId: solana.PublicKey;
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
    programId: params.strangemoodProgramId,
    data,
  });
}

export type SetListingDepositParams = {
  strangemoodProgramId: solana.PublicKey;
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
    programId: params.strangemoodProgramId,
    data,
  });
}

export type SetListingAvailabilityParams = {
  strangemoodProgramId: solana.PublicKey;
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
    programId: params.strangemoodProgramId,
    data,
  });
}

export type PurchaseListingParams = {
  strangemoodProgramId: solana.PublicKey; // program ID of strangemood program
  signerPubkey: solana.PublicKey;
  listingPubkey: solana.PublicKey;
  solTokenAccountPubkey: solana.PublicKey; // temp wallet acct to move moneys
  purchasersListingTokenAccountPubkey: solana.PublicKey; // deterministic token acct, where token will land

  solDepositPubkey: solana.PublicKey; // where sol will end up -- ie the owner of the listing
  voteDepositPubkey: solana.PublicKey; // where governance tokesn (ex moodz) will end up -- program mints the listing owner with stake in protocol
  solContributionPubkey: solana.PublicKey; // pubkey of realm. ex: where 5% commission SOL goes.
  voteContributionPubkey: solana.PublicKey; // pubkey of realm's governance (ex moodz) acct. program also takes commission.

  communityMintPubkey: solana.PublicKey; // associated with a governance, constant per governance
  listingMintPubkey: solana.PublicKey; // unique per listing within a governance; need to check that the listing mint owned by (1) authority / strangemood program and (2) owner / solana token program
  communityMintAuthority: solana.PublicKey; // the program that can make new tokens; whoever controls private key of this can sign things and mint more. In this case it is the (governance?) progrsm
  listingMintAuthority: solana.PublicKey; // kinda like a scoped private key, a program derived address, // TODO

  governanceProgramId: solana.PublicKey; // program ID of strangemood governance
  realmPubkey: solana.PublicKey; // the realm itself
  charterGovernancePubkey: solana.PublicKey; // an account that binds governance to the realm. A realm has one governance.
  charterPubkey: solana.PublicKey; // charter is config file! decides how much is given to listing vs commission
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

    asReadonly(params.communityMintPubkey),
    asReadonly(params.listingMintPubkey),
    asReadonly(params.communityMintAuthority),
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
    programId: params.strangemoodProgramId,
    data,
  });
}

export type CreateListingAccount = {
  strangemoodProgramId: solana.PublicKey;
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
    programId: params.strangemoodProgramId,
  });
}
