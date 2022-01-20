import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
export { Strangemood } from "../target/types/strangemood";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import { Strangemood } from "../target/types/strangemood";
import { pda as _pda } from "./pda";
import { Environment, Government, MAINNET, NET } from "./constants";
import { v4 } from "uuid";
import { Governance } from "./governance/accounts";
const { web3 } = anchor;
const { SystemProgram, SYSVAR_RENT_PUBKEY } = web3;

export const pda = _pda;

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

async function createWrappedSolTokenAccountForPurchase(
  conn: Connection,
  user: PublicKey,
  lamports: number
): Promise<[anchor.web3.TransactionInstruction[], Keypair]> {
  // Allocate memory for the account
  const balanceNeeded = await splToken.getMinimumBalanceForRentExemptAccount(
    conn
  );

  // Create a new account
  const newAccount = anchor.web3.Keypair.generate();
  let instructions = [];
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: user,
      newAccountPubkey: newAccount.publicKey,
      lamports: balanceNeeded,
      space: splToken.AccountLayout.span,
      programId: splToken.TOKEN_PROGRAM_ID,
    })
  );

  // Send lamports to it (these will be wrapped into native tokens by the token program)
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: user,
      toPubkey: newAccount.publicKey,
      lamports: lamports,
    })
  );

  // Assign the new account to the native token mint.
  // the account will be initialized with a balance equal to the native token balance.
  // (i.e. amount)
  instructions.push(
    splToken.createInitializeAccountInstruction(
      newAccount.publicKey,
      splToken.NATIVE_MINT,
      user
    )
  );

  return [instructions, newAccount];
}

async function createAssociatedTokenAccount(
  mint: PublicKey,
  user: PublicKey
): Promise<[anchor.web3.TransactionInstruction, PublicKey]> {
  let associatedTokenAccountAddress = await splToken.getAssociatedTokenAddress(
    mint,
    user
  );

  let ix = splToken.createAssociatedTokenAccountInstruction(
    user,
    associatedTokenAccountAddress,
    user,
    mint
  );

  return [ix, associatedTokenAccountAddress];
}

export async function setReceiptCashable(args: {
  program: Program<Strangemood>;
  conn: Connection;
  cashier: anchor.web3.PublicKey;
  receipt: {
    account: Receipt;
    publicKey: PublicKey;
  };
  government?: Government;
}) {
  let ix = args.program.instruction.setReceiptCashable({
    accounts: {
      listing: args.receipt.account.listing,
      receipt: args.receipt.publicKey,
      authority: args.receipt.account.authority,
    },
  });

  let tx = new Transaction();
  tx.add(ix);

  return {
    tx,
  };
}

