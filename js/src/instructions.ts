import * as solana from '@solana/web3.js';
import { struct, u32, ns64 } from '@solana/buffer-layout';
import { AccountMeta as SolanaAccountMeta } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const INDEXES = {
  INIT_LISTING: 0,
  PURCHASE_LISTING: 1,
  SET_LISTING_AUTHORITY: 2,
  SET_LISTING_PRICE: 3,
  SET_LISTING_DEPOSIT: 4,
  SET_LISTING_AVAILABILITY: 5,
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

export function initListing(
  programId: solana.PublicKey,
  accounts: {
    signer: SignerAccountMeta;
    listing: WritableAccountMeta;
    app_mint: ReadonlyAccountMeta;
    sol_deposit: ReadonlyAccountMeta;
    vote_deposit: ReadonlyAccountMeta;
    realm: ReadonlyAccountMeta;
    charter_governance: ReadonlyAccountMeta;
    charter: ReadonlyAccountMeta;
  },
  listing: { amount: number }
) {
  let fields = Object.assign({ instruction: INDEXES.INIT_LISTING }, listing);
  let layout = struct([u32('instruction'), ns64('amount')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [
    accounts.signer,
    accounts.listing,
    accounts.app_mint,
    accounts.sol_deposit,
    accounts.vote_deposit,
    accounts.realm,
    accounts.charter_governance,
    accounts.charter,
    rent,
    splToken,
  ];
  return new solana.TransactionInstruction({
    keys,
    programId: programId,
    data,
  });
}

export function setListingPrice(
  programId: solana.PublicKey,
  accounts: {
    signer: SignerAccountMeta;
    listing: WritableAccountMeta;
  },
  params: { amount: number }
) {
  let fields = Object.assign(
    { instruction: INDEXES.SET_LISTING_PRICE },
    params
  );
  let layout = struct([u32('instruction'), ns64('amount')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [accounts.signer, accounts.listing];
  return new solana.TransactionInstruction({
    keys,
    programId: programId,
    data,
  });
}

export function setListingAuthority(
  programId: solana.PublicKey,
  accounts: {
    signer: SignerAccountMeta;
    listing: WritableAccountMeta;
    authority: ReadonlyAccountMeta;
  }
) {
  let fields = { instruction: INDEXES.SET_LISTING_AUTHORITY };
  let layout = struct([u32('instruction')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [accounts.signer, accounts.listing, accounts.authority];
  return new solana.TransactionInstruction({
    keys,
    programId: programId,
    data,
  });
}

export function setListingDeposit(
  programId: solana.PublicKey,
  accounts: {
    signer: SignerAccountMeta;
    listing: WritableAccountMeta;
    sol_deposit: ReadonlyAccountMeta;
    vote_deposit: ReadonlyAccountMeta;
  }
) {
  let fields = { instruction: INDEXES.SET_LISTING_DEPOSIT };
  let layout = struct([u32('instruction')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [
    accounts.signer,
    accounts.listing,
    accounts.sol_deposit,
    accounts.sol_deposit,
  ];
  return new solana.TransactionInstruction({
    keys,
    programId: programId,
    data,
  });
}

export function setListingAvailability(
  programId: solana.PublicKey,
  accounts: {
    signer: SignerAccountMeta;
    listing: WritableAccountMeta;
  },
  params: {
    is_available: boolean;
  }
) {
  let fields = Object.assign(
    { instruction: INDEXES.SET_LISTING_AVAILABILITY },
    { available: params.is_available }
  );
  let layout = struct([u32('instruction'), ns64('amount')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [accounts.signer, accounts.listing];
  return new solana.TransactionInstruction({
    keys,
    programId: programId,
    data,
  });
}

export function purchaseListing(
  programId: solana.PublicKey,
  accounts: {
    signer: SignerAccountMeta;
    listing: WritableAccountMeta;
    sol_token_account: ReadonlyAccountMeta; // SOL to purchase
    app_token_account: ReadonlyAccountMeta; // App to get back
    app_token_owner: ReadonlyAccountMeta; // Multisig owner
    realm: ReadonlyAccountMeta;
    charter_governance: ReadonlyAccountMeta;
    charter: ReadonlyAccountMeta;
  }
) {
  let fields = Object.assign({ instruction: INDEXES.SET_LISTING_DEPOSIT });
  let layout = struct([u32('instruction'), ns64('amount')]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [
    accounts.signer,
    accounts.listing,
    accounts.sol_token_account,
    accounts.app_token_account,
    accounts.app_token_owner,
    accounts.realm,
    accounts.charter_governance,
    accounts.charter,
    rent,
    splToken,
  ];
  return new solana.TransactionInstruction({
    keys,
    programId: programId,
    data,
  });
}
