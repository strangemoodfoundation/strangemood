import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
export { Strangemood } from "../target/types/strangemood";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
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

/**
 * Allows a purchase to be cashable, effectively marking
 * it as no-longer refundable.
 */
export async function setReceiptCashable(args: {
  program: Program<Strangemood>;
  conn: Connection;
  signer: anchor.web3.PublicKey;
  receipt: {
    account: Receipt;
    publicKey: PublicKey;
  };
  government?: constants.Government;
}) {
  let ix = args.program.instruction.setReceiptCashable({
    accounts: {
      listing: args.receipt.account.listing,
      receipt: args.receipt.publicKey,
      authority: args.signer,
    },
  });

  let tx = new Transaction();
  tx.add(ix);

  return {
    tx,
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
  conn: Connection;
  signer: anchor.web3.PublicKey;
  receipt: {
    account: Receipt;
    publicKey: PublicKey;
  };
  listing: {
    account: Receipt;
    publicKey: PublicKey;
  };
}) {
  let [_, listingBump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("listing"), args.listing.account.mint.toBuffer()],
    args.program.programId
  );

  let [listingMintAuthority, listingMintAuthorityBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), args.listing.account.mint.toBuffer()],
      args.program.programId
    );

  const ix = args.program.instruction.cancel(
    listingBump,
    listingMintAuthorityBump,
    {
      accounts: {
        purchaser: args.signer,
        receipt: args.receipt.publicKey,
        listingTokenAccount: args.receipt.account.listingTokenAccount,
        listing: args.receipt.account.listing,
        listingMint: args.listing.account.mint,
        listingMintAuthority: listingMintAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      },
    }
  );

  let tx = new Transaction();
  tx.add(ix);

  return {
    tx,
  };
}

/**
 * If the listing is consumable, burns tokens of a
 * particular account.
 */
export async function consume(args: {
  program: Program<Strangemood>;
  conn: Connection;
  signer: PublicKey;
  listing: {
    account: Receipt;
    publicKey: PublicKey;
  };
  listingTokenAccount: PublicKey;
  quantity: anchor.BN;
  government?: constants.Government;
}) {
  let [_, listingBump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("listing"), args.listing.account.mint.toBuffer()],
    args.program.programId
  );

  let [listingMintAuthority, listingMintAuthorityBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), args.listing.account.mint.toBuffer()],
      args.program.programId
    );

  const ix = args.program.instruction.consume(
    listingBump,
    listingMintAuthorityBump,
    args.quantity,
    {
      accounts: {
        listing: args.listing.publicKey,
        mint: args.listing.account.mint,
        mintAuthority: listingMintAuthority,
        listingTokenAccount: args.listingTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        authority: args.signer,
      },
    }
  );

  let tx = new Transaction();
  tx.add(ix);

  return {
    tx,
  };
}

/**
 * Creates a new listing for sale.
 */
