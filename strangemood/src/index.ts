import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
export { Strangemood } from "../target/types/strangemood";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import { Strangemood } from "../target/types/strangemood";
import { pda as _pda } from "./pda";
import { MAINNET, TESTNET } from "./constants";
const { web3 } = anchor;
const { SystemProgram, SYSVAR_RENT_PUBKEY } = web3;

export const pda = _pda;

export async function fetchStrangemoodProgram(
  provider: anchor.Provider,
  programId = MAINNET.STRANGEMOOD_PROGRAM_ID
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

async function createWrappedSolTokenAccountForPurchase(
  conn: Connection,
  user: PublicKey,
  lamports: number
): Promise<[anchor.web3.TransactionInstruction[], Keypair]> {
  // Allocate memory for the account
  const balanceNeeded = await splToken.Token.getMinBalanceRentForExemptAccount(
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
    splToken.Token.createInitAccountInstruction(
      splToken.TOKEN_PROGRAM_ID,
      splToken.NATIVE_MINT,
      newAccount.publicKey,
      user
    )
  );

  return [instructions, newAccount];
}

async function createAssociatedTokenAccount(
  mint: PublicKey,
  user: PublicKey
): Promise<[anchor.web3.TransactionInstruction, PublicKey]> {
  let associatedTokenAccountAddress =
    await splToken.Token.getAssociatedTokenAddress(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      mint,
      user
    );

  let ix = splToken.Token.createAssociatedTokenAccountInstruction(
    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    splToken.TOKEN_PROGRAM_ID,
    mint,
    associatedTokenAccountAddress,
    user,
    user
  );

  return [ix, associatedTokenAccountAddress];
}

export async function purchaseListing(
  program: Program<Strangemood>,
  conn: Connection,
  user: PublicKey,
  listing: { account: Listing; publicKey: PublicKey }
): Promise<{ tx: Transaction; signers: Keypair[] }> {
  let [listingMintAuthority, listingMintBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), listing.account.mint.toBuffer()],
      program.programId
    );

  let [listingPDA, _] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("listing"), listing.account.mint.toBuffer()],
    program.programId
  );

  let [realmAuthority, realmMintBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), MAINNET.STRANGEMOOD_FOUNDATION_MINT.toBuffer()],
      program.programId
    );

  let tx = new Transaction();

  // Create a temp sol account to purchase with
  const [bagIxes, bag] = await createWrappedSolTokenAccountForPurchase(
    conn,
    user,
    listing.account.price.toNumber()
  );
  tx.add(...bagIxes);

  // Create an associated token account to buy with
  let [listingAccountIx, purchasersListingAddress] =
    await createAssociatedTokenAccount(listing.account.mint, user);
  tx.add(listingAccountIx);

  let purchaseIx = program.instruction.purchaseListing(
    listingMintBump,
    realmMintBump,
    {
      accounts: {
        listing: listingPDA,
        purchasersSolTokenAccount: bag.publicKey,
        purchasersListingTokenAccount: purchasersListingAddress,
        listingsSolDeposit: listing.account.solDeposit,
        listingsVoteDeposit: listing.account.voteDeposit,
        listingMint: listing.account.mint,
        listingMintAuthority: listingMintAuthority,
        realmSolDeposit: MAINNET.STRANGEMOOD_FOUNDATION_SOL_ACCOUNT,
        realmSolDepositGovernance:
          MAINNET.STRANGEMOOD_FOUNDATION_SOL_ACCOUNT_GOVERNANCE,
        realmVoteDeposit: MAINNET.STRANGEMOOD_FOUNDATION_VOTE_ACCOUNT,
        realmVoteDepositGovernance:
          MAINNET.STRANGEMOOD_FOUNDATION_VOTE_ACCOUNT_GOVERNANCE,
        realmMint: MAINNET.STRANGEMOOD_FOUNDATION_MINT,
        realmMintAuthority: realmAuthority,
        governanceProgram: MAINNET.GOVERNANCE_PROGRAM_ID,
        realm: MAINNET.STRANGEMOOD_FOUNDATION_REALM,
        charterGovernance: MAINNET.STRANGEMOOD_FOUNDATION_CHARTER_GOVERNANCE,
        charter: MAINNET.STRANGEMOOD_FOUNDATION_CHARTER,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        user: user,
        systemProgram: SystemProgram.programId,
      },
    }
  );
  tx.add(purchaseIx);

  // Close the bag account, and move the remainder that was paid for rent
  // to the user's SOL wallet.
  tx.add(
    splToken.Token.createCloseAccountInstruction(
      splToken.TOKEN_PROGRAM_ID,
      bag.publicKey,
      user,
      user,
      []
    )
  );

  return {
    tx,
    signers: [bag],
  };
}

export async function initListing(
  program: Program<Strangemood>,
  conn: Connection,
  user: PublicKey,
  price: anchor.BN,
  uri: string
): Promise<{ tx: Transaction; signers: Keypair[]; publicKey: PublicKey }> {
  const mintKeypair = anchor.web3.Keypair.generate();

  let tx = new Transaction();

  let [listingMintAuthority, listingMintBump] = await pda.mint(
    program.programId,
    mintKeypair.publicKey
  );
  let [listingPDA, listingBump] = await pda.listing(
    program.programId,
    mintKeypair.publicKey
  );

  // Find or create an associated vote token account
  let associatedVoteAddress = await splToken.Token.getAssociatedTokenAddress(
    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    splToken.TOKEN_PROGRAM_ID,
    MAINNET.STRANGEMOOD_FOUNDATION_MINT,
    user
  );
  if (!(await conn.getAccountInfo(associatedVoteAddress))) {
    tx.add(
      splToken.Token.createAssociatedTokenAccountInstruction(
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        splToken.TOKEN_PROGRAM_ID,
        MAINNET.STRANGEMOOD_FOUNDATION_MINT,
        associatedVoteAddress,
        user,
        user
      )
    );
  }

  // Find or create an associated wrapped sol account
  let associatedSolAddress = await splToken.Token.getAssociatedTokenAddress(
    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    splToken.TOKEN_PROGRAM_ID,
    splToken.NATIVE_MINT,
    user
  );
  if (!(await conn.getAccountInfo(associatedSolAddress))) {
    tx.add(
      splToken.Token.createAssociatedTokenAccountInstruction(
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        splToken.TOKEN_PROGRAM_ID,
        splToken.NATIVE_MINT,
        associatedSolAddress,
        user,
        user
      )
    );
  }

  let init_instruction_ix = program.instruction.initListing(
    listingMintBump,
    listingBump,
    price,
    uri,
    {
      accounts: {
        listing: listingPDA,
        mint: mintKeypair.publicKey,
        mintAuthorityPda: listingMintAuthority,
        rent: SYSVAR_RENT_PUBKEY,
        solDeposit: associatedSolAddress,
        voteDeposit: associatedVoteAddress,
        realm: MAINNET.STRANGEMOOD_FOUNDATION_REALM,
        governanceProgram: MAINNET.GOVERNANCE_PROGRAM_ID,
        charter: MAINNET.STRANGEMOOD_FOUNDATION_CHARTER,
        charterGovernance: MAINNET.STRANGEMOOD_FOUNDATION_CHARTER_GOVERNANCE,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        user: user,
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

export { MAINNET, TESTNET };
