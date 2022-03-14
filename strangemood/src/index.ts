import * as anchor from "@project-serum/anchor";
import { PublicKey, AccountInfo as SolanaAccountInfo } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Strangemood } from "./idl";
export { Strangemood } from "./idl";
import { pda as _pda } from "./pda";
import * as constants from "./constants";
const { web3 } = anchor;
const { SystemProgram, Keypair, SYSVAR_CLOCK_PUBKEY } = web3;
import { Buffer } from "buffer";
import * as splToken from "@solana/spl-token";

export const pda = _pda;

export const MAINNET = constants.MAINNET;
export const TESTNET = constants.TESTNET;

export async function fetchStrangemoodProgram(
  provider: anchor.Provider,
  programId = MAINNET.strangemood_program_id
): Promise<anchor.Program<Strangemood>> {
  const idl = await anchor.Program.fetchIdl<Strangemood>(programId, provider);
  if (!idl) {
    throw new Error(
      `Failed to fetch anchor IDL for Strangemood program '${programId.toString()}'.`
    );
  }

  return new anchor.Program(idl, programId, provider);
}

export type Listing = Awaited<
  ReturnType<anchor.Program<Strangemood>["account"]["listing"]["fetch"]>
>;

export type Charter = Awaited<
  ReturnType<anchor.Program<Strangemood>["account"]["charter"]["fetch"]>
>;

export type Cashier = Awaited<
  ReturnType<anchor.Program<Strangemood>["account"]["cashier"]["fetch"]>
>;

export type Receipt = Awaited<
  ReturnType<anchor.Program<Strangemood>["account"]["receipt"]["fetch"]>
>;

export type CharterTreasury = Awaited<
  ReturnType<anchor.Program<Strangemood>["account"]["charterTreasury"]["fetch"]>
>;

export type CashierTreasury = Awaited<
  ReturnType<anchor.Program<Strangemood>["account"]["cashierTreasury"]["fetch"]>
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

async function asListingInfo(
  program: any,
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

async function asCashierInfo(
  program: any,
  arg: AccountInfo<Cashier> | PublicKey
): Promise<AccountInfo<Cashier>> {
  if (isAccountInfo(arg)) {
    return arg;
  }
  return {
    account: await program.account.cashier.fetch(arg),
    publicKey: arg,
  };
}

async function asCharterInfo(
  program: any,
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
  program: any,
  charter: PublicKey,
  mint: PublicKey
): Promise<AccountInfo<CharterTreasury>> {
  let [charterTreasuryPublicKey, charterTreasuryBump] = await pda.treasury(
    program.programId,
    charter,
    mint
  );

  try {
    let charterTreasury = await program.account.charterTreasury.fetch(
      charterTreasuryPublicKey
    );

    return {
      account: charterTreasury,
      publicKey: charterTreasuryPublicKey,
    };
  } catch (err) {
    throw new Error(
      `Could not find charter treasury for charter '${charter.toString()}' and mint '${mint.toString()}'\n${err}`
    );
  }
}

async function asCashierTreasuryInfo(
  program: anchor.Program<Strangemood>,
  cashier: PublicKey,
  mint: PublicKey
): Promise<AccountInfo<CharterTreasury>> {
  let [cashierTreasuryPublicKey, cashierTreasuryBump] = await pda.treasury(
    program.programId,
    cashier,
    mint
  );

  let cashierTreasury = await program.account.cashierTreasury.fetch(
    cashierTreasuryPublicKey
  );

  return {
    account: cashierTreasury,
    publicKey: cashierTreasuryPublicKey,
  };
}

async function getOrCreateAssociatedTokenAccount(args: {
  program: any;
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

async function maybeFundWrappedSolAccount({
  program,
  deposit,
  payment,
  listingInfo,
  signer,
  quantity,
}: {
  program: any;
  deposit: splToken.Account;
  payment: PublicKey;
  listingInfo: AccountInfo<Listing>;
  quantity: anchor.BN;
  signer: PublicKey;
}) {
  let instructions = [];
  if (deposit.mint.toString() === splToken.NATIVE_MINT.toString()) {
    let total = listingInfo.account.price.mul(quantity);

    const signerAccount = (await program.provider.connection.getAccountInfo(
      signer
    )) as SolanaAccountInfo<any>;
    if (!signerAccount) {
      throw new Error(
        `The signer '${signer.toString()}' account does not exist. If you think it should, consider sending SOL to the account.`
      );
    }
    if (total.gt(new anchor.BN(signerAccount.lamports))) {
      throw new Error(
        `${signer.toString()} only has ${signerAccount.lamports.toString()}, but needs ${total.toString()} to cover the transaction`
      );
    }

    // Create the payment account if it doesn't exist
    if (!(await program.provider.connection.getAccountInfo(payment))) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          signer,
          payment,
          signer,
          deposit.mint
        )
      );

      // And fund it with the wrapped sol from the signer
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: signer,
          toPubkey: payment,
          lamports: total.toNumber(),
        })
      );

      instructions.push(splToken.createSyncNativeInstruction(payment));
    } else {
      // If they don't have enough wrapped sol, fund the account with the difference
      const paymentAccount = await splToken.getAccount(
        program.provider.connection,
        payment
      );
      const remaining = total.sub(
        new anchor.BN(paymentAccount.amount.toString())
      );

      // If we don't have enough funds in the wrapped SOL account, make
      // up the difference by funding it from the signer
      if (remaining.gt(new anchor.BN(0))) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: signer,
            toPubkey: payment,
            lamports: remaining.toNumber(),
          })
        );
        instructions.push(splToken.createSyncNativeInstruction(payment));
      }
    }
  }
  return instructions;
}

