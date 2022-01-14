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
import { LOCALNET } from "../constants";
import {
  GovernanceConfig,
  VoteThresholdPercentage,
  VoteWeightSource,
} from "../governance/accounts";
import { pda } from "../pda";
const { SystemProgram, SYSVAR_RENT_PUBKEY } = anchor.web3;

export async function setupGovernance(
  provider: anchor.Provider,
  program: anchor.Program<Strangemood>
) {
  let vote_mint: splToken.Token;
  let realm: anchor.web3.PublicKey;
  let realm_vote_deposit: anchor.web3.PublicKey;
  let realm_sol_deposit: anchor.web3.PublicKey;
  let listing_sol_deposit: anchor.web3.PublicKey;
  let listing_vote_deposit: anchor.web3.PublicKey;
  let charter: {
    expansionRateAmount: anchor.BN;
    expansionRateDecimals: number;
    solContributionRateAmount: anchor.BN;
    solContributionRateDecimals: number;
    voteContributionRateAmount: anchor.BN;
    voteContributionRateDecimals: number;
    authority: anchor.web3.PublicKey;
    realmSolDeposit: anchor.web3.PublicKey;
    realmVoteDeposit: anchor.web3.PublicKey;
    uri: string;
  };
  let charterPDA: anchor.web3.PublicKey;
  let charter_governance: anchor.web3.PublicKey;
  let realmMintAuthority: anchor.web3.PublicKey;
  let realmMintBump: number;
  let realm_vote_deposit_governance: anchor.web3.PublicKey;
  let realm_sol_deposit_governance: anchor.web3.PublicKey;

  let governance_program = await provider.connection.getAccountInfo(
    LOCALNET.GOVERNANCE_PROGRAM_ID
  );
  assert.ok(
    governance_program && governance_program.executable,
    "The governance program doesn't exist. You may need to build it first before running tests:\n\tcd ./solana-program-library/governance/program && cargo build-bpf && cd ../../../"
  );

  const realmAuthority = anchor.web3.Keypair.generate();

  // Give the realmAuthority enough to make a mint and
  // some associated accounts
  let lamports = anchor.web3.LAMPORTS_PER_SOL;
  let signature = await program.provider.connection.requestAirdrop(
    realmAuthority.publicKey,
    lamports
  );
  await program.provider.connection.confirmTransaction(signature);

  // Create a mint
  vote_mint = await splToken.Token.createMint(
    program.provider.connection,
    realmAuthority,
    realmAuthority.publicKey,
    realmAuthority.publicKey,
    9,
    splToken.TOKEN_PROGRAM_ID
  );
  // Create an account we can use to store some initial supply
  listing_vote_deposit = await createAssociatedTokenAccount(
    program,
    provider,
    vote_mint.publicKey
  );
  // mint some initial tokens so we can create governances
  await vote_mint.mintTo(listing_vote_deposit, realmAuthority, [], 3000);

  // Hand over the mint to the strangemood program, by assigning the
  // authority to a PDA
  let [ra, rb] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("mint"), vote_mint.publicKey.toBuffer()],
    program.programId
  );
  realmMintAuthority = ra;
  realmMintBump = rb;
  await vote_mint.setAuthority(
    vote_mint.publicKey,
    realmMintAuthority,
    "MintTokens",
    realmAuthority,
    []
  );
  await vote_mint.setAuthority(
    vote_mint.publicKey,
    realmMintAuthority,
    "FreezeAccount",
    realmAuthority,
    []
  );

  realm = await createGovernanceRealm(
    program,
    realmAuthority,
    vote_mint.publicKey
  );
  realm_vote_deposit = (await createTokenAccount(program, vote_mint.publicKey))
    .publicKey;
  realm_sol_deposit = (await createTokenAccount(program, splToken.NATIVE_MINT))
    .publicKey;
  listing_sol_deposit = await createAssociatedTokenAccount(
    program,
    provider,
    splToken.NATIVE_MINT
  );

  // Create charter
  let [myCharterPDA, charterBump] = await pda.charter(
    program.programId,
    LOCALNET.GOVERNANCE_PROGRAM_ID,
    realm
  );
  charterPDA = myCharterPDA;
  await program.rpc.initCharter(
    charterBump,
    new anchor.BN(30), // Expansion amount
    0, // expansion decimals
    new anchor.BN(6), // sol contribution amount
    3, // sol contribution decimals
    new anchor.BN(2), // vote contribution amount
    1, // vote contribution decimals
    "https://strangemood.org",
    {
      accounts: {
        charter: charterPDA,
        authority: program.provider.wallet.publicKey,
        realmSolDeposit: realm_sol_deposit,
        realmVoteDeposit: realm_vote_deposit,
        realm,
        governanceProgram: LOCALNET.GOVERNANCE_PROGRAM_ID,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
    }
  );
  charter = (await program.account.charter.fetch(charterPDA)) as any;

  realm_sol_deposit_governance =await createTokenGovernanceForDepositAccounts(
    program,
    provider.wallet.publicKey,
    listing_vote_deposit,
    realm,
    realm_sol_deposit,
    vote_mint
  );
  realm_vote_deposit_governance = await createTokenGovernanceForDepositAccounts(
    program,
    provider.wallet.publicKey,
    listing_vote_deposit,
    realm,
    realm_vote_deposit,
    vote_mint
  );

  // Bind the charter to the realm
  charter_governance = await createCharterGovernance(
    program,
    listing_vote_deposit,
    realm,
    charterPDA,
    vote_mint
  );

  return {
    vote_mint,
    realm,
    realm_vote_deposit,
    realm_sol_deposit,
    listing_sol_deposit,
    listing_vote_deposit,
    charter,
    charter_pda: charterPDA,
    charter_governance,
    realm_mint_authority: realmMintAuthority,
    realm_mint_bump: realmMintBump,
    realm_sol_deposit_governance,
    realm_vote_deposit_governance,
  };
}

