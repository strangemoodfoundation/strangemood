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
import { idlAddress } from "@project-serum/anchor/dist/cjs/idl";

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
      args.program.programId
    );

  let returnTokenAccount = await splToken.getAssociatedTokenAddress(
    receiptInfo.account.mint,
    args.signer
  );

  const ix = args.program.instruction.cancel(
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
  currency: PublicKey;

  // The charter this listing is associated with
  charter: AccountInfo<Charter> | PublicKey;
}) {
  if (!args.uri || args.uri.length > 128) {
    throw new Error(
      "Listing's URI field must be a string less than 128 characters."
    );
  }

  const mintKeypair = anchor.web3.Keypair.generate();

  let instructions = [];

  let [listingMintAuthority, listingMintBump] = await pda.mint(
    args.program.programId,
    mintKeypair.publicKey
  );
  let [listingPDA, listingBump] = await pda.listing(
    args.program.programId,
    mintKeypair.publicKey
  );
  let charter = await asCharterInfo(args.program, args.charter);

  // Find or create an associated vote token account
  let associatedVoteAddress = await getAssociatedTokenAddress(
    charter.account.mint,
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
        charter.account.mint
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
    charter.publicKey,
    args.currency
  );

  let init_instruction_ix = args.program.instruction.initListing(
    listingMintBump,
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
        charter: charter.publicKey,
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
    args.program.provider.connection,
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
      args.program.programId
    );

  let purchaseTokenAccount = await splToken.getAssociatedTokenAddress(
    listingDeposit.mint,
    args.signer
  );

  // If the deposit account is wrapped SOL, and the user has SOL,
  // but DOESN'T have a wrapped SOL token account, then we should
  // just make an account for them and fund it if they have the funds.
  if (listingDeposit.mint.toString() === splToken.NATIVE_MINT.toString()) {
    let nativeBalance = await args.program.provider.connection.getBalance(
      args.signer
    );
    let total = listingInfo.account.price.mul(args.quantity);
    try {
      const wrappedSolAccount = await splToken.getAccount(
        args.program.provider.connection,
        purchaseTokenAccount
      );

      // If the user doesn't have enough SOL in their token account,
      // but has SOL, we should should transfer sol to their account.
      if (new anchor.BN(wrappedSolAccount.amount.toString()).lt(total)) {
        // If they don't have enough SOL in their wrapped and system accounts
        // then we should throw an error.
        let combinedBalance = new anchor.BN(nativeBalance).add(
          new anchor.BN(wrappedSolAccount.amount.toString())
        );
        if (combinedBalance.lt(total)) {
          throw new Error(
            `User cannot afford the purchase. Need=${total.toString()} Have=${combinedBalance.toString()}`
          );
        }

        // If they have SOL in two places, we could fix that for them.
        let remainder = total.sub(
          new anchor.BN(wrappedSolAccount.amount.toString())
        );
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: args.signer,
            toPubkey: purchaseTokenAccount,
            lamports: remainder.toNumber(),
          }),
          splToken.createSyncNativeInstruction(purchaseTokenAccount)
        );
      }
    } catch (err) {
      // If the user doesn't have an account, we should create one and fund it,
      // if they actually have the SOL to do so.
      if (new anchor.BN(nativeBalance).lt(total)) {
        throw new Error(
          `User cannot afford the purchase. Need=${total.toString()} Have=${nativeBalance}`
        );
      }

      instructions.push(
        splToken.createAssociatedTokenAccountInstruction(
          args.signer,
          purchaseTokenAccount,
          args.signer,
          splToken.NATIVE_MINT
        ),
        SystemProgram.transfer({
          fromPubkey: args.signer,
          toPubkey: purchaseTokenAccount,
          lamports: total.toNumber(),
        }),
        splToken.createSyncNativeInstruction(purchaseTokenAccount)
      );
    }
  }

  let purchase_ix = args.program.instruction.purchase(
    nonce,
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
    signers: [escrowKeypair],
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
}) {
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
  let charter = await args.program.account.charter.fetch(
    listingInfo.account.charter
  );

  let [listingMintAuthority, listingMintAuthorityBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), listingInfo.account.mint.toBuffer()],
      args.program.programId
    );

  let [realmMintAuthority, realmMintBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), charter.mint.toBuffer()],
      args.program.programId
    );

  let [escrowAuthority, escrowAuthorityBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("escrow"), receiptInfo.account.escrow.toBuffer()],
      args.program.programId
    );

  const listingDeposit = await splToken.getAccount(
    args.program.provider.connection,
    listingInfo.account.paymentDeposit
  );

  let [treasury_pda, treasury_bump] = await pda.treasury(
    args.program.programId,
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
          charterTreasuryDeposit: treasuryDeposit.deposit,
          charterTreasury: treasury_pda,
          charterVoteDeposit: charter.voteDeposit,
          charterMint: charter.mint,
          charterMintAuthority: realmMintAuthority,
          charter: listingInfo.account.charter,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          listingMint: listingInfo.account.mint,
          listingMintAuthority: listingMintAuthority,
        },
      }
    )
  );

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

export async function initCharterTreasury(args: {
  program: Program<Strangemood>;
  charter: PublicKey;
  authority: PublicKey;
  deposit: PublicKey;
  mint: PublicKey;
  scalarAmount: anchor.BN;
  scalarDecimals: number;
}) {
  let charter = await args.program.account.charter.fetch(args.charter);

  let [treasury_pda, treasury_bump] = await pda.treasury(
    args.program.programId,
    args.charter,
    args.mint
  );

  const ix = args.program.instruction.initCharterTreasury(
    treasury_bump,
    args.scalarAmount,
    args.scalarDecimals,
    {
      accounts: {
        treasury: treasury_pda,
        charter: args.charter,
        mint: args.mint,
        deposit: args.deposit,
        systemProgram: SystemProgram.programId,
        authority: charter.authority,
      },
    }
  );

  let instructions = [ix];
  return { instructions, treasury: treasury_pda };
}

export async function initCharter(args: {
  program: Program<Strangemood>;
  authority: PublicKey;
  voteDeposit: PublicKey;
  mint: PublicKey;
  signer: PublicKey;
  expansionAmount: anchor.BN;
  expansionDecimals: number;
  paymentContributionAmount: anchor.BN;
  paymentContributionDecimals: number;
  voteContributionAmount: anchor.BN;
  voteContributionDecimals: number;
  uri: string;
}) {
  if (!args.uri || args.uri.length > 128) {
    throw new Error(
      "Charter's URI field must be a string less than 128 characters."
    );
  }

  let instructions = [];

  let [charterPDA, charterBump] = await pda.charter(
    args.program.programId,
    args.mint
  );

  instructions.push(
    args.program.instruction.initCharter(
      args.expansionAmount, // Expansion amount
      args.expansionDecimals, // expansion decimals
      args.paymentContributionAmount, // pay contribution amount
      args.paymentContributionDecimals, // pay contribution decimals
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