async function purchaseWithoutCashier(args: {
  program: any;
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

  const maybeFundWrappedSolInstructions = await maybeFundWrappedSolAccount({
    program: args.program,
    deposit,
    payment,
    listingInfo,
    signer: args.signer,
    quantity: args.quantity,
  });

  instructions.push(...maybeFundWrappedSolInstructions);

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
    .instruction();

  instructions.push(ix);

  return {
    instructions,
  };
}

async function purchaseWithCashier(args: {
  program: any;
  signer: PublicKey;
  listing: AccountInfo<Listing> | PublicKey;
  quantity: anchor.BN;
  cashier: AccountInfo<Cashier> | PublicKey;
}) {
  let instructions = [];
  let listingInfo = await asListingInfo(args.program, args.listing);
  let charterInfo = await asCharterInfo(
    args.program,
    listingInfo.account.charter
  );
  let cashierInfo = await asCashierInfo(args.program, args.cashier);

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

  const maybeFundWrappedSolInstructions = await maybeFundWrappedSolAccount({
    program: args.program,
    deposit,
    payment,
    listingInfo,
    signer: args.signer,
    quantity: args.quantity,
  });
  instructions.push(...maybeFundWrappedSolInstructions);

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

  let cashierTreasury = await asCashierTreasuryInfo(
    args.program,
    cashierInfo.publicKey,
    deposit.mint
  );

  let ix = await args.program.methods
    .purchaseWithCashier(
      listingMintAuthorityBump,
      charterMintAuthorityBump,
      inventoryDelegateBump,
      args.quantity
    )
    .accounts({
      cashier: cashierInfo.publicKey,
      cashierTreasury: cashierTreasury.publicKey,
      cashierTreasuryEscrow: cashierTreasury.account.escrow,
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
    .instruction();

  instructions.push(ix);

  return {
    instructions,
  };
}

export async function purchase(args: {
  program: any;
  signer: PublicKey;
  listing: AccountInfo<Listing> | PublicKey;
  quantity: anchor.BN;
  cashier?: AccountInfo<Cashier> | PublicKey;
}) {
  if (args.cashier) {
    return purchaseWithCashier({
      program: args.program,
      signer: args.signer,
      listing: args.listing,
      quantity: args.quantity,
      cashier: args.cashier,
    });
  } else {
    return purchaseWithoutCashier(args);
  }
}

export async function initListing(args: {
  program: any;
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
    .instruction();

  instructions.push(ix);

  return {
    instructions,
    signers: [listingMint],
    listing: listing_pda,
  };
}

export async function setListingUri(args: {
  program: any;
  signer: PublicKey;
  listing: AccountInfo<Listing> | PublicKey;
  uri: string;
}) {
  let instructions = [];

  let ix = await args.program.methods
    .setListingUri(args.uri)
    .accounts({
      listing: args.listing,
      authority: args.signer,
    })
    .instruction();

  instructions.push(ix);

  return {
    instructions,
  };
}

export async function setListingAvailability(args: {
  program: any;
  signer: PublicKey;
  listing: AccountInfo<Listing> | PublicKey;
  isAvailable: boolean;
}) {
  let instructions = [];

  let ix = await args.program.methods
    .setListingAvailability(args.isAvailable)
    .accounts({
      listing: args.listing,
      authority: args.signer,
    })
    .instruction();

  instructions.push(ix);

  return {
    instructions,
  };
}

export async function initCharter(args: {
  program: any;
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
    charter: charter_pda,
  };
}

export async function initCashier(args: {
  program: any;
  uri: string;
  charter: AccountInfo<Charter> | PublicKey;
  authority: PublicKey;
}) {
  const charterInfo = await asCharterInfo(args.program, args.charter);
  const stake = Keypair.generate();
  const [cashier_pda, cashier_bump] = await pda.cashier(
    args.program.programId,
    stake.publicKey
  );
  const [stakeAuthority, stake_authority_bump] = await pda.token_authority(
    args.program.programId,
    stake.publicKey
  );

  let instructions = [];
  let ix = await args.program.methods
    .initCashier(stake_authority_bump, args.uri)
    .accounts({
      cashier: cashier_pda,
      stake: stake.publicKey,
      stakeAuthority,
      charter: charterInfo.publicKey,
      charterMint: charterInfo.account.mint,
      authority: args.authority,
      clock: SYSVAR_CLOCK_PUBKEY,
    })
    .signers([stake])
    .instruction();
  instructions.push(ix);

  return {
    instructions,
    signers: [stake],
  };
}

export async function initCashierTreasury(args: {
  program: any;
  charter: AccountInfo<Charter> | PublicKey;
  cashier: AccountInfo<Cashier> | PublicKey;
  mint: PublicKey;
  deposit: PublicKey;
}) {
  const cashierInfo = await asCashierInfo(args.program, args.cashier);
  const charterTreasuryInfo = await asCharterTreasuryInfo(
    args.program,
    cashierInfo.publicKey,
    args.mint
  );

  const escrow = Keypair.generate();
  const [escrow_authority, bump] = await pda.token_authority(
    args.program.programId,
    escrow.publicKey
  );
  const [cashier_treasury_pda, _] = await pda.treasury(
    args.program.programId,
    cashierInfo.publicKey,
    args.mint
  );

  let instructions = [];
  let ix = await args.program.methods
    .initCashierTreasury(bump)
    .accounts({
      cashierTreasury: cashier_treasury_pda,
      cashier: cashierInfo.publicKey,
      charterTreasury: charterTreasuryInfo.publicKey,
      charter: charterTreasuryInfo.publicKey,
      deposit: args.deposit,
      escrow: escrow.publicKey,
      escrowAuthority: escrow_authority,
      mint: args.mint,
      clock: SYSVAR_CLOCK_PUBKEY,
      authority: args.program.provider.wallet.publicKey,
    })
    .signers([escrow])
    .instruction();

  instructions.push(ix);

  return {
    instructions,
    signers: [escrow],
  };
}

export async function initCharterTreasury(args: {
  program: any;
  charter: AccountInfo<Charter> | PublicKey;
  mint: PublicKey;
  deposit: PublicKey;
  scalar: number;
}) {
  if (args.scalar < 0) {
    throw new Error("scalar must be greater than 0");
  }
  const charterInfo = await asCharterInfo(args.program, args.charter);

  const [treasury_pda, _] = await pda.treasury(
    args.program.programId,
    charterInfo.publicKey,
    args.mint
  );

  let ix = await args.program.methods
    .initCharterTreasury(1.0)
    .accounts({
      treasury: treasury_pda,
      mint: args.mint,
      deposit: args.deposit,
      charter: charterInfo.publicKey,
    })
    .instruction();

  let instructions = [ix];

  return {
    instructions,
    treasury: treasury_pda,
  };
}