export async function createGovernanceRealm(
  program: anchor.Program<Strangemood>,
  realmAuthority: anchor.web3.Keypair,
  mint: anchor.web3.PublicKey
) {
  // Give the realmAuthority enough to make a mint and
  // some associated accounts
  let lamports = anchor.web3.LAMPORTS_PER_SOL;
  let signature = await program.provider.connection.requestAirdrop(
    realmAuthority.publicKey,
    lamports
  );
  await program.provider.connection.confirmTransaction(signature);

  const [realm_ix, realm] = await createRealm({
    authority: realmAuthority.publicKey,
    communityMint: mint,
    payer: realmAuthority.publicKey,
    name: "test",
    governanceProgramId: LOCALNET.GOVERNANCE_PROGRAM_ID,
  });

  let tx = new anchor.web3.Transaction({
    feePayer: realmAuthority.publicKey,
  });
  tx.add(realm_ix);

  await anchor.web3.sendAndConfirmTransaction(program.provider.connection, tx, [
    realmAuthority,
  ]);

  return realm;
}

export async function createCharterGovernance(
  program: anchor.Program<Strangemood>,
  userVoteDeposit: anchor.web3.PublicKey,
  realm: anchor.web3.PublicKey,
  charter: anchor.web3.PublicKey,
  communityMint: splToken.Token
) {
  let [deposit_ix] = await depositGovernanceTokens({
    amount: new anchor.BN(1000),
    realm,
    governanceProgramId: LOCALNET.GOVERNANCE_PROGRAM_ID,
    governingTokenSource: userVoteDeposit,
    governingTokenMint: communityMint.publicKey,
    governingTokenOwner: program.provider.wallet.publicKey,
    transferAuthority: program.provider.wallet.publicKey,
    payer: program.provider.wallet.publicKey,
  });

  let [ix, charter_governance] = await createAccountGovernance({
    authority: program.provider.wallet.publicKey,
    governanceProgramId: LOCALNET.GOVERNANCE_PROGRAM_ID,
    realm: realm,
    governedAccount: charter,
    config: new GovernanceConfig({
      voteThresholdPercentage: new VoteThresholdPercentage({ value: 60 }),
      minCommunityTokensToCreateProposal: new anchor.BN(1),
      minInstructionHoldUpTime: getTimestampFromDays(1),
      maxVotingTime: getTimestampFromDays(3),
      voteWeightSource: VoteWeightSource.Deposit,
      minCouncilTokensToCreateProposal: new anchor.BN(1),
    }),
    governingTokenOwner: program.provider.wallet.publicKey,
    governingTokenMint: communityMint.publicKey,
    payer: program.provider.wallet.publicKey,
  });
  let gov_tx = new anchor.web3.Transaction();
  gov_tx.add(deposit_ix);
  gov_tx.add(ix);
  await program.provider.send(gov_tx, []);

  return charter_governance;
}

