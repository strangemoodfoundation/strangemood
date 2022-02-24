import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
export { Strangemood } from "../target/types/strangemood";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Strangemood } from "../target/types/strangemood";
import { pda as _pda } from "./pda";
import * as constants from "./constants";
import { v4 } from "uuid";
const { web3 } = anchor;
const { SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } = web3;
import { Buffer } from "buffer";
import * as splToken from "@solana/spl-token";
import { idlAddress } from "@project-serum/anchor/dist/cjs/idl";

export const pda = _pda;

export const MAINNET = constants.MAINNET;
export const TESTNET = constants.TESTNET;

export async function fetchStrangemoodProgram(
  provider: anchor.Provider,
  programId = MAINNET.strangemood_program_id
) {
  const idl = await anchor.Program.fetchIdl<Strangemood>(programId, provider);
  if (!idl) {
    const address = await idlAddress(programId);
    throw new Error(
      `Failed to fetch Strangemood program '${programId.toString()}' at anchor IDL $'{address.toString()}'.`
    );
  }

  return new anchor.Program(idl, programId, provider);
}

export type Listing = Awaited<
  ReturnType<Program<Strangemood>["account"]["listing"]["fetch"]>
>;

export type Charter = Awaited<
  ReturnType<Program<Strangemood>["account"]["charter"]["fetch"]>
>;

export type Receipt = Awaited<
  ReturnType<Program<Strangemood>["account"]["receipt"]["fetch"]>
>;

export type CharterTreasury = Awaited<
  ReturnType<Program<Strangemood>["account"]["charterTreasury"]["fetch"]>
>;

export type CashierTreasury = Awaited<
  ReturnType<Program<Strangemood>["account"]["cashierTreasury"]["fetch"]>
>;

export interface AccountInfo<Acc> {
  account: Acc;
  publicKey: PublicKey;
}

function isAccountInfo<T>(
  arg: AccountInfo<T> | PublicKey
): arg is AccountInfo<T> {
  return (
    (arg as AccountInfo<T>).account !== undefined &&
    (arg as AccountInfo<T>).publicKey !== undefined
  );
}

async function asReceiptInfo(
  program: Program<Strangemood>,
  arg: AccountInfo<Receipt> | PublicKey
): Promise<AccountInfo<Receipt>> {
  if (isAccountInfo(arg)) {
    return arg;
  }
  return {
    account: await program.account.receipt.fetch(arg),
    publicKey: arg,
  };
}

async function asListingInfo(
  program: Program<Strangemood>,
  arg: AccountInfo<Receipt> | PublicKey
): Promise<AccountInfo<Receipt>> {
  if (isAccountInfo(arg)) {
    return arg;
  }
  return {
    account: await program.account.listing.fetch(arg),
    publicKey: arg,
  };
}

async function asCharterInfo(
  program: Program<Strangemood>,
  arg: AccountInfo<Charter> | PublicKey
): Promise<AccountInfo<Charter>> {
  if (isAccountInfo(arg)) {
    return arg;
  }
  return {
    account: await program.account.charter.fetch(arg),
    publicKey: arg,
  };
}

async function asCharterTreasuryInfo(
  program: Program<Strangemood>,
  charter: PublicKey,
  mint: PublicKey
): Promise<AccountInfo<CharterTreasury>> {
  let [charterTreasuryPublicKey, charterTreasuryBump] = await pda.treasury(
    program.programId,
    charter,
    mint
  );

  let charterTreasury = await program.account.charterTreasury.fetch(
    charterTreasuryPublicKey
  );

  return {
    account: charterTreasury,
    publicKey: charterTreasuryPublicKey,
  };
}

async function getOrCreateAssociatedTokenAccount(args: {
  program: Program<Strangemood>;
  mint: PublicKey;
  signer: PublicKey;
}) {
  let instructions = [];
  let account = await getAssociatedTokenAddress(args.mint, args.signer);
  if (!(await args.program.provider.connection.getAccountInfo(account))) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        args.signer,
        account,
        args.signer,
        args.mint
      )
    );
  }

  return {
    instructions,
    account,
  };
}

