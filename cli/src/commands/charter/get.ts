import { Command, Flags } from "@oclif/core";
import * as anchor from "@project-serum/anchor";
import { getProgram } from "../../provider";

export default class CharterGet extends Command {
  static description = "Returns a JSON object of the charter";

  static examples = [
    `$ strangemood charter get BdbEbwDDLF5421zZdoZJLGjbRZYACyRBhE7cmKwfhmZF
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
      name: "charter",
      description: "The public key of the charter",
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CharterGet);

    const program = await getProgram("mainnet-beta");
    const charter = await program.account.charter.fetch(args["charter"]);
    this.log(JSON.stringify(charter, null, 2));
  }
}