async function createTokenGovernanceForDepositAccounts(
  program: anchor.Program<Strangemood>,
  user: anchor.web3.PublicKey,
  userVoteDeposit: anchor.web3.PublicKey,
  realm: anchor.web3.PublicKey,
  tokenAccountToBeGoverned: anchor.web3.PublicKey,
  communityMint: splToken.Token
) {
  let [deposit_ix] = await depositGovernanceTokens({
    amount: new anchor.BN(1000),
    realm,
    governanceProgramId: LOCALNET.GOVERNANCE_PROGRAM_ID,
    governingTokenSource: userVoteDeposit,
    governingTokenMint: communityMint.publicKey,
    governingTokenOwner: program.provider.wallet.publicKey,
    transferAuthority: program.provider.wallet.publicKey,
    payer: program.provider.wallet.publicKey,
  });

  let [ix, charter_governance] = await createTokenGovernance({
    authority: program.provider.wallet.publicKey,
    governanceProgramId: LOCALNET.GOVERNANCE_PROGRAM_ID,
    realm: realm,
    tokenAccountToBeGoverned: tokenAccountToBeGoverned,
    tokenOwner: user,
    transferTokenOwner: true,
    config: new GovernanceConfig({
      voteThresholdPercentage: new VoteThresholdPercentage({ value: 60 }),
      minCommunityTokensToCreateProposal: new anchor.BN(1),
      minInstructionHoldUpTime: getTimestampFromDays(1),
      maxVotingTime: getTimestampFromDays(3),
      voteWeightSource: VoteWeightSource.Deposit,
      minCouncilTokensToCreateProposal: new anchor.BN(1),
    }),
    governingTokenOwner: program.provider.wallet.publicKey,
    governingTokenMint: communityMint.publicKey,
    payer: program.provider.wallet.publicKey,
  });
  let gov_tx = new anchor.web3.Transaction();
  gov_tx.add(deposit_ix);
  gov_tx.add(ix);
  await program.provider.send(gov_tx, []);

  return charter_governance;
}

async function getTokenAccount(
  program: anchor.Program<Strangemood>,
  mint: anchor.web3.PublicKey,
  account: anchor.web3.PublicKey
) {
  const dummy = anchor.web3.Keypair.generate();
  const token = new splToken.Token(
    program.provider.connection,
    mint,
    splToken.TOKEN_PROGRAM_ID,
    dummy
  );

  return token.getAccountInfo(account);
}

export async function createWrappedSolTokenAccount(
  program: anchor.Program<Strangemood>,
  lamports: number
) {
  // Allocate memory for the account
  const balanceNeeded = await splToken.Token.getMinBalanceRentForExemptAccount(
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
    splToken.Token.createInitAccountInstruction(
      splToken.TOKEN_PROGRAM_ID,
      splToken.NATIVE_MINT,
      newAccount.publicKey,
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
  let associatedTokenAccountAddress =
    await splToken.Token.getAssociatedTokenAddress(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      mint,
      program.provider.wallet.publicKey
    );
  let tx = new anchor.web3.Transaction({
    feePayer: provider.wallet.publicKey,
  });
  tx.add(
    splToken.Token.createAssociatedTokenAccountInstruction(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      mint,
      associatedTokenAccountAddress,
      program.provider.wallet.publicKey,
      program.provider.wallet.publicKey
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
  await program.provider.connection.requestAirdrop(
    program.provider.wallet.publicKey,
    lamports
  );

  let tx = new anchor.web3.Transaction({
    feePayer: program.provider.wallet.publicKey,
  });

  await program.provider.send(tx, []);
}

export async function createTokenAccount(
  program: anchor.Program<Strangemood>,
  mint: anchor.web3.PublicKey
) {
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
      lamports: await splToken.Token.getMinBalanceRentForExemptAccount(conn),
      space: splToken.AccountLayout.span,
      programId: splToken.TOKEN_PROGRAM_ID,
    })
  );
  tx.add(
    splToken.Token.createInitAccountInstruction(
      splToken.TOKEN_PROGRAM_ID,
      mint,
      keypair.publicKey,
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

  let associatedTokenAccountAddress =
    await splToken.Token.getAssociatedTokenAddress(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      mint,
      keypair.publicKey
    );
  let tx = new anchor.web3.Transaction({
    feePayer: keypair.publicKey,
  });
  tx.add(
    splToken.Token.createAssociatedTokenAccountInstruction(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      mint,
      associatedTokenAccountAddress,
      keypair.publicKey,
      keypair.publicKey
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
