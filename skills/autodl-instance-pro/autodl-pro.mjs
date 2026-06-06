#!/usr/bin/env node
import { main } from "../../dist/pro/cli.mjs";

process.exitCode = await main(process.argv.slice(2));
