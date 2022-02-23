import assert from "assert";
import { PublicKey } from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import * as anchor from "@project-serum/anchor";
import { Program, splitArgsAndCtx } from "@project-serum/anchor";
import { Strangemood } from "../../target/types/strangemood";
import { cash, makeReceiptNonce } from "..";
import { createMint, createTokenAccount } from "./utils";
import { pda } from "../pda";
import { MAINNET } from "../constants";
import {
  initCharter,
  createCharterTreasury,
  initCashier,
} from "./instructions";
import {
  AuthorityType,
  createMintToInstruction,
  createSetAuthorityInstruction,
  mintTo,
  transfer,
} from "@solana/spl-token";
const { SystemProgram, Keypair, SYSVAR_CLOCK_PUBKEY, Transaction } =
  anchor.web3;

describe("Staking Cashiers", () => {
  const provider = anchor.Provider.env();
  // Configure the client to use the local cluster.
  anchor.setProvider(provider);
  const program = anchor.workspace.Strangemood as Program<Strangemood>;

  it("can init a charter, init a cashier, stake voting tokens, and then burn them", async () => {
    const mint = await createMint(program);
    const reserve = await createTokenAccount(program, mint.publicKey);

    // Create a temporary account to mint tokens to
    const temp = await createTokenAccount(program, mint.publicKey);

    // Mint some tokens to the stake account
    const ix = createMintToInstruction(
      mint.publicKey,
      temp.publicKey,
      program.provider.wallet.publicKey,
      100
    );
    await program.provider.send(new Transaction().add(ix));

    // Create a charter
    const [charter_pda, _] = await pda.charter(
      program.programId,
      mint.publicKey
    );
    await program.methods
      .initCharter(
        10,
        0.01,
        0.2,
        new anchor.BN(10),
        new anchor.BN(100),
        "ipfs://charter"
      )
      .accounts({
        charter: charter_pda,
        mint: mint.publicKey,
        authority: program.provider.wallet.publicKey,
        reserve: reserve.publicKey,
        user: program.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    const charter = await program.account.charter.fetch(charter_pda);

    // Create a cashier
    const cashier = await initCashier(
      program,
      { account: charter, publicKey: charter_pda },
      "ipfs://cashier"
    );

    // Stake some tokens in the cashier
    const transferIx = splToken.createTransferInstruction(
      temp.publicKey,
      cashier.stake.publicKey,
      program.provider.wallet.publicKey,
      100
    );
    await program.provider.send(new Transaction().add(transferIx));

    // Give the charter authority over the mint
    const [mint_authority, __] = await pda.mint_authority(
      program.programId,
      charter.mint
    );
    const setAuthorityIx = createSetAuthorityInstruction(
      mint.publicKey,
      program.provider.wallet.publicKey,
      AuthorityType.MintTokens,
      mint_authority
    );
    await program.provider.send(new Transaction().add(setAuthorityIx));

    assert.equal(
      (
        await splToken.getMint(program.provider.connection, mint.publicKey)
      ).mintAuthority.toString(),
      mint_authority.toString()
    );

    // get the balance of the stake token account
    let before = await splToken.getAccount(
      program.provider.connection,
      cashier.stake.publicKey
    );
    assert.equal(before.amount, 100);

    const [stake_authority, stake_authority_bump] = await pda.token_authority(
      program.programId,
      cashier.stake.publicKey
    );

    // Burn 50 stake tokens
    await program.methods
      .burnCashierStake(stake_authority_bump, new anchor.BN(50))
      .accounts({
        charter: charter_pda,
        cashier: cashier.publicKey,
        mint: mint.publicKey,
        authority: program.provider.wallet.publicKey,
        stake: cashier.stake.publicKey,
        stakeAuthority: stake_authority,
      })
      .rpc();

    // get the balance of the stake token account
    let after = await splToken.getAccount(
      program.provider.connection,
      cashier.stake.publicKey
    );
    assert.equal(after.amount, 50);
  });
});
