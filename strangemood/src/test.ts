import * as solana from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import fs from "fs/promises";
import { Strangemood } from ".";
import {
  createAccountGovernance,
  createRealm,
  createTokenGovernance,
  depositGovernanceTokens,
} from "./instructions";
import * as anchor from "@project-serum/anchor";
import { pda } from "./pda";
import {
  GovernanceConfig,
  VoteThresholdPercentage,
  VoteWeightSource,
} from "./governance/accounts";
import { bindConstructorLayout } from "@solana/buffer-layout";
import { TESTNET } from "./constants";
const { SystemProgram, SYSVAR_RENT_PUBKEY } = anchor.web3;

async function doRealm(params: {
  rpc: string;
  governance_program_id: anchor.web3.PublicKey;
  realm_mint: anchor.web3.PublicKey;
}) {
  const connection = new solana.Connection(params.rpc);

  const data = await fs.readFile("/home/ubuntu/.config/solana/id.json", "utf8");
  const signer = solana.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(data) as number[])
  );

  const tx = new solana.Transaction();

  const [realm_ix, realm] = await createRealm({
    authority: signer.publicKey,
    communityMint: params.realm_mint,
    payer: signer.publicKey,
    name: new Date().toISOString(),
    governanceProgramId: params.governance_program_id,
  });

  await sleep(1500);

  tx.add(realm_ix);

  let sig = await connection.sendTransaction(tx, [signer]);
  await sleep(2000);
  await connection.confirmTransaction(sig, "finalized");

  return {
    realm,
  };
}

