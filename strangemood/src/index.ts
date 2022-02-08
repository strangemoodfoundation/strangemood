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
const { SystemProgram, SYSVAR_RENT_PUBKEY } = web3;
import { Buffer } from "buffer";
import * as splToken from "@solana/spl-token";

export const pda = _pda;

export const MAINNET = constants.MAINNET;
export const TESTNET = constants.TESTNET;

export function makeReceiptNonce() {
  let buffer = [];
  v4(null, buffer);
  const as_hex = buffer.map((n) => n.toString(16)).join("");

  return new anchor.BN(as_hex, 16, "le");
}

export async function fetchStrangemoodProgram(
  provider: anchor.Provider,
  programId = MAINNET.strangemood_program_id
) {
  const idl = await anchor.Program.fetchIdl<Strangemood>(programId, provider);
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

/**
 * Allows a purchase to be cashable, effectively marking
 * it as no-longer refundable.
 */
export async function setReceiptCashable(args: {
  program: Program<Strangemood>;
  signer: anchor.web3.PublicKey;
  receipt: AccountInfo<Receipt> | PublicKey;
  government?: constants.Government;
}) {
  let receiptInfo = await asReceiptInfo(args.program, args.receipt);

  let ix = args.program.instruction.setReceiptCashable({
    accounts: {
      listing: receiptInfo.account.listing,
      receipt: receiptInfo.publicKey,
      authority: args.signer,
    },
  });

  let instructions = [ix];

  return {
    instructions,
  };
}

/**
 * Cancels an in-progress purchase, returning
 * the escrow the purchaser, and, if the purchase
 * was refundable, burns the tokens they received
 * at purchase time.
 */
export async function cancel(args: {
  program: Program<Strangemood>;
  signer: anchor.web3.PublicKey;
  receipt: AccountInfo<Receipt> | PublicKey;
  listing: AccountInfo<Listing> | PublicKey;
}) {
  let receiptInfo = await asReceiptInfo(args.program, args.receipt);
  let listingInfo = await asListingInfo(args.program, args.listing);

  let [_, listingBump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("listing"), listingInfo.account.mint.toBuffer()],
    args.program.programId
  );

  let [listingMintAuthority, listingMintAuthorityBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), listingInfo.account.mint.toBuffer()],
      args.program.programId
    );

  let [escrowAuthority, escrowAuthorityBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("escrow"), receiptInfo.account.escrow.toBuffer()],
      this.program.programId
    );

  let returnTokenAccount = await splToken.getAssociatedTokenAddress(
    receiptInfo.account.mint,
    args.signer
  );

  const ix = args.program.instruction.cancel(
    listingBump,
    listingMintAuthorityBump,
    escrowAuthorityBump,
    {
      accounts: {
        returnDeposit: returnTokenAccount,
        purchaser: args.signer,
        receipt: receiptInfo.publicKey,
        escrow: receiptInfo.account.escrow,
        escrowAuthority: escrowAuthority,
        listingTokenAccount: receiptInfo.account.listingTokenAccount,
        listing: receiptInfo.account.listing,
        listingMint: listingInfo.account.mint,
        listingMintAuthority: listingMintAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      },
    }
  );

  let instructions = [ix];

  return {
    instructions,
  };
}

/**
 * If the listing is consumable, burns tokens of a
 * particular account.
 */
export async function consume(args: {
  program: Program<Strangemood>;
  signer: PublicKey;
  listing: AccountInfo<Receipt> | PublicKey;
  listingTokenAccount: PublicKey;
  quantity: anchor.BN;
  government?: constants.Government;
}) {
  let listingInfo = await asListingInfo(args.program, args.listing);

  let [_, listingBump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("listing"), listingInfo.account.mint.toBuffer()],
    args.program.programId
  );

  let [listingMintAuthority, listingMintAuthorityBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), listingInfo.account.mint.toBuffer()],
      args.program.programId
    );

  const ix = args.program.instruction.consume(
    listingBump,
    listingMintAuthorityBump,
    args.quantity,
    {
      accounts: {
        listing: listingInfo.publicKey,
        mint: listingInfo.account.mint,
        mintAuthority: listingMintAuthority,
        listingTokenAccount: args.listingTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        authority: args.signer,
      },
    }
  );

  let instructions = [ix];

  return {
    instructions,
  };
}

/**
 * Creates a new listing for sale.
 */
