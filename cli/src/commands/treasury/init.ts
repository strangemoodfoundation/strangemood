import { Command, Flags } from "@oclif/core";
import { getProgram } from "../../provider";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { initCharterTreasury, pda } from "@strangemood/strangemood";
import * as anchor from "@project-serum/anchor";
import ora from "ora";
import { withTokenAccount } from "../../token";
import chalk from "chalk";

export default class TreasuryInit extends Command {
  static description = "Creates a new treasury for your charter";

  static examples = [
    `$ strangemood treasury init --charter 7DFCSJoup2ePkNZb6Dhgpb9ABynKwVXDQAS3o5s7o9Ev --mint So11111111111111111111111111111111111111112
`,
    `$ strangemood treasury init --charter 7DFCSJoup2ePkNZb6Dhgpb9ABynKwVXDQAS3o5s7o9Ev --mint So11111111111111111111111111111111111111112 --scale 0.8
`,
  ];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
    }),

    charter: Flags.string({
      description: "The charter to make this treasury from",
      required: true,
    }),

    mint: Flags.string({
      description: "An existing mint to use",
      required: true,
    }),

    deposit: Flags.string({
      description: "An existing token account to use for the treasury",
      required: false,
    }),

    scale: Flags.string({
      description:
        "A variable multiplied to the expansion rate that changes how many vote tokens are distributed when using this currency",
      required: false,
      default: "1",
    }),
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(TreasuryInit);
    const spinner = ora("Connecting").start();

    const scalar = parseFloat(flags.scale);
    let mint: PublicKey = new PublicKey(flags.mint);
    let charter: PublicKey = new PublicKey(flags.charter);

    spinner.text = "Fetching Program";
    const program = await getProgram({
      net: flags.cluster as any,
    });
    let instructions: TransactionInstruction[] = [];
    let signers: Keypair[] = [];

    // Create a token account if one isn't specified
    let deposit: PublicKey;
    if (flags.deposit) {
      deposit = new PublicKey(flags.deposit);
    } else {
      spinner.text = "InitTokenAccount";
      let asTokenAccount = await withTokenAccount(program, mint);
      instructions.push(...asTokenAccount.ixs);
      signers.push(asTokenAccount.keypair);
      deposit = asTokenAccount.keypair.publicKey;
    }

    spinner.text = "Fetching Charter";
    let charterAccount = await program.account.charter.fetch(charter);
    if (!charterAccount) {
      throw new Error(
        `Charter '${charter.toString()}' does not exist on this cluster.`
      );
    }

    let [treasuryPDA, _] = await pda.treasury(program.programId, charter, mint);
    spinner.text = `Checking if ${treasuryPDA.toString()} exists...`;
    const maybeTreasury = await program.provider.connection.getAccountInfo(
      treasuryPDA
    );
    if (maybeTreasury) {
      spinner.clear();
      spinner.stop();
      console.warn(
        chalk.yellow(`Treasury '${treasuryPDA.toString()}' already exists.`)
      );
      this.log(treasuryPDA.toString());
      return;
    }

    spinner.text = "InitCharterTreasury";
    const asCharterTreasury = await initCharterTreasury({
      program,
      charter,
      deposit,
      mint,
      scalar,
    });
    instructions.push(...asCharterTreasury.instructions);

    let tx = new Transaction();
    tx.add(...instructions);

    spinner.text = "Sending transaction...";
    await program.provider.send(tx, signers);
    spinner.stop();

    console.log(asCharterTreasury.treasury.toString());
  }
}