export async function initListing(args: {
  program: Program<Strangemood>;
  conn: Connection;
  signer: PublicKey;

  // In lamports
  price: anchor.BN;

  // The decimals on the underlying mint.
  decimals: number;

  // Example: "ipfs://my-cid"
  uri: string;

  // Can the lister burn tokens?
  is_consumable: boolean;

  // Can the purchaser refund?
  is_refundable: boolean;

  // Can this listing be purchased?
  is_available: boolean;

  governance?: constants.Government;
}) {
  const mintKeypair = anchor.web3.Keypair.generate();
  const gov = args.governance || MAINNET.government;

  let tx = new Transaction();

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
  if (!(await args.conn.getAccountInfo(associatedVoteAddress))) {
    tx.add(
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
  if (!(await args.conn.getAccountInfo(associatedVoteAddress))) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        args.signer,
        associatedVoteAddress,
        args.signer,
        NATIVE_MINT
      )
    );
  }
  let init_instruction_ix = args.program.instruction.initListing(
    listingMintBump,
    listingBump,
    args.decimals,
    args.price,
    args.is_refundable,
    args.is_consumable,
    args.is_available,
    args.uri,
    {
      accounts: {
        listing: listingPDA,
        mint: mintKeypair.publicKey,
        mintAuthorityPda: listingMintAuthority,
        rent: SYSVAR_RENT_PUBKEY,
        solDeposit: associatedSolAddress,
        voteDeposit: associatedVoteAddress,
        realm: gov.realm,
        governanceProgram: gov.governance_program_id,
        charter: gov.charter,
        charterGovernance: gov.charter_governance,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: args.signer,
        systemProgram: SystemProgram.programId,
      },
      signers: [mintKeypair],
    }
  );
  tx.add(init_instruction_ix);

  return {
    tx,
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
  conn: Connection;
  cashier: PublicKey;
  signer: PublicKey;
  listing: {
    account: Listing;
    publicKey: PublicKey;
  };
  quantity: anchor.BN;
}) {
  let [listingMintAuthority, listingMintBump] = await pda.mint(
    args.program.programId,
    args.listing.account.mint
  );

  let tx = new Transaction();

  const nonce = makeReceiptNonce();
  const [receipt_pda, receipt_bump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("receipt"), nonce.toBuffer("le", 16)],
      args.program.programId
    );

  let listingTokenAccount = await getAssociatedTokenAddress(
    args.listing.account.mint,
    args.signer
  );
  if (!(await args.conn.getAccountInfo(listingTokenAccount))) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        args.signer,
        listingTokenAccount,
        args.signer,
        args.listing.account.mint
      )
    );
  }

  let purchase_ix = args.program.instruction.purchase(
    nonce,
    receipt_bump,
    listingMintBump,
    new anchor.BN(args.quantity),
    {
      accounts: {
        listing: args.listing.publicKey,
        cashier: args.cashier,
        listingTokenAccount: listingTokenAccount,
        listingMint: args.listing.account.mint,
        listingMintAuthority: listingMintAuthority,
        receipt: receipt_pda,
        user: args.signer,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      },
    }
  );
  tx.add(purchase_ix);

  return {
    tx,
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
  conn: Connection;
  signer: anchor.web3.PublicKey;
  receipt: {
    account: Receipt;
    publicKey: PublicKey;
  };
  listing: {
    account: Listing;
    publicKey: PublicKey;
  };
  government?: constants.Government;
}) {
  const gov = args.government || MAINNET.government;

  let [listingMintAuthority, listingMintAuthorityBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), args.listing.account.mint.toBuffer()],
      args.program.programId
    );

  let [_, realmMintBump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("mint"), gov.mint.toBuffer()],
    args.program.programId
  );

  const tx = new anchor.web3.Transaction({
    feePayer: args.signer,
  });

  tx.add(
    args.program.instruction.cash(listingMintAuthorityBump, realmMintBump, {
      accounts: {
        cashier: args.signer,
        receipt: args.receipt.publicKey,
        listing: args.listing.publicKey,
        listingTokenAccount: args.receipt.account.listingTokenAccount,
        listingsSolDeposit: args.listing.account.solDeposit,
        listingsVoteDeposit: args.listing.account.voteDeposit,
        realmSolDeposit: gov.sol_account,
        realmVoteDeposit: gov.vote_account,
        realmSolDepositGovernance: gov.sol_account_governance,
        realmVoteDepositGovernance: gov.vote_account_governance,
        realm: gov.realm,
        realmMint: gov.mint,
        realmMintAuthority: gov.mint_authority,
        governanceProgram: args.government,
        charter: gov.charter,
        charterGovernance: gov.charter_governance,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        listingMint: args.listing.account.mint,
        listingMintAuthority: listingMintAuthority,
      },
    })
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
  let sync_listing_sol_ix = createSyncNativeInstruction(this.realm_sol_deposit);
  let sync_realm_sol_ix = createSyncNativeInstruction(this.realm_sol_deposit);
  tx.add(sync_listing_sol_ix, sync_realm_sol_ix);

  return {
    tx,
  };
}