async function purchaseWithoutCashier(args: {
  program: Program<Strangemood>;
  signer: PublicKey;
  listing: AccountInfo<Listing> | PublicKey;
  quantity: anchor.BN;
}) {
  let instructions = [];
  let listingInfo = await asListingInfo(args.program, args.listing);
  let charterInfo = await asCharterInfo(
    args.program,
    listingInfo.account.charter
  );

  // Create an inventory if it doesn't exist
  let inventory = await getAssociatedTokenAddress(
    listingInfo.account.mint,
    args.signer
  );
  if (!(await args.program.provider.connection.getAccountInfo(inventory))) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        args.signer,
        inventory,
        args.signer,
        listingInfo.account.mint
      )
    );
  }

  let deposit = await splToken.getAccount(
    args.program.provider.connection,
    listingInfo.account.paymentDeposit
  );
  let payment = await getAssociatedTokenAddress(deposit.mint, args.signer);

  // Setup PDAs
  let [_, listingBump] = await pda.listing(
    args.program.programId,
    listingInfo.publicKey
  );
  let [inventoryDelegate, inventoryDelegateBump] = await pda.token_authority(
    args.program.programId,
    inventory
  );
  let [listingMintAuthority, listingMintAuthorityBump] =
    await pda.mint_authority(args.program.programId, listingInfo.account.mint);
  let [charterMintAuthority, charterMintAuthorityBump] =
    await pda.mint_authority(args.program.programId, charterInfo.account.mint);

  let charterTreasuryInfo = await asCharterTreasuryInfo(
    args.program,
    charterInfo.publicKey,
    deposit.mint
  );

  let ix = await args.program.methods
    .purchase(
      listingMintAuthorityBump,
      charterMintAuthorityBump,
      inventoryDelegateBump,
      args.quantity
    )
    .accounts({
      payment: payment,
      inventory: inventory,
      inventoryDelegate: inventoryDelegate,
      listingsPaymentDeposit: listingInfo.account.paymentDeposit,
      listingsVoteDeposit: listingInfo.account.voteDeposit,
      listing: listingInfo.publicKey,
      listingMint: listingInfo.account.mint,
      listingMintAuthority: listingMintAuthority,
      charter: charterInfo.publicKey,
      charterTreasury: charterTreasuryInfo.publicKey,
      charterTreasuryDeposit: charterTreasuryInfo.account.deposit,
      charterReserve: charterInfo.account.reserve,
      charterMint: charterInfo.account.mint,
      charterMintAuthority: charterMintAuthority,
      purchaser: args.signer,
    })
    .instructions();

  instructions.push(ix);

  return {
    instructions,
  };
}

export async function initListing(args: {
  program: Program<Strangemood>;
  signer: PublicKey;

  // In lamports
  price: anchor.BN;

  // The decimals on the underlying mint.
  decimals?: number;

  // Example: "ipfs://my-cid"
  uri: string;

  // Can the lister burn tokens?
  isConsumable: boolean;

  // Can the purchaser refund?
  isRefundable: boolean;

  // Can this listing be purchased?
  isAvailable: boolean;

  // The percentage of the sale that goes to the marketplace (cashier)
  // that caused the sale. A value of 0.4 means 40% goes to the cashier.
  // Must be between 0.0 and 1.0.
  //
  // To "opt out" of cashier splits, set this to 0.0.
  cashierSplit: number;

  // the mint to be paid in.
  currency: PublicKey;

  // The charter this listing is associated with
  charter: AccountInfo<Charter> | PublicKey;
}) {
  if (args.cashierSplit > 1 || args.cashierSplit < 0) {
    throw new Error("cashierSplit must be between 0.0 and 1.0");
  }

  let instructions = [];
  const listingMint = Keypair.generate();
  const charterInfo = await asCharterInfo(args.program, args.charter);
  let charterTreasuryInfo = await asCharterTreasuryInfo(
    args.program,
    charterInfo.publicKey,
    args.currency
  );

  const paymentDeposit = await getOrCreateAssociatedTokenAccount({
    program: args.program,
    mint: args.currency,
    signer: args.signer,
  });
  instructions.push(...paymentDeposit.instructions);
  const voteDeposit = await getOrCreateAssociatedTokenAccount({
    program: args.program,
    mint: charterInfo.account.mint,
    signer: args.signer,
  });
  instructions.push(...voteDeposit.instructions);

  const [mint_authority, mint_authority_bump] = await pda.mint_authority(
    args.program.programId,
    listingMint.publicKey
  );
  const [listing_pda, _] = await pda.listing(
    args.program.programId,
    listingMint.publicKey
  );

  let ix = await args.program.methods
    .initListing(
      mint_authority_bump,
      args.decimals || 0,
      args.price,
      args.isRefundable,
      args.isConsumable,
      args.isAvailable,
      args.cashierSplit,
      args.uri
    )
    .accounts({
      listing: listing_pda,
      mintAuthority: mint_authority,
      mint: listingMint.publicKey,
      paymentDeposit: paymentDeposit.account,
      voteDeposit: voteDeposit.account,
      charter: charterInfo.publicKey,
      charterTreasury: charterTreasuryInfo.publicKey,
      user: args.signer,
    })
    .signers([listingMint])
    .instructions();

  instructions.push(ix);

  return {
    instructions,
    signers: [listingMint],
    publicKey: listing_pda,
  };
}

export async function initCharter(args: {
  program: Program<Strangemood>;
  authority: PublicKey;
  reserve: PublicKey;
  mint: PublicKey;
  signer: PublicKey;
  expansion: number;
  paymentContribution: number;
  voteContribution: number;
  withdrawPeriod: anchor.BN;
  stakeWithdrawAmount: anchor.BN;
  uri: string;
}) {
  const [charter_pda, _] = await pda.charter(args.program.programId, args.mint);

  let instructions = [];
  const ix = await args.program.methods
    .initCharter(
      args.expansion,
      args.paymentContribution,
      args.voteContribution,
      args.withdrawPeriod,
      args.stakeWithdrawAmount,
      args.uri
    )
    .accounts({
      charter: charter_pda,
      mint: args.mint,
      authority: args.authority,
      reserve: args.reserve,
      user: args.signer,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  instructions.push(ix);

  return {
    instructions,
  };
}