export async function cancel(args: {
  program: Program<Strangemood>;
  conn: Connection;
  purchaser: anchor.web3.PublicKey;
  receipt: {
    account: Receipt;
    publicKey: PublicKey;
  };
  listing: {
    account: Receipt;
    publicKey: PublicKey;
  };
  government?: Government;
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
        purchaser: args.purchaser,
        receipt: args.receipt.publicKey,
        listingTokenAccount: args.receipt.account.listingTokenAccount,
        listing: args.receipt.account.listing,
        listingMint: args.listing.account.mint,
        listingMintAuthority: listingMintAuthority,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
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

export async function initListing(args: {
  program: Program<Strangemood>;
  conn: Connection;
  user: PublicKey;

  // In lamports
  price: anchor.BN;

  decimals: number;

  // Example: "ipfs://my-cid"
  uri: string;

  is_consumable: boolean;
  is_refundable: boolean;
  is_available: boolean;

  governance?: Government;
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
  let associatedVoteAddress = await splToken.getAssociatedTokenAddress(
    gov.mint,
    args.user
  );
  if (!(await args.conn.getAccountInfo(associatedVoteAddress))) {
    tx.add(
      splToken.createAssociatedTokenAccountInstruction(
        args.user,
        associatedVoteAddress,
        args.user,
        gov.mint
      )
    );
  }

  let associatedSolAddress = await splToken.getAssociatedTokenAddress(
    splToken.NATIVE_MINT,
    args.user
  );
  if (!(await args.conn.getAccountInfo(associatedVoteAddress))) {
    tx.add(
      splToken.createAssociatedTokenAccountInstruction(
        args.user,
        associatedVoteAddress,
        args.user,
        splToken.NATIVE_MINT
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
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        user: args.user,
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

export async function purchase(args: {
  program: Program<Strangemood>;
  conn: Connection;
  cashier: PublicKey;
  purchaser: PublicKey;
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

  let listingTokenAccount = await splToken.getAssociatedTokenAddress(
    args.listing.account.mint,
    args.purchaser
  );
  if (!(await args.conn.getAccountInfo(listingTokenAccount))) {
    tx.add(
      splToken.createAssociatedTokenAccountInstruction(
        args.purchaser,
        listingTokenAccount,
        args.purchaser,
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
        user: args.purchaser,
        systemProgram: SystemProgram.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
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
  cashier: anchor.web3.PublicKey;
  receipt: {
    account: Receipt;
    publicKey: PublicKey;
  };
  listing: {
    account: Listing;
    publicKey: PublicKey;
  };
  government?: Government;
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
    feePayer: args.cashier,
  });

  tx.add(
    args.program.instruction.cash(listingMintAuthorityBump, realmMintBump, {
      accounts: {
        cashier: args.cashier,
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
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
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
  let sync_listing_sol_ix = splToken.createSyncNativeInstruction(
    this.realm_sol_deposit
  );
  let sync_realm_sol_ix = splToken.createSyncNativeInstruction(
    this.realm_sol_deposit
  );
  tx.add(sync_listing_sol_ix, sync_realm_sol_ix);

  return {
    tx,
  };
}

// export async function setListingPrice(
//   program: Program<Strangemood>,
//   user: PublicKey,
//   listingKey: PublicKey,
//   price: anchor.BN
// ) {
//   let tx = new Transaction();

//   tx.add(
//     program.instruction.setListingPrice(price, {
//       accounts: {
//         user,
//         listing: listingKey,
//         systemProgram: SystemProgram.programId,
//       },
//     })
//   );
//   return { tx };
// }

// export async function setListingUri(
//   program: Program<Strangemood>,
//   user: PublicKey,
//   listingKey: PublicKey,
//   uri: string
// ) {
//   let tx = new Transaction();

//   tx.add(
//     program.instruction.setListingUri(uri, {
//       accounts: {
//         user,
//         listing: listingKey,
//         systemProgram: SystemProgram.programId,
//       },
//     })
//   );
//   return { tx };
// }

// export async function setListingAvailability(
//   program: Program<Strangemood>,
//   user: PublicKey,
//   listingKey: PublicKey,
//   isAvailable: string
// ) {
//   let tx = new Transaction();

//   tx.add(
//     program.instruction.setListingAvailability(isAvailable, {
//       accounts: {
//         user,
//         listing: listingKey,
//         systemProgram: SystemProgram.programId,
//       },
//     })
//   );
//   return { tx };
// }

// export async function setListingDeposits(
//   program: Program<Strangemood>,
//   user: PublicKey,
//   listingKey: PublicKey,
//   voteDeposit: PublicKey,
//   solDeposit: PublicKey
// ) {
//   let tx = new Transaction();

//   tx.add(
//     program.instruction.setListingDeposits({
//       accounts: {
//         user,
//         listing: listingKey,

//         voteDeposit,
//         solDeposit,

//         systemProgram: SystemProgram.programId,
//       },
//     })
//   );
//   return { tx };
// }

// export async function setListingAuthority(
//   program: Program<Strangemood>,
//   user: PublicKey,
//   listingKey: PublicKey,
//   authority: PublicKey
// ) {
//   let tx = new Transaction();

//   tx.add(
//     program.instruction.setListingAuthority({
//       accounts: {
//         user,
//         listing: listingKey,
//         authority,
//         systemProgram: SystemProgram.programId,
//       },
//     })
//   );
//   return { tx };
// }

// export async function initListing(
//   program: Program<Strangemood>,
//   conn: Connection,
//   user: PublicKey,
//   price: anchor.BN,
//   uri: string,
//   network_constants: NET = MAINNET
// ): Promise<{ tx: Transaction; signers: Keypair[]; publicKey: PublicKey }> {
//   const mintKeypair = anchor.web3.Keypair.generate();

//   let tx = new Transaction();

//   let [listingMintAuthority, listingMintBump] = await pda.mint(
//     program.programId,
//     mintKeypair.publicKey
//   );
//   let [listingPDA, listingBump] = await pda.listing(
//     program.programId,
//     mintKeypair.publicKey
//   );

//   // Find or create an associated vote token account
//   let associatedVoteAddress = await splToken.Token.getAssociatedTokenAddress(
//     splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
//     splToken.TOKEN_PROGRAM_ID,
//     network_constants.STRANGEMOOD_FOUNDATION_MINT,
//     user
//   );
//   if (!(await conn.getAccountInfo(associatedVoteAddress))) {
//     tx.add(
//       splToken.Token.createAssociatedTokenAccountInstruction(
//         splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
//         splToken.TOKEN_PROGRAM_ID,
//         network_constants.STRANGEMOOD_FOUNDATION_MINT,
//         associatedVoteAddress,
//         user,
//         user
//       )
//     );
//   }

//   // Find or create an associated wrapped sol account
//   let associatedSolAddress = await splToken.Token.getAssociatedTokenAddress(
//     splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
//     splToken.TOKEN_PROGRAM_ID,
//     splToken.NATIVE_MINT,
//     user
//   );
//   if (!(await conn.getAccountInfo(associatedSolAddress))) {
//     tx.add(
//       splToken.Token.createAssociatedTokenAccountInstruction(
//         splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
//         splToken.TOKEN_PROGRAM_ID,
//         splToken.NATIVE_MINT,
//         associatedSolAddress,
//         user,
//         user
//       )
//     );
//   }

//   let init_instruction_ix = program.instruction.initListing(
//     listingMintBump,
//     listingBump,
//     price,
//     uri,
//     {
//       accounts: {
//         listing: listingPDA,
//         mint: mintKeypair.publicKey,
//         mintAuthorityPda: listingMintAuthority,
//         rent: SYSVAR_RENT_PUBKEY,
//         solDeposit: associatedSolAddress,
//         voteDeposit: associatedVoteAddress,
//         realm: network_constants.STRANGEMOOD_FOUNDATION_REALM,
//         governanceProgram: network_constants.GOVERNANCE_PROGRAM_ID,
//         charter: network_constants.STRANGEMOOD_FOUNDATION_CHARTER,
//         charterGovernance:
//           network_constants.STRANGEMOOD_FOUNDATION_CHARTER_GOVERNANCE,
//         tokenProgram: splToken.TOKEN_PROGRAM_ID,
//         user: user,
//         systemProgram: SystemProgram.programId,
//       },
//       signers: [mintKeypair],
//     }
//   );
//   tx.add(init_instruction_ix);

//   return {
//     tx,
//     signers: [mintKeypair],
//     publicKey: listingPDA,
//   };
// }

// export { MAINNET, TESTNET };
