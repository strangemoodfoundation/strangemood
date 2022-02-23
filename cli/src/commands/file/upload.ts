import { Command, Flags } from "@oclif/core";
import ora from "ora";
import { packToFs } from 'ipfs-car/pack/fs';
import { FsBlockStore } from 'ipfs-car/blockstore/fs'
import { TreewalkCarSplitter } from 'carbites/treewalk';
import { CarReader } from '@ipld/car'
import { postCar } from '../../postCar';
import fs from 'fs'
import fetch from 'node-fetch';
import { assert } from "console";


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
    const bigCar = await CarReader.fromIterable(fs.createReadStream(outputPath));
    const [rootCid] = await bigCar.getRoots();
    const targetSize = 100000000; // chunk to ~100MB CARs
    const num_cars = Math.ceil(fileSizeInBytes / targetSize);
    const splitter = new TreewalkCarSplitter(bigCar, targetSize);

    var i = 1;
    for await (const car of splitter.cars()) {
      const chunks = []
      for await (const chunk of car) {
        chunks.push(chunk)
      }
      const bytes = new Uint8Array([].concat(...chunks.map(c => Array.from(c))));

      spinner.text = `Uploading CAR chunk ${i}/${num_cars}...`;
      // TODO: Async with retries
      const json = await postCar(bytes);
      if (!json || json['cid'] !== rootCid.toString()) {
        this.log("Error uploading the file, servers may be busy")
        break
      }
      i++;
    }
    spinner.stop();
    fs.unlinkSync(outputPath);
    this.log(`File CID: ${root}`);
  }
}