export async function initListing(args: {
  program: Program<Strangemood>;
  signer: PublicKey;

  // In lamports
  price: anchor.BN;

  // The decimals on the underlying mint.
  decimals: number;

  // Example: "ipfs://my-cid"
  uri: string;

  // Can the lister burn tokens?
  isConsumable: boolean;

  // Can the purchaser refund?
  isRefundable: boolean;

  // Can this listing be purchased?
  isAvailable: boolean;

  // the mint to be paid in.
  payment: PublicKey;

  governance?: constants.Government;
}) {
  const mintKeypair = anchor.web3.Keypair.generate();
  const gov = args.governance || MAINNET.government;

  let instructions = [];

  let [listingMintAuthority, listingMintBump] = await pda.mint(
    args.program.programId,
    mintKeypair.publicKey
  );
  let [listingPDA, listingBump] = await pda.listing(
    args.program.programId,
    mintKeypair.publicKey
  );

  // Find or create an associated vote token account
  let associatedVoteAddress = await getAssociatedTokenAddress(
    gov.mint,
    args.signer
  );
  if (
    !(await args.program.provider.connection.getAccountInfo(
      associatedVoteAddress
    ))
  ) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        args.signer,
        associatedVoteAddress,
        args.signer,
        gov.mint
      )
    );
  }

  let associatedSolAddress = await getAssociatedTokenAddress(
    NATIVE_MINT,
    args.signer
  );
  if (
    !(await args.program.provider.connection.getAccountInfo(
      associatedVoteAddress
    ))
  ) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        args.signer,
        associatedVoteAddress,
        args.signer,
        NATIVE_MINT
      )
    );
  }

  const [treasuryPDA, _] = await pda.treasury(
    args.program.programId,
    args.governance.charter,
    args.payment
  );

  let init_instruction_ix = args.program.instruction.initListing(
    listingMintBump,
    listingBump,
    args.decimals,
    args.price,
    args.isRefundable,
    args.isConsumable,
    args.isAvailable,
    args.uri,
    {
      accounts: {
        listing: listingPDA,
        mint: mintKeypair.publicKey,
        mintAuthorityPda: listingMintAuthority,
        charterTreasury: treasuryPDA,
        rent: SYSVAR_RENT_PUBKEY,
        paymentDeposit: associatedSolAddress,
        voteDeposit: associatedVoteAddress,
        charter: gov.charter,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: args.signer,
        systemProgram: SystemProgram.programId,
      },
      signers: [mintKeypair],
    }
  );
  instructions.push(init_instruction_ix);

  return {
    instructions,
    signers: [mintKeypair],
    publicKey: listingPDA,
  };
}

/**
 * Initiates a purchase. The purchase must eventually
 * be "cashed" by the cashier.
 */
export async function purchase(args: {
  program: Program<Strangemood>;

  cashier: PublicKey;
  signer: PublicKey;
  listing: AccountInfo<Listing> | PublicKey;
  quantity: anchor.BN;
}) {
  let listingInfo = await asListingInfo(args.program, args.listing);
  const listingDeposit = await splToken.getAccount(
    this.program.provider.connection,
    listingInfo.account.paymentDeposit
  );

  let [listingMintAuthority, listingMintBump] = await pda.mint(
    args.program.programId,
    listingInfo.account.mint
  );

  let instructions = [];

  const nonce = makeReceiptNonce();
  const [receipt_pda, receipt_bump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("receipt"), nonce.toArrayLike(Buffer, "le", 16)],
      args.program.programId
    );

  let listingTokenAccount = await getAssociatedTokenAddress(
    listingInfo.account.mint,
    args.signer
  );
  if (
    !(await args.program.provider.connection.getAccountInfo(
      listingTokenAccount
    ))
  ) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        args.signer,
        listingTokenAccount,
        args.signer,
        listingInfo.account.mint
      )
    );
  }

  let escrowKeypair = anchor.web3.Keypair.generate();
  let [escrowAuthority, escrowAuthorityBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("escrow"), escrowKeypair.publicKey.toBuffer()],
      this.program.programId
    );

  let purchaseTokenAccount = await splToken.getAssociatedTokenAddress(
    listingDeposit.mint,
    args.signer
  );

  let purchase_ix = args.program.instruction.purchase(
    nonce,
    receipt_bump,
    listingMintBump,
    escrowAuthorityBump,
    new anchor.BN(args.quantity),
    {
      accounts: {
        cashier: args.cashier,
        escrow: escrowKeypair.publicKey,
        escrowAuthority,
        listing: listingInfo.publicKey,
        listingMint: listingInfo.account.mint,
        listingMintAuthority: listingMintAuthority,
        listingPaymentDeposit: listingInfo.account.paymentDeposit,
        listingPaymentDepositMint: listingDeposit.mint,
        listingTokenAccount: listingTokenAccount,
        purchaseTokenAccount: purchaseTokenAccount,
        receipt: receipt_pda,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: args.signer,
      },
    }
  );
  instructions.push(purchase_ix);

  return {
    instructions,
    receipt: receipt_pda,
  };
}

