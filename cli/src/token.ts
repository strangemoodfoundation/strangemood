import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import * as splToken from "@solana/spl-token";
import { getMinimumBalanceForRentExemptMint } from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { create } from "domain";

export async function withMint(
  program: Program<any>,
  decimals: number,
  vanityKeypair?: Keypair
) {
  let keypair = vanityKeypair || anchor.web3.Keypair.generate();

  let create_ix = SystemProgram.createAccount({
    fromPubkey: program.provider.wallet.publicKey,
    newAccountPubkey: keypair.publicKey,
    lamports: await splToken.getMinimumBalanceForRentExemptMint(
      program.provider.connection
    ),
    space: splToken.MintLayout.span,
    programId: splToken.TOKEN_PROGRAM_ID,
  });

  let ix = splToken.createInitializeMintInstruction(
    keypair.publicKey,
    decimals,
    program.provider.wallet.publicKey,
    program.provider.wallet.publicKey
  );

  let ixs = [create_ix, ix];

  return { ixs, keypair };
}

export async function withMintTo(
  program: Program<any>,
  mint: PublicKey,
  to: PublicKey,
  amount: bigint
) {
  let ix = splToken.createMintToInstruction(
    mint,
    to,
    program.provider.wallet.publicKey,
    amount
  );
  return { ix };
}

export async function withTokenAccount(program: Program<any>, mint: PublicKey) {
  let keypair = anchor.web3.Keypair.generate();
  let create_ix = SystemProgram.createAccount({
    fromPubkey: program.provider.wallet.publicKey,
    newAccountPubkey: keypair.publicKey,
    lamports: await splToken.getMinimumBalanceForRentExemptAccount(
      program.provider.connection
    ),
    space: splToken.AccountLayout.span,
    programId: splToken.TOKEN_PROGRAM_ID,
  });
  let ix = splToken.createInitializeAccountInstruction(
    keypair.publicKey,
    mint,
    program.provider.wallet.publicKey
  );

  return { ixs: [create_ix, ix], keypair };
}

export async function withAssociatedTokenAccount(
  program: Program<any>,
  mint: PublicKey,
  user: PublicKey
) {
  let address = await splToken.getAssociatedTokenAddress(mint, user);

  let ix = splToken.createAssociatedTokenAccountInstruction(
    program.provider.wallet.publicKey,
    address,
    user,
    mint
  );

  return { ix, address };
}

export async function withSetMintAuthority(
  program: Program<any>,
  mint: PublicKey,
  newAuthority: PublicKey
) {
  let ix = splToken.createSetAuthorityInstruction(
    mint,
    program.provider.wallet.publicKey,
    splToken.AuthorityType.MintTokens,
    newAuthority
  );

  return { ix };
}

// Airdrops to the user if they're on testnet and have less than one SOL.
export async function maybeAirdrop(program: Program<any>, net: string) {
  if (net === "mainnet-beta") {
    return;
  }

  const balance = await program.provider.connection.getBalance(
    program.provider.wallet.publicKey
  );
  if (balance < LAMPORTS_PER_SOL) {
    const sig = await program.provider.connection.requestAirdrop(
      program.provider.wallet.publicKey,
      LAMPORTS_PER_SOL
    );
    await program.provider.connection.confirmTransaction(sig);
  }
}
