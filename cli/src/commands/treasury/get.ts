import { Command, Flags } from "@oclif/core";
import ora from "ora";
import { getProgram } from "../../provider";

export default class TreasuryGet extends Command {
  static description = "Returns a JSON object of the treasury";

  static examples = [
    `$ strangemood treasury get 2d2t3RF8SEjDcXmfwnJSHPmj9QPAAyQBzEBEkq9GhM2o
`,
  ];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
    }),
  };

  static args = [
    {
      name: "treasury",
      description: "The public key of the treasury",
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TreasuryGet);
    const spinner = ora("Connecting").start();

    spinner.text = "Fetching Program";
    const program = await getProgram(flags.cluster as any);

    spinner.text = "Fetching Treasury";
    const charter = await program.account.charterTreasury.fetch(
      args["treasury"]
    );
    spinner.stop();
    this.log(JSON.stringify(charter, null, 2));
  }
}
