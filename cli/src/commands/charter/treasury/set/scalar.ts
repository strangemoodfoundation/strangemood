import { Command, Flags } from "@oclif/core";
import ora from "ora";
import { getProgram } from "../../../../provider";
import { setCharterTreasuryScalar } from "@strangemood/strangemood";
import { PublicKey, Transaction } from "@solana/web3.js";

export default class CharterTreausryUpdateScalar extends Command {
  static description = "Set charter treasury scalar";

  static examples = [
    `$ strangemood charter treasury set scalar --charter 7DFCSJoup2ePkNZb6Dhgpb9ABynKwVXDQAS3o5s7o9Ev --mint So11111111111111111111111111111111111111112 1.0
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
  };

  static args = [
    {
      name: "scalar",
      description:
        "A variable combined with expansion rate that changes how many vote tokens are distributed when using this currency",
      required: false,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CharterTreausryUpdateScalar);
    const spinner = ora("Connecting").start();

    spinner.text = "Fetching Program";
    const program = await getProgram({
      net: flags.cluster as any,
    });

    spinner.text = "Setting charter treasury";

    let instructions = [];
    const asSetCharterTreasuryScalar = await setCharterTreasuryScalar({
      program,
      charter: new PublicKey(flags.charter),
      mint: new PublicKey(flags.mint),
      scalar: parseFloat(args["scalar"]),
      signer: program.provider.wallet.publicKey,
    });
    instructions.push(...asSetCharterTreasuryScalar.instructions);

    let tx = new Transaction();
    tx.add(...instructions);

    spinner.text = "Sending transaction...";
    await program.provider.send(tx);

    spinner.stop();
    this.log(asSetCharterTreasuryScalar.treasury.toBase58());
  }
}
