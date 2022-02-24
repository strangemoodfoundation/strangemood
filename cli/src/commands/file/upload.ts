import { Command } from "@oclif/core";
import ora from "ora";
import { packToFs } from 'ipfs-car/pack/fs';
import { FsBlockStore } from 'ipfs-car/blockstore/fs'
import { TreewalkCarSplitter } from 'carbites/treewalk';
import { CarIndexedReader } from '@ipld/car'
import { postCar } from '../../postCar';
import fs from 'fs'
import { Block } from "@ipld/car/api";


export default class CharterGet extends Command {
  static description = "Upload game file to IPFS";

  static examples = [
    `$ strangemood file upload ./input.zip`,
  ];

  static args = [
    {
      name: "input",
      description: "Path to the file to be uploaded",
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(CharterGet);
    const inputPath = args["input"];
    const outputPath = "./output.car"
    const spinner = ora("Connecting").start();


    spinner.text = "Packing file to CAR...";
    const { root } = await packToFs({ input: inputPath, output: outputPath, blockstore: new FsBlockStore(), wrapWithDirectory: false });
    var stats = fs.statSync(outputPath)
    var fileSizeInBytes = stats.size;

    spinner.text = "Uploading CAR in chunks...";
    const reader = await CarIndexedReader.fromFile(outputPath);
    const [rootCid] = await reader.getRoots();
    const targetSize = 100000000; // chunk to ~100MB CARs
    const num_cars = Math.ceil(fileSizeInBytes / targetSize);
    const splitter = new TreewalkCarSplitter(reader, targetSize);

    var i = 1;
    var promises = []
    for await (const car of splitter.cars()) {
      const chunks = []
      for await (const chunk of car) {
        chunks.push(chunk)
      }
      const bytes = new Uint8Array([].concat(...chunks.map(c => Array.from(c))));

      spinner.text = `Uploading CAR chunk...`;
      promises.push(postCar(bytes));
      i++;
    }
    await reader.close();

    const responses = await Promise.all(promises);
    responses.forEach((json) => {
      if (!json || json['cid'] !== rootCid.toString()) {
        this.log("Error uploading the file, servers may be busy")
      }
    });
    spinner.stop();
    fs.unlinkSync(outputPath);
    this.log(`File CID: ${root}`);
  }
}