/**
 * Cashes out the receipt, emptying the escrow
 * to the lister and the realm.
 *
 * If the receipt is non-refundable, then this
 * instruction also gives the user their listing
 * tokens.
 *
 * This instruction is expected to be signed by
 * the user's keypair.
 *
 * @param args
 */
export async function cash(args: {
  program: Program<Strangemood>;
  signer: anchor.web3.PublicKey;
  receipt: AccountInfo<Receipt> | PublicKey;
  listing?: AccountInfo<Listing> | PublicKey;
  government?: constants.Government;
}) {
  const gov = args.government || MAINNET.government;

  let receiptInfo = await asReceiptInfo(args.program, args.receipt);

  let listingInfo: AccountInfo<Listing>;
  if (args.listing) {
    listingInfo = await asListingInfo(args.program, args.listing);
  } else {
    listingInfo = await asListingInfo(
      args.program,
      receiptInfo.account.listing
    );
  }

  if (gov.charter.toString() !== listingInfo.account.charter.toString()) {
    // If you're getting this error, you're probably trying to cash a listing
    // that does not belong to the default co-op. To fix this, consider
    // passing a `args.government` of the listing.
    throw new Error(
      `The Listing at '${listingInfo.publicKey}' does not belong to the charter '${gov.charter}'.`
    );
  }

  let [listingMintAuthority, listingMintAuthorityBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), listingInfo.account.mint.toBuffer()],
      args.program.programId
    );

  let [realmMintAuthority, realmMintBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), gov.mint.toBuffer()],
      args.program.programId
    );

  let [escrowAuthority, escrowAuthorityBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("escrow"), receiptInfo.account.escrow.toBuffer()],
      this.program.programId
    );

  const listingDeposit = await splToken.getAccount(
    this.program.provider.connection,
    listingInfo.account.paymentDeposit
  );

  let [treasury_pda, treasury_bump] = await pda.treasury(
    this.program.programId,
    listingInfo.account.charter,
    listingDeposit.mint
  );
  const treasuryDeposit = await args.program.account.charterTreasury.fetch(
    treasury_pda
  );

  let instructions = [];

  instructions.push(
    args.program.instruction.cash(
      listingMintAuthorityBump,
      realmMintBump,
      escrowAuthorityBump,
      {
        accounts: {
          cashier: args.signer,
          receipt: receiptInfo.publicKey,
          escrow: receiptInfo.account.escrow,
          escrowAuthority,
          listing: listingInfo.publicKey,
          listingTokenAccount: receiptInfo.account.listingTokenAccount,
          listingsPaymentDeposit: listingInfo.account.paymentDeposit,
          listingsVoteDeposit: listingInfo.account.voteDeposit,
          charterTreasuryDeposit: treasuryDeposit,
          charterTreasury: treasury_pda,
          charterVoteDeposit: gov.vote_account,
          charterMint: gov.mint,
          charterMintAuthority: realmMintAuthority,
          charter: gov.charter,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          listingMint: listingInfo.account.mint,
          listingMintAuthority: listingMintAuthority,
        },
      }
    )
  );

  // Cash moves data into wrapped SOL accounts, which are easier for
  // other programs to work with. But to make the transaction size smaller,
  // it's transfering native SOL, not wrapped SOL. So to make it easier on
  // clients, we run `sync_native` instruction here, which updates the wrapped SOL
  // value based on the underlying lamport value of the token account.
  //
  // Technically, your app doesn't need to sync these accounts; the listings and
  // the realm could do it themselves. That's quite rude though (basically
  // like spitting in their soup I hear) and the makers of the protocol
  // would probably call you a meanie if you took these lines out.
  let sync_listing_sol_ix = createSyncNativeInstruction(
    listingInfo.account.paymentDeposit
  );
  let sync_realm_sol_ix = createSyncNativeInstruction(gov.sol_account);
  instructions.push(sync_listing_sol_ix, sync_realm_sol_ix);

  return {
    instructions,
  };
}

