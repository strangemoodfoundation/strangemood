import { Command, Flags } from "@oclif/core";
import { getProgram } from "../../provider";
import {
  withAssociatedTokenAccount,
  withMint,
  withMintTo,
  withSetMintAuthority,
  withTokenAccount,
} from "../../token";
import * as splToken from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { initCharter, pda } from "@strangemood/strangemood";
import { toAmountAndDecimals } from "../../numbers";
import * as anchor from "@project-serum/anchor";
import ora from "ora";

export default class CharterInit extends Command {
  static description = "Creates a new charter";

  static examples = [
    `$ strangemood charter init --uri https://strangemood.org --expansion 30 --paymentSplit 0.02 --expansionSplit 0.3
`,
  ];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
    }),

    mint: Flags.string({
      description: "An existing mint to use",
      required: false,
    }),

    supply: Flags.integer({
      description: "An initial supply of tokens to mint to yourself",
      required: false,
      default: 100000,
    }),

    uri: Flags.url({
      description: "A URI where you can find metadata for this charter",
      required: true,
    }),

    expansion: Flags.string({
      description: "The rate at which new vote tokens are minted",
      required: true,
    }),

    paymentSplit: Flags.string({
      description:
        "The % of each transaction that is contributed to the governance.",
      required: true,
    }),

    expansionSplit: Flags.string({
      description:
        "The % of vote token expansion that is contribution to the governance",
      required: true,
    }),
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(CharterInit);
    const spinner = ora("Connecting").start();

    const expansion = toAmountAndDecimals(flags.expansion);
    const paymentSplit = toAmountAndDecimals(flags.paymentSplit);
    const voteSplit = toAmountAndDecimals(flags.expansionSplit);

    if (parseFloat(flags.expansion) <= 0.0) {
      throw new Error("expansion must be greater than or equal to 0.0");
    }
    if (
      parseFloat(flags.paymentSplit) >= 1.0 ||
      parseFloat(flags.paymentSplit) < 0.0
    ) {
      throw new Error("paymentSplit must be between 0.0 and 1.0");
    }
    if (
      parseFloat(flags.expansionSplit) >= 1.0 ||
      parseFloat(flags.expansionSplit) < 0.0
    ) {
      throw new Error("expansionSplit must be between 0.0 and 1.0");
    }

    spinner.text = "Fetching Program";
    const program = await getProgram({
      net: flags.cluster as any,
    });

    let instructions: TransactionInstruction[] = [];
    let signers: Keypair[] = [];

    // Use the mint passed in, or create a new mint
    let mint: PublicKey;
    if (flags.mint) {
      mint = new PublicKey(flags.mint as any);
    } else {
      spinner.text = "InitMint";
      let { ixs, keypair } = await withMint(program);
      instructions.push(...ixs);
      signers.push(keypair);
      mint = keypair.publicKey;
    }

    // If requested, mint an initial supply of tokens to yourself
    if (flags.supply) {
      spinner.text = "InitAssociatedTokenAccount";
      const asWithAssAcc = await withAssociatedTokenAccount(
        program,
        mint,
        program.provider.wallet.publicKey
      );
      instructions.push(asWithAssAcc.ix);

      spinner.text = "MintTo";
      let { ix } = await withMintTo(
        program,
        mint,
        asWithAssAcc.address,
        flags.supply
      );
      instructions.push(ix);
    }

    // Create a deposit for votes to go to
    spinner.text = "InitTokenAccount";
    const asVoteDeposit = await withTokenAccount(program, mint);
    instructions.push(...asVoteDeposit.ixs);
    signers.push(asVoteDeposit.keypair);

    // Create the charter
    spinner.text = "InitCharter";
    const asInitCharter = await initCharter({
      program: program,
      authority: program.provider.wallet.publicKey,
      voteDeposit: asVoteDeposit.keypair.publicKey,
      mint: mint,
      signer: program.provider.wallet.publicKey,
      uri: flags.uri.toString(),
      expansionAmount: expansion.amount,
      expansionDecimals: expansion.decimals,
      paymentContributionAmount: paymentSplit.amount,
      paymentContributionDecimals: paymentSplit.decimals,
      voteContributionAmount: voteSplit.amount,
      voteContributionDecimals: voteSplit.decimals,
    });
    instructions.push(...asInitCharter.instructions);

    // Move the mint authority to a PDA of the program.
    spinner.text = "SetMintAuthority";
    const [mintAuthority, _] = await pda.mint(program.programId, mint);
    const asSetMintAuthority = await withSetMintAuthority(
      program,
      mint,
      mintAuthority
    );
    instructions.push(asSetMintAuthority.ix);

    spinner.text = "Sending transaction...";
    let tx = new Transaction();
    tx.add(...instructions);
    await program.provider.send(tx, signers);
    spinner.stop();

    console.log(asInitCharter.charter.toString());
  }
}
