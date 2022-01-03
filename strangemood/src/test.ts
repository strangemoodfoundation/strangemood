import * as solana from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import fs from "fs/promises";
import { Strangemood, TESTNET } from ".";
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
const { SystemProgram, SYSVAR_RENT_PUBKEY } = anchor.web3;

async function doRealm() {
  const connection = new solana.Connection("https://api.testnet.solana.com");

  const data = await fs.readFile("/home/ubuntu/.config/solana/id.json", "utf8");
  const signer = solana.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(data) as number[])
  );

  const tx = new solana.Transaction();

  const [realm_ix, realm] = await createRealm({
    authority: signer.publicKey,
    communityMint: new solana.PublicKey(TESTNET.STRANGEMOOD_FOUNDATION_MINT),
    payer: signer.publicKey,
    name: "Strangemood",
    governanceProgramId: new solana.PublicKey(TESTNET.GOVERNANCE_PROGRAM_ID),
  });

  console.log(realm.toString());

  tx.add(realm_ix);

  let sig = await connection.sendTransaction(tx, [signer]);
  connection.confirmTransaction(sig);
}

async function doCharter() {
  if (!process.env.ANCHOR_WALLET) {
    throw new Error("You need to do ANCHOR_WALLET=xyz node ...");
  }
  const provider = anchor.Provider.local("https://api.testnet.solana.com");
  console.log("provider");
  anchor.setProvider(provider);
  console.log("Anchor");
  const program = anchor.workspace.Strangemood as anchor.Program<Strangemood>;

  console.log("pda.charter");
  // Create charter
  let [charterPDA, charterBump] = await pda.charter(
    program.programId,
    TESTNET.GOVERNANCE_PROGRAM_ID,
    TESTNET.STRANGEMOOD_FOUNDATION_REALM
  );
  console.log("charter", charterPDA.toString());

  let realm_vote_deposit = new solana.PublicKey(
    "76vkQimLFPkKr35Vd4g1GucYFC9vByp96WftU8svibc5"
  );
  console.log("realm vote deposit", realm_vote_deposit.toString());
  let realm_sol_deposit = await createAssociatedTokenAccount(
    program,
    provider,
    splToken.NATIVE_MINT
  );
  console.log("realm sol deposit", realm_sol_deposit.toString());

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
        realm: TESTNET.STRANGEMOOD_FOUNDATION_REALM,
        governanceProgram: TESTNET.GOVERNANCE_PROGRAM_ID,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
    }
  );
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
  await program.provider.send(gov_tx, []);

  return charter_governance;
}

async function createAssociatedTokenAccount(
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
  console.log("provider");
  anchor.setProvider(provider);
  console.log("Anchor");
  const program = anchor.workspace.Strangemood as anchor.Program<Strangemood>;

  let userVoteDeposit = await splToken.Token.getAssociatedTokenAddress(
    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    splToken.TOKEN_PROGRAM_ID,
    params.realm_mint,
    provider.wallet.publicKey
  );

  const dummy = anchor.web3.Keypair.generate();
  const token = new splToken.Token(
    provider.connection,
    params.realm_mint,
    splToken.TOKEN_PROGRAM_ID,
    dummy
  );

  const charter_governance = await createCharterGovernance(
    params.governanceProgramId,
    program,
    userVoteDeposit,
    params.realm,
    params.charter,
    token
  );

  console.log("CHARTER_GOVERNANCE", charter_governance.toString());

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
}

doThing()
  .then(() => console.log("done"))
  .catch(console.error);

async function main() {
  const provider = anchor.Provider.local("https://api.testnet.solana.com");
  console.log("provider");
  anchor.setProvider(provider);
  console.log("Anchor");
  const program = anchor.workspace.Strangemood as anchor.Program<Strangemood>;

  const [mint_authority, _] = await pda.mint(
    TESTNET.STRANGEMOOD_PROGRAM_ID,
    TESTNET.STRANGEMOOD_FOUNDATION_MINT
  );

  console.log("authority", mint_authority.toString());
}

main()
  .then(() => console.log("done"))
  .catch(console.error);