async function doCharter(params: {
  rpc: string;
  governance_program_id: anchor.web3.PublicKey;
  realm_mint: anchor.web3.PublicKey;
  realm: anchor.web3.PublicKey;
  realm_vote_deposit: anchor.web3.PublicKey;
  realm_sol_deposit: anchor.web3.PublicKey;
}) {
  if (!process.env.ANCHOR_WALLET) {
    throw new Error("You need to do ANCHOR_WALLET=xyz node ...");
  }
  const provider = anchor.Provider.local(params.rpc);
  anchor.setProvider(provider);
  const program = anchor.workspace.Strangemood as anchor.Program<Strangemood>;

  await sleep(1000);

  // Create charter
  let [charterPDA, charterBump] = await pda.charter(
    program.programId,
    params.governance_program_id,
    params.realm
  );
  console.log("charter", charterPDA.toString());

  let realm_vote_deposit = params.realm_vote_deposit;
  console.log("realm vote deposit", realm_vote_deposit.toString());
  // let realm_sol_deposit = await createAssociatedTokenAccount(
  //   program,
  //   provider,
  //   splToken.NATIVE_MINT
  // );
  let realm_sol_deposit = params.realm_sol_deposit;
  console.log("realm sol deposit", realm_sol_deposit.toString());

  await sleep(500);

  await program.rpc.initCharter(
    charterBump,
    new anchor.BN(30), // Expansion amount
    0, // expansion decimals
    new anchor.BN(6), // sol contribution amount
    3, // sol contribution decimals
    new anchor.BN(2), // vote contribution amount
    1, // vote contribution decimals
    "https://testnet.strangemood.org",
    {
      accounts: {
        charter: charterPDA,
        authority: program.provider.wallet.publicKey,
        realmSolDeposit: realm_sol_deposit,
        realmVoteDeposit: realm_vote_deposit,
        realm: params.realm,
        governanceProgram: params.governance_program_id,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
    }
  );

  return {
    charter: charterPDA,
    realm_sol_deposit,
    realm_vote_deposit,
  };
}

function getTimestampFromDays(days: number): number {
  const SECONDS_PER_DAY = 86400;

  return days * SECONDS_PER_DAY;
}

async function createCharterGovernance(
  governanceProgramId: anchor.web3.PublicKey,
  program: anchor.Program<Strangemood>,
  userVoteDeposit: anchor.web3.PublicKey,
  realm: anchor.web3.PublicKey,
  charter: anchor.web3.PublicKey,
  communityMint: splToken.Token
) {
  await sleep(500);
  console.log("Depositing governance tokens from", userVoteDeposit.toString());
  let [deposit_ix] = await depositGovernanceTokens({
    amount: new anchor.BN(1000),
    realm,
    governanceProgramId: governanceProgramId,
    governingTokenSource: userVoteDeposit,
    governingTokenMint: communityMint.publicKey,
    governingTokenOwner: program.provider.wallet.publicKey,
    transferAuthority: program.provider.wallet.publicKey,
    payer: program.provider.wallet.publicKey,
  });

  await sleep(500);

  let [ix, charter_governance] = await createAccountGovernance({
    authority: program.provider.wallet.publicKey,
    governanceProgramId: governanceProgramId,
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
  await sleep(500);
  await program.provider.send(gov_tx, []);

  return charter_governance;
}

async function createTokenGovernanceForDepositAccounts(
  governanceProgramId: anchor.web3.PublicKey,
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
    governanceProgramId: governanceProgramId,
    governingTokenSource: userVoteDeposit,
    governingTokenMint: communityMint.publicKey,
    governingTokenOwner: program.provider.wallet.publicKey,
    transferAuthority: program.provider.wallet.publicKey,
    payer: program.provider.wallet.publicKey,
  });

  await sleep(500);
  let [ix, charter_governance] = await createTokenGovernance({
    authority: program.provider.wallet.publicKey,
    governanceProgramId: governanceProgramId,
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
  await sleep(500);
  await program.provider.send(gov_tx, []);

  return charter_governance;
}

async function createAssociatedTokenAccount(
  program: anchor.Program<Strangemood>,
  provider: anchor.Provider,
  mint: anchor.web3.PublicKey
) {
  await sleep(500);
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
  await sleep(500);
  await program.provider.send(tx, []);
  return associatedTokenAccountAddress;
}

async function doGovernances(params: {
  rpc: string;
  governanceProgramId: anchor.web3.PublicKey;
  realm_mint: anchor.web3.PublicKey;
  realm: anchor.web3.PublicKey;
  charter: anchor.web3.PublicKey;
  sol_account: anchor.web3.PublicKey;
  vote_account: anchor.web3.PublicKey;
}) {
  const provider = anchor.Provider.local(params.rpc);
  anchor.setProvider(provider);
  const program = anchor.workspace.Strangemood as anchor.Program<Strangemood>;

  await sleep(1000);
  let userVoteDeposit = await splToken.Token.getAssociatedTokenAddress(
    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    splToken.TOKEN_PROGRAM_ID,
    params.realm_mint,
    provider.wallet.publicKey
  );
  console.log("Your vote deposit is", userVoteDeposit.toString());

  await sleep(1000);

  const dummy = anchor.web3.Keypair.generate();
  const token = new splToken.Token(
    provider.connection,
    params.realm_mint,
    splToken.TOKEN_PROGRAM_ID,
    dummy
  );

  await sleep(1000);

  console.log("creating charter governance");
  const charter_governance = await createCharterGovernance(
    params.governanceProgramId,
    program,
    userVoteDeposit,
    params.realm,
    params.charter,
    token
  );

  console.log("CHARTER_GOVERNANCE", charter_governance.toString());

  await sleep(1000);

  console.log("Creating token governance for sol deposit ");
  const sol_deposit_gov = await createTokenGovernanceForDepositAccounts(
    params.governanceProgramId,
    program,
    provider.wallet.publicKey,
    userVoteDeposit,
    params.realm,
    params.sol_account,
    token
  );
  console.log("sol_deposit_gov", sol_deposit_gov.toString());

  await sleep(1000);

  console.log("Creating token governance for vote deposit ");
  const vote_deposit_gov = await createTokenGovernanceForDepositAccounts(
    params.governanceProgramId,
    program,
    provider.wallet.publicKey,
    userVoteDeposit,
    params.realm,
    params.vote_account,
    token
  );
  console.log("vote_deposit_gov", vote_deposit_gov.toString());

  await sleep(500);

  return {
    charter_governance,
    vote_deposit_gov,
    sol_deposit_gov,
  };
}

async function createTokenAccount(
  program: anchor.Program<Strangemood>,
  mint: anchor.web3.PublicKey
) {
  const conn = program.provider.connection;
  let lamports = anchor.web3.LAMPORTS_PER_SOL;
  await sleep(500);
  let signature = await program.provider.connection.requestAirdrop(
    program.provider.wallet.publicKey,
    lamports
  );
  await sleep(1500);
  await program.provider.connection.confirmTransaction(signature);

  let tx = new anchor.web3.Transaction({
    feePayer: program.provider.wallet.publicKey,
  });

  let keypair = anchor.web3.Keypair.generate();

  await sleep(200);

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

  await sleep(500);

  await program.provider.send(tx, [keypair]);
  return keypair;
}

function sleep(time) {
  console.log("...waiting for", time, "ms");
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function main() {
  /**
   * NOTE:
   * Before running, you need to create a mint and update the mint you're
   * using in NET.mint.
   *
   * spl-token create-token
   * spl-token create-account <MINT>
   * spl-token mint <MINT> 10000000
   */

  let rpc = "https://api.testnet.solana.com";
  const provider = anchor.Provider.local(rpc);
  anchor.setProvider(provider);
  const program = anchor.workspace.Strangemood as anchor.Program<Strangemood>;

  let userVoteDeposit = await splToken.Token.getAssociatedTokenAddress(
    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    splToken.TOKEN_PROGRAM_ID,
    TESTNET.STRANGEMOOD_FOUNDATION_MINT,
    provider.wallet.publicKey
  );
  await sleep(1000);
  try {
    await provider.connection.getAccountInfo(userVoteDeposit);
  } catch (err) {
    console.error(
      `You don't have a token account ${userVoteDeposit.toString()} for mint ${
        TESTNET.STRANGEMOOD_FOUNDATION_MINT
      }`
    );
    console.error(err);
  }

  await sleep(5000);

  console.log("Creating Realm");
  const { realm } = await doRealm({
    realm_mint: TESTNET.STRANGEMOOD_FOUNDATION_MINT,
    rpc,
    governance_program_id: TESTNET.GOVERNANCE_PROGRAM_ID,
  });
  console.log("realm", realm.toString());

  await sleep(8000);

  console.log("Creating realm vote deposit");
  const realm_vote_deposit = await createTokenAccount(
    program,
    TESTNET.STRANGEMOOD_FOUNDATION_MINT
  );
  console.log("realm_vote_deposit", realm_vote_deposit.publicKey.toString());

  await sleep(10000);

  console.log("Creating sol vote deposit");
  const realm_sol_deposit = await createTokenAccount(
    program,
    splToken.NATIVE_MINT
  );
  console.log("realm_sol_deposit", realm_sol_deposit.publicKey.toString());

  await sleep(8000);

  console.log("Creating charter");
  const { charter } = await doCharter({
    rpc,
    governance_program_id: TESTNET.GOVERNANCE_PROGRAM_ID,
    realm_mint: TESTNET.STRANGEMOOD_FOUNDATION_MINT,
    realm: realm,
    realm_vote_deposit: realm_vote_deposit.publicKey,
    realm_sol_deposit: realm_sol_deposit.publicKey,
  });
  console.log("charter", charter.toString());

  await sleep(8000);

  console.log("Creating governances");
  const { charter_governance, sol_deposit_gov, vote_deposit_gov } =
    await doGovernances({
      rpc,
      governanceProgramId: TESTNET.GOVERNANCE_PROGRAM_ID,
      realm_mint: TESTNET.STRANGEMOOD_FOUNDATION_MINT,
      realm: realm,
      charter: charter,
      sol_account: realm_sol_deposit.publicKey,
      vote_account: realm_vote_deposit.publicKey,
    });

  await sleep(5000);

  console.log("charter gov", charter_governance.toString());
  console.log("sol_deposit gov", sol_deposit_gov.toString());
  console.log("vote_deposit gov", vote_deposit_gov.toString());

  await sleep(5000);

  const [mint_authority, _] = await pda.mint(
    TESTNET.STRANGEMOOD_PROGRAM_ID,
    TESTNET.STRANGEMOOD_FOUNDATION_MINT
  );

  console.log(
    `spl-token authorize ${TESTNET.STRANGEMOOD_FOUNDATION_MINT} freeze ${mint_authority}`
  );
  console.log(
    `spl-token authorize ${TESTNET.STRANGEMOOD_FOUNDATION_MINT} mint ${mint_authority}`
  );
}

main()
  .then(() => console.log("done"))
  .catch(console.error);
