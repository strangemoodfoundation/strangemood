import assert from "assert";
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Strangemood } from "../../target/types/strangemood";
import * as splToken from "@solana/spl-token";
import {
  createAccountGovernance,
  createRealm,
  createTokenGovernance,
  depositGovernanceTokens,
} from "../instructions";
import {
  GovernanceConfig,
  VoteThresholdPercentage,
  VoteWeightSource,
} from "../governance/accounts";
import { pda } from "../pda";
const { SystemProgram, SYSVAR_RENT_PUBKEY } = anchor.web3;

export async function createWrappedSolTokenAccount(
  program: anchor.Program<Strangemood>,
  lamports: number
) {
  // Allocate memory for the account
  const balanceNeeded = await splToken.getMinimumBalanceForRentExemptAccount(
    program.provider.connection
  );

  // Create a new account
  const newAccount = anchor.web3.Keypair.generate();
  const transaction = new anchor.web3.Transaction();
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: program.provider.wallet.publicKey,
      newAccountPubkey: newAccount.publicKey,
      lamports: balanceNeeded,
      space: splToken.AccountLayout.span,
      programId: splToken.TOKEN_PROGRAM_ID,
    })
  );

  // Send lamports to it (these will be wrapped into native tokens by the token program)
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: program.provider.wallet.publicKey,
      toPubkey: newAccount.publicKey,
      lamports: lamports,
    })
  );

  // Assign the new account to the native token mint.
  // the account will be initialized with a balance equal to the native token balance.
  // (i.e. amount)
  transaction.add(
    splToken.createInitializeAccountInstruction(
      newAccount.publicKey,
      splToken.NATIVE_MINT,
      program.provider.wallet.publicKey
    )
  );

  await program.provider.send(transaction, [newAccount]);
  return newAccount;
}

export async function createAssociatedTokenAccount(
  program: anchor.Program<Strangemood>,
  provider: anchor.Provider,
  mint: anchor.web3.PublicKey
) {
  let associatedTokenAccountAddress = await splToken.getAssociatedTokenAddress(
    mint,
    program.provider.wallet.publicKey
  );
  let tx = new anchor.web3.Transaction({
    feePayer: provider.wallet.publicKey,
  });
  tx.add(
    splToken.createAssociatedTokenAccountInstruction(
      program.provider.wallet.publicKey,
      associatedTokenAccountAddress,
      program.provider.wallet.publicKey,
      mint
    )
  );
  await program.provider.send(tx, []);
  return associatedTokenAccountAddress;
}

export async function requestAirdrop(
  program: anchor.Program<Strangemood>,
  to: anchor.web3.PublicKey
) {
  let lamports = anchor.web3.LAMPORTS_PER_SOL;
  await program.provider.connection.requestAirdrop(to, lamports);

  let tx = new anchor.web3.Transaction({
    feePayer: program.provider.wallet.publicKey,
  });

  const sig = await program.provider.send(tx, []);
  await program.provider.connection.confirmTransaction(sig);
}

export async function createTokenAccount(
  program: anchor.Program<Strangemood>,
  mint: anchor.web3.PublicKey
) {
  const conn = program.provider.connection;
  let lamports = anchor.web3.LAMPORTS_PER_SOL;

  let tx = new anchor.web3.Transaction({
    feePayer: program.provider.wallet.publicKey,
  });

  let keypair = anchor.web3.Keypair.generate();

  tx.add(
    SystemProgram.createAccount({
      fromPubkey: program.provider.wallet.publicKey,
      newAccountPubkey: keypair.publicKey,
      lamports: await splToken.getMinimumBalanceForRentExemptAccount(conn),
      space: splToken.AccountLayout.span,
      programId: splToken.TOKEN_PROGRAM_ID,
    })
  );
  tx.add(
    splToken.createInitializeAccountInstruction(
      keypair.publicKey,
      mint,
      program.provider.wallet.publicKey
    )
  );

  await program.provider.send(tx, [keypair]);
  return keypair;
}

export async function createAssociatedTokenAccountForKeypair(
  program: anchor.Program<Strangemood>,
  keypair: anchor.web3.Keypair,
  mint: anchor.web3.PublicKey
) {
  const conn = program.provider.connection;
  let lamports = anchor.web3.LAMPORTS_PER_SOL;
  let signature = await program.provider.connection.requestAirdrop(
    keypair.publicKey,
    lamports
  );
  await conn.confirmTransaction(signature);

  let associatedTokenAccountAddress = await splToken.getAssociatedTokenAddress(
    mint,
    keypair.publicKey
  );
  let tx = new anchor.web3.Transaction({
    feePayer: keypair.publicKey,
  });
  tx.add(
    splToken.createAssociatedTokenAccountInstruction(
      keypair.publicKey,
      associatedTokenAccountAddress,
      keypair.publicKey,
      mint
    )
  );

  await anchor.web3.sendAndConfirmTransaction(program.provider.connection, tx, [
    keypair,
  ]);

  return associatedTokenAccountAddress;
}

export function getTimestampFromDays(days: number): number {
  const SECONDS_PER_DAY = 86400;

  return days * SECONDS_PER_DAY;
}

export async function createMint(program: anchor.Program<any>) {
  const conn = program.provider.connection;
  let lamports = anchor.web3.LAMPORTS_PER_SOL;
  let signature = await program.provider.connection.requestAirdrop(
    program.provider.wallet.publicKey,
    lamports
  );

  let tx = new anchor.web3.Transaction({
    feePayer: program.provider.wallet.publicKey,
  });

  let keypair = anchor.web3.Keypair.generate();

  tx.add(
    SystemProgram.createAccount({
      fromPubkey: program.provider.wallet.publicKey,
      newAccountPubkey: keypair.publicKey,
      lamports: await splToken.getMinimumBalanceForRentExemptMint(conn),
      space: splToken.MintLayout.span,
      programId: splToken.TOKEN_PROGRAM_ID,
    })
  );
  tx.add(
    splToken.createInitializeMintInstruction(
      keypair.publicKey,
      0,
      program.provider.wallet.publicKey,
      program.provider.wallet.publicKey
    )
  );

  await program.provider.send(tx, [keypair]);
  return keypair;
}