export async function setListingPrice(args: {
  program: Program<Strangemood>;

  signer: anchor.web3.PublicKey;
  price: anchor.BN;
  listing: AccountInfo<Listing> | PublicKey;
}) {
  let listingKey: PublicKey = isAccountInfo(args.listing)
    ? args.listing.publicKey
    : args.listing;

  let instructions = [];
  instructions.push(
    args.program.instruction.setListingPrice(args.price, {
      accounts: {
        user: args.signer,
        listing: listingKey,
        systemProgram: SystemProgram.programId,
      },
    })
  );
  return { instructions };
}

export async function setListingUri(args: {
  program: Program<Strangemood>;

  signer: anchor.web3.PublicKey;
  uri: string;
  listing: AccountInfo<Listing> | PublicKey;
}) {
  let instructions = [];

  let listingKey: PublicKey = isAccountInfo(args.listing)
    ? args.listing.publicKey
    : args.listing;

  instructions.push(
    args.program.instruction.setListingUri(args.uri, {
      accounts: {
        user: args.signer,
        listing: listingKey,
        systemProgram: SystemProgram.programId,
      },
    })
  );
  return { instructions };
}

export async function setListingDeposits(args: {
  program: Program<Strangemood>;

  signer: anchor.web3.PublicKey;
  listing: AccountInfo<Listing> | PublicKey;
  solDeposit: PublicKey;
  voteDeposit: PublicKey;
}) {
  let instructions = [];

  let listingKey: PublicKey = isAccountInfo(args.listing)
    ? args.listing.publicKey
    : args.listing;

  instructions.push(
    args.program.instruction.setListingDeposits({
      accounts: {
        user: args.signer,
        listing: listingKey,
        paymentDeposit: args.solDeposit,
        voteDeposit: args.voteDeposit,
        systemProgram: SystemProgram.programId,
      },
    })
  );
  return { instructions };
}

export async function setListingAvailability(args: {
  program: Program<Strangemood>;

  signer: anchor.web3.PublicKey;
  listing: AccountInfo<Listing> | PublicKey;
}) {
  let instructions = [];

  let listingKey: PublicKey = isAccountInfo(args.listing)
    ? args.listing.publicKey
    : args.listing;

  instructions.push(
    args.program.instruction.setListingAvailability(true, {
      accounts: {
        user: args.signer,
        listing: listingKey,
        systemProgram: SystemProgram.programId,
      },
    })
  );
  return { instructions };
}

export async function setListingAuthority(args: {
  program: Program<Strangemood>;

  signer: anchor.web3.PublicKey;
  listing: AccountInfo<Listing> | PublicKey;
  newAuthority: anchor.web3.PublicKey;
}) {
  let instructions = [];

  let listingKey: PublicKey = isAccountInfo(args.listing)
    ? args.listing.publicKey
    : args.listing;

  instructions.push(
    args.program.instruction.setListingAuthority({
      accounts: {
        user: args.signer,
        listing: listingKey,
        systemProgram: SystemProgram.programId,
        authority: args.newAuthority,
      },
    })
  );
  return { instructions };
}

export async function initCharter(args: {
  program: Program<Strangemood>;
  authority: PublicKey;
  voteDeposit: PublicKey;
  mint: PublicKey;
  signer: PublicKey;
  expansionAmount: anchor.BN;
  expansionDecimals: number;
  solContributionAmount: anchor.BN;
  solContributionDecimals: number;
  voteContributionAmount: anchor.BN;
  voteContributionDecimals: number;
  uri: string;
}) {
  let instructions = [];

  let [charterPDA, charterBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("charter"), args.mint.toBuffer()],
      args.program.programId
    );

  instructions.push(
    args.program.instruction.initCharter(
      charterBump,
      args.expansionAmount, // Expansion amount
      args.expansionDecimals, // expansion decimals
      args.solContributionAmount, // sol contribution amount
      args.solContributionDecimals, // sol contribution decimals
      args.voteContributionAmount, // vote contribution amount
      args.voteContributionDecimals, // vote contribution decimals
      args.uri,
      {
        accounts: {
          charter: charterPDA,
          authority: args.authority,
          voteDeposit: args.voteDeposit,
          mint: args.mint,
          user: args.signer,
          systemProgram: SystemProgram.programId,
        },
      }
    )
  );
  return { instructions, charter: charterPDA };
}