export async function setListingPrice(args: {
  program: Program<Strangemood>;
  conn: Connection;
  signer: anchor.web3.PublicKey;
  price: anchor.BN;
  listing: {
    account: Listing;
    publicKey: PublicKey;
  };
}) {
  let tx = new Transaction();

  tx.add(
    args.program.instruction.setListingPrice(args.price, {
      accounts: {
        user: args.signer,
        listing: args.listing,
        systemProgram: SystemProgram.programId,
      },
    })
  );
  return { tx };
}

export async function setListingUri(args: {
  program: Program<Strangemood>;
  conn: Connection;
  signer: anchor.web3.PublicKey;
  uri: string;
  listing: {
    account: Listing;
    publicKey: PublicKey;
  };
}) {
  let tx = new Transaction();

  tx.add(
    args.program.instruction.setListingUri(args.uri, {
      accounts: {
        user: args.signer,
        listing: args.listing,
        systemProgram: SystemProgram.programId,
      },
    })
  );
  return { tx };
}

export async function setListingDeposits(args: {
  program: Program<Strangemood>;
  conn: Connection;
  signer: anchor.web3.PublicKey;
  listing: {
    account: Listing;
    publicKey: PublicKey;
  };
  solDeposit: PublicKey;
  voteDeposit: PublicKey;
}) {
  let tx = new Transaction();

  tx.add(
    args.program.instruction.setListingDeposits({
      accounts: {
        user: args.signer,
        listing: args.listing,
        solDeposit: args.solDeposit,
        voteDeposit: args.voteDeposit,
        systemProgram: SystemProgram.programId,
      },
    })
  );
  return { tx };
}

export async function setListingAvailability(args: {
  program: Program<Strangemood>;
  conn: Connection;
  signer: anchor.web3.PublicKey;
  listing: {
    account: Listing;
    publicKey: PublicKey;
  };
}) {
  let tx = new Transaction();

  tx.add(
    args.program.instruction.setListingAvailability(true, {
      accounts: {
        user: args.signer,
        listing: args.listing,
        systemProgram: SystemProgram.programId,
      },
    })
  );
  return { tx };
}

export async function setListingAuthority(args: {
  program: Program<Strangemood>;
  conn: Connection;
  signer: anchor.web3.PublicKey;
  listing: {
    account: Listing;
    publicKey: PublicKey;
  };
  newAuthority: anchor.web3.PublicKey;
}) {
  let tx = new Transaction();

  tx.add(
    args.program.instruction.setListingAuthority({
      accounts: {
        user: args.signer,
        listing: args.listing,
        systemProgram: SystemProgram.programId,
        authority: args.newAuthority,
      },
    })
  );
  return { tx };
}

export async function initCharter(args: {
  program: Program<Strangemood>;
  conn: Connection;
  governanceProgramId: PublicKey;
  realm: PublicKey;
  authority: PublicKey;
  realmSolDeposit: PublicKey;
  realmVoteDeposit: PublicKey;
  signer: PublicKey;
  expansionAmount: anchor.BN;
  expansionDecimals: number;
  solContributionAmount: anchor.BN;
  solContributionDecimals: number;
  voteContributionAmount: anchor.BN;
  voteContributionDecimals: number;
  uri: string;
}) {
  let tx = new Transaction();

  let [charterPDA, charterBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("charter"),
        args.governanceProgramId.toBuffer(),
        args.realm.toBuffer(),
      ],
      args.program.programId
    );

  tx.add(
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
          realmSolDeposit: args.realmSolDeposit,
          realmVoteDeposit: args.realmVoteDeposit,
          realm: args.realm,
          governanceProgram: args.governanceProgramId,
          user: args.signer,
          systemProgram: SystemProgram.programId,
        },
      }
    )
  );
  return { tx, charter: charterPDA };
}
