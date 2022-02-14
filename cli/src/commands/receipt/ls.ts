import { Command, Flags } from "@oclif/core";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getProgram } from "../../provider";

export default class ReceiptLS extends Command {
  static description = "Return open receipts you've created";

  static examples = [
    `$ strangemood receipt ls
`,
  ];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
    }),
    keypair: Flags.string({
      description: "A path to a keypair file to use instead of the default",
      required: false,
    }),
  };

  static args = [];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ReceiptLS);
    const spinner = ora("Connecting").start();

    spinner.text = "Fetching Program";
    const program = await getProgram({
      net: flags.cluster as any,
      keypair: flags.keypair,
    });

    let purchaser: PublicKey = program.provider.wallet.publicKey;

    spinner.text = "Fetching Receipt from " + purchaser.toString();
    const receipt = await program.account.receipt.all([
      {
        memcmp: {
          offset: 8 + 1 + 1 + 1 + 32 + 32, // after tag + bool, bool, bool, pubkey
          bytes: purchaser.toBase58(),
        },
      },
    ]);
    spinner.stop();
    this.log(JSON.stringify(receipt, null, 2));
  }
}
